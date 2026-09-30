import { describe, expect, it } from "vitest";
import { humanMeeting, humanWhen, miniappLink, withAppLink } from "./human-when";

const now = new Date("2026-09-12T12:00:00Z");

describe("humanWhen", () => {
  it("says today, tomorrow, or the Moscow date, and never the raw ISO", () => {
    expect(humanWhen(new Date("2026-09-12T17:30:00Z"), now)).toBe("сегодня в 20:30");
    expect(humanWhen(new Date("2026-09-12T21:00:00Z"), now)).toBe("завтра в 00:00");
    expect(humanWhen(new Date("2026-09-20T17:30:00Z"), now)).toBe("20 сентября в 20:30");
    expect(humanWhen(new Date("2026-09-12T17:30:00Z"), now)).not.toContain("T");
  });
});

describe("humanMeeting", () => {
  it("joins the clock and the place the way a person would say it", () => {
    expect(humanMeeting(new Date("2026-09-12T17:30:00Z"), "у метро Смоленская", now)).toBe("сегодня в 20:30, у метро Смоленская");
    expect(humanMeeting(new Date("2026-09-12T17:30:00Z"), "  ", now)).toBe("сегодня в 20:30");
  });
});

describe("miniappLink", () => {
  it("opens the MAX bot on the screen, not the website the mini-app is hosted on", () => {
    expect(miniappLink("plan-abc")).toBe("https://max.ru/t691_hakaton_max_bot?startapp=plan-abc");
    expect(miniappLink("plan-abc", "https://max.ru/other_bot")).toBe("https://max.ru/other_bot?startapp=plan-abc");
    expect(miniappLink("")).toBeNull();
    expect(miniappLink("plan-abc", "not a url")).toBeNull();
    expect(withAppLink("Сбор сегодня в 20:30.", null)).toBe("Сбор сегодня в 20:30.");
    expect(withAppLink("Сбор сегодня в 20:30.", "https://max.ru/t691_hakaton_max_bot?startapp=plan-abc")).toBe("Сбор сегодня в 20:30. https://max.ru/t691_hakaton_max_bot?startapp=plan-abc");
  });
});
