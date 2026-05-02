import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

declare global {
  var videoLiveChatWaitingRooms: { roomName: string; createdAt: number }[] | undefined;
}

function getWaitingCount() {
  return globalThis.videoLiveChatWaitingRooms?.length ?? 0;
}

function buildLiveStats() {
  const waitingCount = getWaitingCount();
  const now = Date.now();
  const timeWave = Math.round((Math.sin(now / 180000) + 1.2) * 120);
  const pulse = Math.round((Math.cos(now / 9000) + 1) * 12);
  const onlineCount = 1180 + timeWave + pulse + waitingCount * 9;
  const matchingCount = 28 + waitingCount * 3 + (pulse % 11);

  return {
    onlineCount,
    matchingCount,
  };
}

export async function GET() {
  return NextResponse.json(buildLiveStats(), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}