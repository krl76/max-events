import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EMPTY_PROMO_DRAFT, PROMO_COUNTERS, PROMO_TOOL_CARDS, promoToolBlock, promoToolNotice, OrganizerPromotion } from "./OrganizerPromotion";

describe("promoToolBlock", () => {
  it("asks for a campaign name and a whole-ruble budget", () => {
    expect(promoToolBlock("campaign", EMPTY_PROMO_DRAFT)).toBe("Укажите название кампании");
    expect(promoToolBlock("campaign", { ...EMPTY_PROMO_DRAFT, name: "Осень", budget: "15.5" })).toBe("Бюджет — целое число рублей");
    expect(promoToolBlock("campaign", { ...EMPTY_PROMO_DRAFT, name: "Осень", budget: "15000" })).toBeNull();
  });

  it("requires an event, a code with a 1–100 discount, and a mailing text", () => {
    expect(promoToolBlock("feed", EMPTY_PROMO_DRAFT)).toBe("Укажите событие");
    expect(promoToolBlock("code", { ...EMPTY_PROMO_DRAFT, code: "ОСЕНЬ", discount: "0" })).toBe("Скидка — от 1 до 100%");
    expect(promoToolBlock("code", { ...EMPTY_PROMO_DRAFT, code: "ОСЕНЬ", discount: "20" })).toBeNull();
    expect(promoToolBlock("mail", EMPTY_PROMO_DRAFT)).toBe("Напишите текст рассылки");
    expect(promoToolNotice("code", { ...EMPTY_PROMO_DRAFT, code: "осень" })).toBe("Промокод ОСЕНЬ создан");
  });
});

describe("OrganizerPromotion", () => {
  it("draws the four tools and the promotion counters from the mock", () => {
    const html = renderToStaticMarkup(createElement(OrganizerPromotion));

    expect(html).toContain("Продвижение");
    expect(html).not.toContain("Продвигайте свои события и привлекайте больше гостей");
    expect(html).toContain("Инструменты");
    expect(html).toContain("Аналитика");
    expect(PROMO_TOOL_CARDS.map((card) => card.action).every((action) => html.includes(action))).toBe(true);
    expect(html).toContain("Реклама и охваты");
    expect(html).toContain(PROMO_COUNTERS[0].value);
    expect(html).toContain("+32%");
    expect(html).toContain("Охваты (лента)");
    expect(html).toContain("Подписчики");
  });
});
