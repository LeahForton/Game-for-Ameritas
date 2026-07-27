import { redis, errorResponse, jsonResponse, playersKey, roomKey } from "./utils";

export const config = { runtime: "edge" };

export default async function handler(req: Request) {
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const body = await req.json().catch(() => null);
  const code = String(body?.code ?? "").trim().toUpperCase().slice(0, 4);
  const playerName = String(body?.playerName ?? "").trim();

  if (!code || !playerName) {
    return errorResponse("Missing room code or playerName", 400);
  }

  const room = await redis.get(roomKey(code));
  if (!room) {
    return errorResponse("Room not found", 404);
  }

  if ((room as any).status !== "waiting") {
    return errorResponse("Game already started", 409);
  }

  const currentPlayers = (await redis.get(playersKey(code))) as Array<{ id: string; name: string }> | null;
  const players = currentPlayers ?? [];
  const id = crypto.randomUUID?.() ?? `player-${Date.now()}`;
  players.push({ id, name: playerName, capital: 100 });

  await redis.set(playersKey(code), players);
  return jsonResponse({ success: true, players, playerId: id });
}
