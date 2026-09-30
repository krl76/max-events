import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { financeView, formatRub, OrganizerFinance } from "./OrganizerFinance";

const photo = financeView("all", 30);

describe("financeView", () => {
  it("opens on the mock: 482 750 ₽, +24%, three sources, the expense ring and the payout ledger", () => {
    expect(photo.heroLabel).toBe("Общий доход");
    expect(photo.note).toBe("за последние 30 дней");
    expect(photo.totalRub).toBe(482_750);
    expect(photo.deltaPercent).toBe(24);
    expect(photo.tiles.map((tile) => [tile.label, tile.amountRub, tile.percent])).toEqual([
      ["События", 421_300, 87],
      ["Промокоды", 36_450, 7],
      ["Партнёрства", 25_000, 5],
    ]);
    expect(photo.series.labels).toEqual(["23.09", "24.09", "25.09", "26.09", "27.09", "28.09", "29.09"]);
    expect(photo.series.income[0].y).toBeLessThan(10_000);
    expect(photo.series.income[photo.series.income.length - 1].y).toBeGreaterThan(20_000);
    expect(photo.expenses.map((item) => [item.label, item.percent, item.amountRub, item.mark])).toEqual([
      ["Комиссии платформы", 42, 28_750, 42],
      ["Реклама и продвижение", 21, 14_380, 12],
      ["Промокоды", 15, 10_200, 19],
      ["Организация", 12, 8_220, 12],
      ["Прочее", 10, 6_870, 10],
    ]);
    expect(photo.expenseTotalRub).toBe(68_420);
    expect(photo.payouts.map((row) => [row.title, row.amountRub, row.status])).toEqual([
      ["Выплата за события", 120_000, "paid"],
      ["Комиссия платформы", -18_400, "charged"],
      ["Возврат билетов", -7_200, "charged"],
      ["Выплата за события", 95_500, "paid"],
      ["Комиссия платформы", -14_800, "charged"],
    ]);
  });

  it("switches the hero and the tiles when the scope is events or promocodes", () => {
    const events = financeView("events", 30);
    const codes = financeView("promocodes", 30);

    expect(events.heroLabel).toBe("События");
    expect(events.totalRub).toBe(421_300);
    expect(events.tiles.map((tile) => tile.label)).toEqual(["Джаз", "Стендап в парке", "Йога на набережной"]);
    expect(codes.heroLabel).toBe("Промокоды");
    expect(codes.totalRub).toBe(36_450);
    expect(codes.tiles.map((tile) => tile.percent)).toEqual([50, 30, 20]);
  });

  it("drops a payout once it falls outside the period and changes the chart", () => {
    expect(financeView("all", 7).payouts.some((row) => row.id === "event-20")).toBe(false);
    expect(financeView("all", 7).payouts.some((row) => row.id === "refund-26")).toBe(true);
    expect(financeView("all", 30).payouts.some((row) => row.id === "event-12")).toBe(false);
    expect(financeView("all", 90).payouts.some((row) => row.id === "event-12")).toBe(true);
    expect(financeView("all", 7).totalRub).toBe(86_400);
    expect(financeView("all", 7).series.income[0].y).not.toBe(photo.series.income[0].y);
    expect(financeView("all", 90).totalRub).toBe(1_260_480);
    expect(financeView("all", 90).series.labels[0]).toBe("07.07");
    expect(financeView("all", 365).note).toBe("за последний год");
    expect(financeView("all", 365).series.labels[0]).toBe("янв");
    expect(financeView("all", 7).expenseTotalRub).not.toBe(photo.expenseTotalRub);
  });
});

describe("OrganizerFinance", () => {
  it("opens on the cabinet mock: hero, chart, expenses and payout history", () => {
    const html = renderToStaticMarkup(createElement(OrganizerFinance));

    expect(html).toContain("Финансы");
    expect(html).toContain("Доходы, выплаты и аналитика");
    expect(html).toContain("Общий доход");
    expect(html).toContain(formatRub(482_750));
    expect(html).toContain("+24%");
    expect(html).toContain("за последние 30 дней");
    expect(html).toContain("Динамика выплат и доходов");
    expect(html).toContain("Категории расходов");
    expect(html).toContain(formatRub(68_420));
    expect(html).toContain("итого");
    expect(html).toContain("История выплат");
    expect(html).toContain("Выплата за события");
    expect(html).toContain("Возврат билетов");
    expect(html).toContain("Выплачено");
    expect(html).toContain("Списано");
    expect(html).toContain("Год");
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(3);
    expect(html).not.toContain("К выводу");
    expect(html).not.toContain("Вывести средства");
  });
});
