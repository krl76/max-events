/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { describeError, describeParseError, installErrorLogging, logError } from "./log-error";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("describeError", () => {
  it("reads Error.message and a plain string", () => {
    expect(describeError(new Error("boom"))).toBe("boom");
    expect(describeError("nope")).toBe("nope");
  });
});

describe("describeParseError", () => {
  it("joins zod-like issues so a failed list names the field", () => {
    expect(describeParseError({ issues: [{ path: ["plan", "meetingAt"], message: "Invalid" }, { path: ["event", "paymentUrl"], message: "Required" }] })).toBe("plan.meetingAt: Invalid; event.paymentUrl: Required");
  });
});

describe("logError", () => {
  it("prints the label and the message", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    logError("API /plans returned invalid payload", { issues: [{ path: ["0"], message: "bad" }] }, { path: "/plans" });
    expect(error).toHaveBeenCalledOnce();
    expect(error.mock.calls[0]?.[0]).toBe("API /plans returned invalid payload");
  });
});

describe("installErrorLogging", () => {
  it("logs window errors and unhandled rejections", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const stop = installErrorLogging(window);
    window.dispatchEvent(new ErrorEvent("error", { message: "script failed", error: new Error("script failed") }));
    window.dispatchEvent(Object.assign(new Event("unhandledrejection"), { reason: new Error("lost") }));
    stop();
    expect(error.mock.calls.some((call) => call[0] === "window error")).toBe(true);
    expect(error.mock.calls.some((call) => call[0] === "unhandled rejection")).toBe(true);
  });
});
