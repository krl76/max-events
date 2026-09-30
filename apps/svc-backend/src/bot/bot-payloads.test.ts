import { describe, expect, it } from "vitest";
import { botPayload, parseBotPayload, startAppPayload, type BotPayload } from "./bot-payloads";

const eventId = "00000000-0000-4000-8000-0000000000e1";

describe("botPayload round trip", () => {
  it("keeps the bare menu commands", () => {
    for (const id of ["menu", "today", "plans", "bookings", "help"] as const) {
      const payload = botPayload({ id });
      expect(parseBotPayload(payload)).toEqual({ id });
    }
  });

  it("carries the whereto chain forward one answer at a time", () => {
    const steps: BotPayload[] = [
      { id: "whereto", step: "company" },
      { id: "whereto", step: "mood", company: "friends" },
      { id: "whereto", step: "budget", company: "friends", mood: "calm" },
      { id: "whereto", step: "go", company: "friends", mood: "calm", budget: "free" },
    ];
    for (const step of steps) expect(parseBotPayload(botPayload(step))).toEqual(step);
  });

  it("carries the event id on the booking commands", () => {
    for (const id of ["confirm-book", "book", "waitlist"] as const) {
      expect(parseBotPayload(botPayload({ id, eventId }))).toEqual({ id, eventId });
    }
  });
});

describe("parseBotPayload", () => {
  it("rejects what is not ours: empty, oversized, unknown, and malformed shapes", () => {
    expect(parseBotPayload("")).toBeNull();
    expect(parseBotPayload("   ")).toBeNull();
    expect(parseBotPayload("drop-tables")).toBeNull();
    expect(parseBotPayload("book:1:2")).toBeNull();
    expect(parseBotPayload(`book:${eventId.toUpperCase()}x`)).toBeNull();
    expect(parseBotPayload("x".repeat(1025))).toBeNull();
  });

  it("rejects a whereto payload whose answers are missing or invented", () => {
    expect(parseBotPayload("whereto:mood")).toBeNull();
    expect(parseBotPayload("whereto:mood:strangers")).toBeNull();
    expect(parseBotPayload("whereto:budget:friends")).toBeNull();
    expect(parseBotPayload("whereto:go:friends:calm")).toBeNull();
    expect(parseBotPayload("whereto:go:friends:calm:expensive")).toBeNull();
    expect(parseBotPayload("whereto:company:extra")).toBeNull();
  });

  it("accepts a callback payload MAX would send back verbatim", () => {
    expect(parseBotPayload(`confirm-book:${eventId}`)).toEqual({ id: "confirm-book", eventId });
    expect(parseBotPayload("whereto:go:alone:unusual:under_3000")).toEqual({ id: "whereto", step: "go", company: "alone", mood: "unusual", budget: "under_3000" });
  });
});

describe("startAppPayload", () => {
  it("spells the prefixes the miniapp router already reads", () => {
    expect(startAppPayload("event", eventId)).toBe(`event-${eventId}`);
    expect(startAppPayload("plan", eventId)).toBe(`plan-${eventId}`);
    expect(startAppPayload("booking", eventId)).toBe(`booking-${eventId}`);
    expect(startAppPayload("onboarding")).toBe("onboarding");
    expect(startAppPayload("calendar")).toBe("calendar");
  });

  it("emits only characters MAX allows on an open_app payload", () => {
    // MAX constrains open_app payloads to ^[\w-]*$; a stray character would fail the send.
    expect(startAppPayload("event", "abc/def ghi?x=1")).toBe("event-abcdefghix1");
    expect(/^[A-Za-z0-9_-]*$/.test(startAppPayload("event", eventId))).toBe(true);
  });

  it("is empty when an entity prefix has no id, so the button would open nothing", () => {
    expect(startAppPayload("event", "")).toBe("");
    expect(startAppPayload("event", "   ")).toBe("");
  });
});
