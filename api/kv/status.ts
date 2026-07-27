import { errorResponse, jsonResponse, roomKey, redis } from "./utils";

export const config = { runtime: "edge" };

export default async function handler(req: Request) {
  if (req.method !== "GET") {
    return errorResponse("Method not allowed", 405);
  }

  const url = new URL(req.url);
  const code = String(url.searchParams.get("code") ?? "").trim().toUpperCase().slice(0, 4);
  if (!code) {
    return errorResponse("Missing room code", 400);
  }

  const room = await redis.get(roomKey(code));
  if (!room) {
    return errorResponse("Room not found", 404);
  }

  return jsonResponse({
    status: (room as any).status ?? "waiting",
    current_round: Number((room as any).current_round ?? 1),
  });
}
