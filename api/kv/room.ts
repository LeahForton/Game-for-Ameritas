import { redis, errorResponse, jsonResponse, playersKey, roomKey } from "./utils";

export const config = { runtime: "edge" };

export default async function handler(req: Request) {
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const body = await req.json().catch(() => null);
  const code = String(body?.code ?? "").trim().toUpperCase().slice(0, 4);
  const hostName = String(body?.hostName ?? "").trim();

  if (!code || !hostName) {
    return errorResponse("Missing room code or hostName", 400);
  }

  const key = roomKey(code);
  const existing = await redis.get(key);
  if (existing) {
    return errorResponse("Room already exists. Try again.", 409);
  }

  const playerId = crypto.randomUUID?.() ?? `host-${Date.now()}`;
  await Promise.all([
    redis.set(key, {
      code,
      hostName,
      status: "waiting",
      createdAt: new Date().toISOString(),
    }),
    redis.set(playersKey(code), [{ id: playerId, name: hostName }]),
  ]);

  return jsonResponse({ code, hostName });
}
