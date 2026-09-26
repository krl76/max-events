import { describe, expect, it } from "vitest";
import { isDirectInsult, offeredChoiceIndex } from "./chat-guard";

describe("isDirectInsult", () => {
  it("matches a direct slur and ignores a greeting", () => {
    expect(isDirectInsult("иди на хуй")).toBe(true);
    expect(isDirectInsult("как дела?")).toBe(false);
  });
});

describe("offeredChoiceIndex", () => {
  it("reads a bare ordinal and rejects a choice mixed with a new request", () => {
    expect(offeredChoiceIndex("берём второй", 2)).toBe(1);
    expect(offeredChoiceIndex("второй, и позови друзей", 2)).toBe(null);
    expect(offeredChoiceIndex("этот", 1)).toBe(0);
    expect(offeredChoiceIndex("этот", 2)).toBe(null);
    expect(offeredChoiceIndex("четвёртый", 3)).toBe(null);
  });
});
