import { redis, errorResponse, jsonResponse, playersKey, roomKey } from "./utils";

export const config = { runtime: "edge" };

export default async function handler(req: Request) {
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const body = await req.json().catch(() => null);
  const code = String(body?.code ?? "").trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
  const playerId = String(body?.playerId ?? "").trim();
  const capital = Number(body?.capital ?? NaN);

  if (!code || !playerId || Number.isNaN(capital)) {
    return errorResponse("Missing room code, playerId, or capital", 400);
  }

  const room = await redis.get(roomKey(code));
  if (!room) {
    return errorResponse("Room not found", 404);
  }

  const players = (await redis.get(playersKey(code))) as Array<{ id: string; name: string; capital?: number }> | null;
  if (!players) {
    return errorResponse("Player list not found", 404);
  }

  const updated = players.map((player) =>
    player.id === playerId ? { ...player, capital } : player
  );

  await redis.set(playersKey(code), updated);
  return jsonResponse({ success: true, updated });
}
