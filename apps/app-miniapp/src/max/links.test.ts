import { describe, expect, it } from "vitest";
import { maxAppLink, sharePayload, startParamFromSharedUrl } from "./links";

describe("maxAppLink", () => {
  it("opens the bot window on the screen named by startapp", () => {
    expect(maxAppLink("event-42")).toBe("https://max.ru/se14352055_bot?startapp=event-42");
    expect(maxAppLink("  plan-1  ")).toBe("https://max.ru/se14352055_bot?startapp=plan-1");
  });
});

describe("startParamFromSharedUrl", () => {
  it("keeps a startapp payload and rewrites a website calendar invite", () => {
    expect(startParamFromSharedUrl("https://events.versacegus.cc/?startapp=plan-abc")).toBe("plan-abc");
    expect(startParamFromSharedUrl("https://events.versacegus.cc/calendar/invite/018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d93")).toBe("calendar-018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d93");
    expect(startParamFromSharedUrl("https://max.ru/c/1")).toBeNull();
    expect(startParamFromSharedUrl("not a url")).toBeNull();
  });
});

describe("sharePayload", () => {
  it("attaches the bot link once and leaves a sentence without a screen alone", () => {
    const linked = sharePayload("План на вечер", "plan-1");

    expect(linked.link).toBe("https://max.ru/se14352055_bot?startapp=plan-1");
    expect(linked.text).toBe("План на вечер\nhttps://max.ru/se14352055_bot?startapp=plan-1");
    expect(sharePayload("Только текст", null)).toEqual({ text: "Только текст" });
  });
});
