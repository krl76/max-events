import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CABINET_EVENTS, cabinetOccupancy, cabinetStats, cabinetTrafficLead, cabinetWeakUpcoming, defaultStatsRange, fillCaption } from "./cabinet-catalog";
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
    expect(
      chartPeak([
        { label: "23.09", value: 8_000 },
        { label: "27.09", value: 32_400 },
      ]),
    ).toEqual({ label: "27.09", value: 32_400 });
    expect(periodCaption(30)).toBe("Последние 30 дней");
  });
});

describe("fillCaption", () => {
  it("names the occupancy so the numbers are not a bare fraction", () => {
    expect(fillCaption(64, 80, 80)).toBe("занято 64 из 80");
  });
});

describe("cabinetOccupancy", () => {
  it("sums seats for the period instead of listing events", () => {
    const range = defaultStatsRange();
    const occupancy = cabinetOccupancy(CABINET_EVENTS, new Date(`${range.from}T00:00:00+03:00`), new Date(`${range.to}T23:59:59+03:00`));

    expect(occupancy.capacity).toBeGreaterThan(0);
    expect(occupancy.booked).toBeGreaterThan(0);
    expect(occupancy.fill).toBeGreaterThan(0);
    expect(occupancy.fill).toBeLessThanOrEqual(100);
  });
});

describe("cabinetWeakUpcoming", () => {
  it("returns the thin upcoming events as a CRM nudge, not the period catalog", () => {
    const weak = cabinetWeakUpcoming(CABINET_EVENTS, new Date("2026-09-26T12:00:00+03:00"));

    expect(weak[0]?.title).toBe("Беседка в Сокольниках");
    expect(weak.every((row) => row.fill < 60)).toBe(true);
  });
});

describe("OrganizerStatistics", () => {
  it("opens as a light CRM infographic: occupancy track, guest funnel, sources, no event catalog or money", () => {
    const html = renderToStaticMarkup(createElement(OrganizerStatistics, { onCreateEvent: noop, onPromote: noop }));

    expect(html).toContain("Статистика");
    expect(html).toContain("регистрации");
    expect(html).toContain("из просмотров");
    expect(html).toContain("Путь гостя");
    expect(html).toContain("Просмотры");
    expect(html).toContain("Дошли");
    expect(html).toContain("Отмены");
    expect(html).toContain("Места");
    expect(html).toContain("Занято");
    expect(html).toContain("гостей");
    expect(html).toContain("Повторно");
    expect(html).toContain("Новые");
    expect(html).toContain("Источники регистраций");
    expect(html).toContain(cabinetTrafficLead());
    expect(html).toContain("Когда записываются");
    expect(html).toContain("Продвинуть");
    expect(html).toContain("Уведомления");
    expect(html).not.toContain("Заполняемость");
    expect(html).not.toContain("Занятость мест");
    expect(html).not.toContain("app-org-way--dark");
    expect(html).not.toContain("Разбор");
    expect(html).not.toContain("Органный вечер в соборе");
    expect(html).not.toContain("к прошлому периоду");
    expect(html).not.toContain("Откуда записи");
    expect(html).not.toContain("Динамика дохода");
    expect(html).not.toContain("Общий доход");
    expect(html).not.toContain("Средний чек");
    expect(html).not.toContain("Создать событие");
  });
});
