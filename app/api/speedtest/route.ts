import { NextResponse } from "next/server";

/** Lightweight payload for client-side download speed estimate on the success page. */
export async function GET() {
  const size = 384 * 1024; // 384 KiB
  const body = Buffer.alloc(size, 0x61);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(size),
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
