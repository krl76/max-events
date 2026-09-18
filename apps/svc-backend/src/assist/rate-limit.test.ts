import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { AssistRateLimiter } from "./rate-limit";

describe("AssistRateLimiter", () => {
  it("has no Nest-injected constructor parameters", () => {
    expect(AssistRateLimiter.length).toBe(0);
    const types = Reflect.getMetadata("design:paramtypes", AssistRateLimiter) as unknown[] | undefined;
    expect(types === undefined || types.length === 0).toBe(true);
  });

  it("allows a test-sized window then blocks", () => {
    const limiter = new AssistRateLimiter().configure(1, 60_000);
    expect(limiter.hit("u1", 1_000)).toBe(true);
    expect(limiter.hit("u1", 1_001)).toBe(false);
    expect(limiter.hit("u2", 1_001)).toBe(true);
  });
});
