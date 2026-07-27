import { redis, errorResponse, jsonResponse, playersKey, roomKey } from "./utils";

export const config = { runtime: "edge" };

export default async function handler(req: Request) {
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const body = await req.json().catch(() => null);
  const code = String(body?.code ?? "").trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
  const hostName = String(body?.hostName ?? "").trim();

  console.log("room.ts received", { method: req.method, code, hostName });

  if (!code || !hostName) {
    return errorResponse("Missing room code or hostName", 400);
  }

  const key = roomKey(code);
  const existing = await redis.get(key);
  if (existing) {
    return errorResponse("Room already exists. Try again.", 409);
  }

  const playerId = crypto.randomUUID?.() ?? `host-${Date.now()}`;
  const results = await Promise.all([
    redis.set(key, {
      code,
      hostName,
      status: "waiting",
      current_round: 1,
      createdAt: new Date().toISOString(),
    }),
    redis.set(playersKey(code), [{ id: playerId, name: hostName, capital: 100 }]),
  ]);

  console.log("room.ts redis write results", results);

  return jsonResponse({ success: true, code, hostName, playerId });
}
