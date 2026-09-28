import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { chartPeak, periodCaption, STATS_SNAPSHOTS, OrganizerStatistics } from "./OrganizerStatistics";
import { formatRub } from "./OrganizerFinance";

const noop = () => {};

describe("STATS_SNAPSHOTS", () => {
  it("opens on the 30-day mock: income, four counters and the five events", () => {
    const snapshot = STATS_SNAPSHOTS[30];

    expect(snapshot.incomeRub).toBe(482_750);
    expect(snapshot.delta).toBe(24);
    expect(snapshot.events).toBe(12);
    expect(snapshot.tickets).toBe(2_842);
    expect(snapshot.averageRub).toBe(1_176);
    expect(snapshot.conversion).toBe(82);
    expect(snapshot.rows.map((row) => [row.title, row.percent])).toEqual([
      ["Вечер джаза на Патриарших", 32],
      ["Ночной забег по набережной", 24],
      ["Экскурсия по Замоскворечью", 18],
      ["Фестиваль уличной еды", 14],
      ["Клуб «Ритм»", 12],
    ]);
    expect(snapshot.promos).toBe(5);
    expect(snapshot.mailings).toBe(3);
  });

  it("changes the income when the account period changes and marks the chart peak", () => {
    expect(STATS_SNAPSHOTS[7].incomeRub).toBe(86_400);
    expect(STATS_SNAPSHOTS[90].events).toBe(28);
    expect(chartPeak([{ label: "23.09", value: 8_000 }, { label: "27.09", value: 32_400 }])).toEqual({ label: "27.09", value: 32_400 });
    expect(periodCaption(30)).toBe("Последние 30 дней");
  });
});

describe("OrganizerStatistics", () => {
  it("draws the statistics mock and the create-event button", () => {
    const html = renderToStaticMarkup(createElement(OrganizerStatistics, { onCreateEvent: noop }));

    expect(html).toContain("Статистика");
    expect(html).toContain("Полная аналитика вашего аккаунта");
    expect(html).toContain(formatRub(482_750));
    expect(html).toContain("+24%");
    expect(html).toContain("Динамика дохода");
    expect(html).toContain("32\u00a0400");
    expect(html).toContain("Создать событие");
    expect(html).toContain("Уведомления");
  });
});
