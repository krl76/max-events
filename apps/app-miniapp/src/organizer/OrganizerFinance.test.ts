import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createWithdrawal, financeView, formatRub, withdrawalBlock, type FinanceOperation, OrganizerFinance } from "./OrganizerFinance";

const photo = financeView("all", 30);

describe("financeView", () => {
  it("opens on the mock: 482 750 ₽, +24%, three sources and the four latest operations", () => {
    expect(photo.totalRub).toBe(482_750);
    expect(photo.deltaPercent).toBe(24);
    expect(photo.tiles.map((tile) => [tile.label, tile.amountRub, tile.percent])).toEqual([
      ["События", 421_300, 87],
      ["Промокоды", 36_450, 7],
      ["Партнёрства", 25_000, 5],
    ]);
    expect(photo.points.map((point) => point.label)).toEqual(["23.09", "24.09", "25.09", "26.09", "27.09", "28.09", "29.09"]);
    expect(photo.operations.slice(0, 4).map((row) => row.title)).toEqual(["Билет на событие «Джаз»", "Комиссия Stripe", "Промокод «ОСЕНЬ2027»", "Выплата организатору"]);
    expect(photo.availableRub).toBe(128_400);
  });

  it("switches the hero and the tiles when the scope is events or promocodes", () => {
    const events = financeView("events", 30);
    const codes = financeView("promocodes", 30);

    expect(events.totalRub).toBe(421_300);
    expect(events.tiles.map((tile) => tile.label)).toEqual(["Джаз", "Стендап в парке", "Йога на набережной"]);
    expect(events.operations.some((row) => row.kind === "promo")).toBe(false);
    expect(codes.totalRub).toBe(36_450);
    expect(codes.tiles.map((tile) => tile.percent)).toEqual([50, 30, 20]);
    expect(codes.operations.some((row) => row.kind === "ticket")).toBe(false);
  });

  it("keeps a payout inside every scope and drops it once it falls outside the period", () => {
    expect(financeView("promocodes", 7).operations.some((row) => row.id === "payout-sep")).toBe(true);
    expect(financeView("all", 7).operations.some((row) => row.id === "payout-early")).toBe(false);
    expect(financeView("all", 30).operations.some((row) => row.id === "payout-early")).toBe(true);
    expect(financeView("all", 90).operations.some((row) => row.id === "jazz-august")).toBe(true);
  });

  it("changes the total and the chart when the period changes", () => {
    expect(financeView("all", 7).totalRub).toBe(86_400);
    expect(financeView("all", 7).points[0].income).not.toBe(photo.points[0].income);
    expect(financeView("all", 90).totalRub).toBe(1_260_480);
    expect(financeView("all", 90).points.map((point) => point.label)[0]).toBe("07.07");
  });

  it("adds a withdrawal on top of the list, lowers the balance and lifts the last payout point", () => {
    const payout: FinanceOperation = createWithdrawal(5_000, 1);
    const next = financeView("all", 30, [payout]);

    expect(payout.amountRub).toBe(-5_000);
    expect(next.operations[0]).toBe(payout);
    expect(next.availableRub).toBe(123_400);
    expect(next.points[next.points.length - 1].payout).toBe(photo.points[photo.points.length - 1].payout + 5_000);
  });
});

describe("withdrawalBlock", () => {
  it("asks for an amount, rejects a fraction and a sum above the balance", () => {
    expect(withdrawalBlock("  ", 128_400)).toBe("Укажите сумму");
    expect(withdrawalBlock("15.5", 128_400)).toBe("Сумма — целое число рублей");
    expect(withdrawalBlock("200000", 128_400)).toBe("Сумма больше доступного остатка");
  });

  it("accepts a whole-ruble sum inside the balance", () => {
    expect(withdrawalBlock("5 000", 128_400)).toBeNull();
    expect(withdrawalBlock("128400", 128_400)).toBeNull();
  });
});

describe("OrganizerFinance", () => {
  it("draws the mock home: title, 30-day income, sources, chart and withdraw", () => {
    const html = renderToStaticMarkup(createElement(OrganizerFinance));

    expect(html).toContain("Финансы");
    expect(html).toContain("Доходы, выплаты и аналитика");
    expect(html).toContain("Общий доход");
    expect(html).toContain(formatRub(482_750));
    expect(html).toContain("+24%");
    expect(html).toContain("за последние 30 дней");
    expect(html).toContain("Динамика выплат и доходов");
    expect(html).toContain("Последние операции");
    expect(html).toContain("Все →");
    expect(html).toContain("Вывести средства");
    expect(html).toContain("Билет на событие «Джаз»");
    expect(html).toContain("Комиссия Stripe");
  });
});
