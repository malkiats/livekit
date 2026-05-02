import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WAITING_ROOM_TTL_MS = 45_000;

interface WaitingRoomEntry {
  roomName: string;
  createdAt: number;
}

declare global {
  var videoLiveChatWaitingRooms: WaitingRoomEntry[] | undefined;
}

function getWaitingRooms() {
  if (!globalThis.videoLiveChatWaitingRooms) {
    globalThis.videoLiveChatWaitingRooms = [];
  }

  return globalThis.videoLiveChatWaitingRooms;
}

async function cleanupWaitingRooms(
  roomService: RoomServiceClient,
  excludeRoom?: string
) {
  const waitingRooms = getWaitingRooms();
  const staleRooms = waitingRooms.filter(
    (entry) =>
      Date.now() - entry.createdAt > WAITING_ROOM_TTL_MS ||
      entry.roomName === excludeRoom
  );

  if (staleRooms.length === 0) {
    return;
  }

  globalThis.videoLiveChatWaitingRooms = waitingRooms.filter(
    (entry) => !staleRooms.some((stale) => stale.roomName === entry.roomName)
  );

  await Promise.all(
    staleRooms.map(async ({ roomName }) => {
      try {
        await roomService.deleteRoom(roomName);
      } catch {
        // Ignore rooms that are already gone or currently active.
      }
    })
  );
}

export async function POST(req: NextRequest) {
  const { name, country, age, excludeRoom } = await req.json();

  if (!name || !country || !age) {
    return NextResponse.json(
      { error: "Name, country, and age are required" },
      { status: 400 }
    );
  }

  if (typeof age !== "number" || age < 18) {
    return NextResponse.json(
      { error: "You must be 18 or older" },
      { status: 400 }
    );
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const livekitUrl = process.env.LIVEKIT_URL;

  if (!apiKey || !apiSecret || !livekitUrl) {
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 }
    );
  }

  const roomService = new RoomServiceClient(livekitUrl, apiKey, apiSecret);

  await cleanupWaitingRooms(roomService, excludeRoom);

  const waitingRooms = getWaitingRooms();
  const nextWaitingRoom = waitingRooms.find(
    (entry) => entry.roomName !== excludeRoom
  );

  let roomName: string;

  if (nextWaitingRoom) {
    roomName = nextWaitingRoom.roomName;
    globalThis.videoLiveChatWaitingRooms = waitingRooms.filter(
      (entry) => entry.roomName !== roomName
    );
  } else {
    roomName = `room-${uuidv4()}`;

    try {
      await roomService.createRoom({
        name: roomName,
        maxParticipants: 2,
        emptyTimeout: 20,
      });
    } catch {
      // If room creation races, the token can still join by name.
    }

    waitingRooms.push({
      roomName,
      createdAt: Date.now(),
    });
  }

  const identity = uuidv4();

  const token = new AccessToken(apiKey, apiSecret, {
    identity,
    name,
    metadata: JSON.stringify({ country, age }),
  });

  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  const jwt = await token.toJwt();

  return NextResponse.json({ token: jwt, room: roomName });
}
