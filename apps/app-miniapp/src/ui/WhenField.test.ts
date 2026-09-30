import { describe, expect, it } from "vitest";
import { whenMonthTitle, whenSummary, whenValue } from "./WhenField";

describe("whenMonthTitle", () => {
  it("capitalises the month and drops the trailing г.", () => {
    expect(whenMonthTitle(new Date(2026, 8, 1))).toBe("Сентябрь 2026");
  });
});

describe("whenSummary", () => {
  it("reads the chosen day and time as one line", () => {
    expect(whenSummary("2026-09-04T04:00")).toBe("4 сентября · 04:00");
    expect(whenSummary("")).toBeNull();
  });
});

describe("whenValue", () => {
  it("writes local wall-clock the calendar used to emit", () => {
    expect(whenValue(new Date(2026, 8, 4, 4, 0))).toBe("2026-09-04T04:00");
  });
});
