import Redis from "ioredis";
import { describe, expect, it } from "vitest";
import { createRedisClient } from "./redis.module";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6391";

async function redisReachable(url: string): Promise<boolean> {
  const probe = new Redis(url, {
    lazyConnect: true,
    retryStrategy: () => null,
    connectTimeout: 1000,
    maxRetriesPerRequest: 1,
  });
  probe.on("error", () => {});
  try {
    await probe.connect();
    return true;
  } catch {
    return false;
  } finally {
    probe.disconnect();
  }
}

describe("RedisClient integration (Redis 6391)", () => {
  it("answers PING with PONG", async (ctx) => {
    if (!(await redisReachable(REDIS_URL))) ctx.skip();
    const client = createRedisClient(REDIS_URL);
    try {
      await expect(client.ping()).resolves.toBe("PONG");
    } finally {
      client.disconnect();
    }
  });

  it("stores and reads back a value", async (ctx) => {
    if (!(await redisReachable(REDIS_URL))) ctx.skip();
    const client = createRedisClient(REDIS_URL);
    try {
      await client.set("healthcheck:ping", "ok");
      await expect(client.get("healthcheck:ping")).resolves.toBe("ok");
    } finally {
      client.disconnect();
    }
  });
});

describe("createRedisClient", () => {
  it("builds an ioredis client targeting the REDIS_URL endpoint", () => {
    const client = createRedisClient(REDIS_URL);
    client.on("error", () => {});
    expect(client).toBeInstanceOf(Redis);
    expect(client.options.port).toBe(6391);
    client.disconnect();
  });

  it("reports refused connections as unreachable", async () => {
    await expect(redisReachable("redis://localhost:1")).resolves.toBe(false);
  });
});
