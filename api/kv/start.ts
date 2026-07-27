import { redis, errorResponse, jsonResponse, roomKey } from "./utils";

export const config = { runtime: "edge" };

export default async function handler(req: Request) {
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const body = await req.json().catch(() => null);
  const code = String(body?.code ?? "").trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
  if (!code) {
    return errorResponse("Missing room code", 400);
  }

  const key = roomKey(code);
  const room = await redis.get(key);
  if (!room) {
    return errorResponse("Room not found", 404);
  }

  await redis.set(key, {
    ...(room as Record<string, unknown>),
    status: "started",
  });

  return jsonResponse({ success: true, code });
}
