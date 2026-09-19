import { describe, expect, it } from "vitest";
import { formatStartsAt } from "./format";

describe("formatStartsAt", () => {
  it("renders the numeric day before the ru genitive month word", () => {
    expect(formatStartsAt("2026-09-12T12:00:00Z")).toMatch(/^\d{1,2} сентября/u);
  });

  it("keeps ru formatting regardless of the runtime default locale", () => {
    const html = formatStartsAt("2026-09-12T12:00:00Z");

    expect(html).not.toMatch(/[a-z]/i);
  });

  it("maps the month word by the instant's month", () => {
    const january = formatStartsAt("2027-01-12T12:00:00Z");

    expect(january).toContain("января");
    expect(january).not.toContain("сентября");
  });

  it("surfaces stdlib Invalid Date for garbage input instead of throwing", () => {
    expect(formatStartsAt("not-a-date")).toBe("Invalid Date");
  });
});
