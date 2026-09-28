import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CABINET_EVENTS, cabinetStats, defaultStatsRange } from "./cabinet-catalog";
import { chartPeak, periodCaption, OrganizerStatistics } from "./OrganizerStatistics";

const noop = () => {};

describe("cabinetStats", () => {
  it("counts the Moscow bureau events inside the chosen dates", () => {
    const range = defaultStatsRange();
    const stats = cabinetStats(CABINET_EVENTS, new Date(`${range.from}T00:00:00+03:00`), new Date(`${range.to}T23:59:59+03:00`));

    expect(CABINET_EVENTS.length).toBeGreaterThanOrEqual(25);
    expect(stats.events).toBeGreaterThan(0);
    expect(stats.incomeRub).toBeGreaterThan(0);
    expect(stats.tickets).toBeGreaterThan(0);
    expect(stats.rows[0]?.title).toBe("Органный вечер в соборе");
  });

  it("changes the total when the range moves onto the October concerts", () => {
    const october = cabinetStats(CABINET_EVENTS, new Date("2026-10-01T00:00:00+03:00"), new Date("2026-10-31T23:59:59+03:00"));
    const september = cabinetStats(CABINET_EVENTS, new Date("2026-09-01T00:00:00+03:00"), new Date("2026-09-26T23:59:59+03:00"));

    expect(october.incomeRub).not.toBe(september.incomeRub);
    expect(october.rows.some((row) => row.title === "Концерт в зале «Зарядье»")).toBe(true);
    expect(chartPeak([{ label: "23.09", value: 8_000 }, { label: "27.09", value: 32_400 }])).toEqual({ label: "27.09", value: 32_400 });
    expect(periodCaption(30)).toBe("Последние 30 дней");
  });
});

describe("OrganizerStatistics", () => {
  it("draws a calendar range and does not offer to create an event", () => {
    const html = renderToStaticMarkup(createElement(OrganizerStatistics, { onCreateEvent: noop }));

    expect(html).toContain("Статистика");
    expect(html).toContain("Полная аналитика вашего аккаунта");
    expect(html).toContain("Диапазон дат");
    expect(html).toContain("26.09.2026");
    expect(html).toContain("Динамика дохода");
    expect(html).not.toContain("Создать событие");
    expect(html).toContain("Уведомления");
  });
});
