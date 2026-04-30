import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest) {
  const { name, country, age } = await req.json();

  if (!name || !country || !age) {
    return NextResponse.json(
      { error: "Name, country, and age are required" },
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

  let roomName: string;

  try {
    const rooms = await roomService.listRooms();
    const waitingRoom = rooms.find(
      (room) => room.numParticipants === 1 && room.maxParticipants === 2
    );

    if (waitingRoom) {
      roomName = waitingRoom.name;
    } else {
      roomName = `room-${uuidv4()}`;
    }
  } catch {
    roomName = `room-${uuidv4()}`;
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
  });

  const jwt = await token.toJwt();

  return NextResponse.json({ token: jwt, room: roomName });
}
