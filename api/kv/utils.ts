import { Redis } from "@upstash/redis";

export type KVRoomStatus = "waiting" | "started";

export const roomKey = (code: string) => `room:${code}`;
export const playersKey = (code: string) => `room:${code}:players`;

const redis = new Redis({
  url: process.env.KV_REST_API_URL ?? "",
  token: process.env.KV_REST_API_TOKEN ?? "",
});

export const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const errorResponse = (message: string, status = 400) =>
  jsonResponse({ message }, status);

export { redis };
