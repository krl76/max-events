import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getStartParam, shareResult } from "./bridge";

describe("getStartParam", () => {
  it("returns start_param from initDataUnsafe", () => {
    expect(getStartParam({ initDataUnsafe: { start_param: "event-123" } })).toBe("event-123");
  });

  it("returns null outside MAX client", () => {
    expect(getStartParam(null)).toBeNull();
  });

  it("returns null when start_param is absent", () => {
    expect(getStartParam({ initDataUnsafe: {} })).toBeNull();
  });
});

describe("openExternalLink", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens through the MAX client openLink when available", async () => {
    const openLink = vi.fn();
    vi.stubGlobal("window", { WebApp: { openLink } });
    const { openExternalLink } = await import("./bridge");

    openExternalLink("https://tickets.example.com/pay");

    expect(openLink).toHaveBeenCalledWith("https://tickets.example.com/pay");
  });

  it("falls back to window.open outside the MAX client", async () => {
    const open = vi.fn();
    vi.stubGlobal("window", { open });
    const { openExternalLink } = await import("./bridge");

    openExternalLink("https://tickets.example.com/pay");

    expect(open).toHaveBeenCalledWith("https://tickets.example.com/pay", "_blank", "noopener,noreferrer");
  });
});

describe("openChatLink", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses openMaxLink for max.ru join links", async () => {
    const openMaxLink = vi.fn();
    const openLink = vi.fn();
    vi.stubGlobal("window", { WebApp: { openMaxLink, openLink } });
    const { openChatLink } = await import("./bridge");
    openChatLink("https://max.ru/join/abc");
    expect(openMaxLink).toHaveBeenCalledWith("https://max.ru/join/abc");
    expect(openLink).not.toHaveBeenCalled();
  });

  it("uses openLink for non-max hosts", async () => {
    const openMaxLink = vi.fn();
    const openLink = vi.fn();
    vi.stubGlobal("window", { WebApp: { openMaxLink, openLink } });
    const { openChatLink } = await import("./bridge");
    openChatLink("https://example.com/chat");
    expect(openLink).toHaveBeenCalledWith("https://example.com/chat");
    expect(openMaxLink).not.toHaveBeenCalled();
  });
});

describe("shareResult", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shares through the documented shareMaxContent inside MAX", async () => {
    const shareMaxContent = vi.fn();
    vi.stubGlobal("navigator", {});

    expect(await shareResult({ shareMaxContent }, "подборка")).toBe("bridge");
    expect(shareMaxContent).toHaveBeenCalledWith({ text: "подборка" });
  });

  it("falls back to the clipboard outside the MAX client", async () => {
    const writeText = vi.fn();
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    expect(await shareResult(null, "подборка")).toBe("clipboard");
    expect(writeText).toHaveBeenCalledWith("подборка");
  });

  it("reports unavailable without bridge and clipboard", async () => {
    vi.stubGlobal("navigator", {});

    expect(await shareResult(null, "подборка")).toBe("unavailable");
  });
});
