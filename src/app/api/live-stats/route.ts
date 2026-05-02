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

  return {
    waitingCount,
    statsScope: "current server instance",
  };
}

export async function GET() {
  return NextResponse.json(buildLiveStats(), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}