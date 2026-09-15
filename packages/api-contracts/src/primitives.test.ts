import { describe, expect, it } from "vitest";
import { IdSchema, PaginatedResponseSchema, PaginationQuerySchema, TimestampSchema } from "./primitives.js";

describe("IdSchema", () => {
  it("rejects non-uuid strings", () => {
    expect(IdSchema.safeParse("018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d8f").success).toBe(true);
    expect(IdSchema.safeParse("not-a-uuid").success).toBe(false);
  });
});

describe("TimestampSchema", () => {
  it("requires ISO datetime with explicit offset", () => {
    expect(TimestampSchema.safeParse("2026-09-12T19:00:00+03:00").success).toBe(true);
    expect(TimestampSchema.safeParse("2026-09-12T19:00:00Z").success).toBe(true);
    expect(TimestampSchema.safeParse("2026-09-12T19:00:00").success).toBe(false);
    expect(TimestampSchema.safeParse("2026-09-12").success).toBe(false);
  });
});

describe("PaginationQuerySchema", () => {
  it("applies defaults for an empty query", () => {
    const parsed = PaginationQuerySchema.parse({});
    expect(parsed).toEqual({ limit: 20, offset: 0 });
  });

  it("rejects limit above the cap and negative offset", () => {
    expect(PaginationQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
    expect(PaginationQuerySchema.safeParse({ offset: -1 }).success).toBe(false);
  });
});

describe("PaginatedResponseSchema", () => {
  it("wraps item schemas into a list envelope", () => {
    const schema = PaginatedResponseSchema(IdSchema);
    const parsed = schema.parse({ items: ["018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d8f"], total: 1, limit: 20, offset: 0 });
    expect(parsed.items).toHaveLength(1);
    expect(schema.safeParse({ items: ["nope"], total: 1, limit: 20, offset: 0 }).success).toBe(false);
    expect(schema.safeParse({ items: [], total: -1, limit: 20, offset: 0 }).success).toBe(false);
  });
});
