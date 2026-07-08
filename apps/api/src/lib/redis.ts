import { Redis } from "ioredis";
import { REDIS_STREAM } from "@sentezy/types";
import { env } from "../env";

export const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

/** Enqueue a video job onto the Redis Stream the Python worker consumes. */
export async function enqueueVideo(payload: { videoId: string; userId: string; attempt?: number }) {
  return redis.xadd(
    REDIS_STREAM,
    "*",
    "payload",
    JSON.stringify({ attempt: 0, ...payload }),
  );
}
