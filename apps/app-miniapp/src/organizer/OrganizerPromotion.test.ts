import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EMPTY_PROMO_DRAFT, PROMO_CAMPAIGNS, PROMO_CODE_ROWS, PROMO_HOME_TOOLS, PROMO_TOOL_CARDS, PromoCodeCreate, PromoCodesScreen, promoToolBlock, promoToolNotice, OrganizerPromotion } from "./OrganizerPromotion";

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
  it("draws the promotion home screen from the mock", () => {
    const html = renderToStaticMarkup(createElement(OrganizerPromotion));
    const home = PROMO_HOME_TOOLS.map((id) => PROMO_TOOL_CARDS.find((card) => card.id === id));

    expect(html).toContain("Продвижение");
    expect(html).toContain("Мои кампании");
    expect(html).toContain("Активные");
    expect(html).toContain("Запланированные");
    expect(html).not.toContain("Инструменты");
    expect(html).not.toContain("Рекламная кампания");
    expect(html).not.toContain("Продвигайте свои события и привлекайте больше гостей");
    for (const card of home) {
      expect(card).toBeDefined();
      expect(html).toContain(card?.title);
      expect(html).toContain(card?.text);
    }
    for (const campaign of PROMO_CAMPAIGNS) {
      expect(html).toContain(campaign.title);
      expect(html).toContain(campaign.meta);
    }
    expect(html).toContain("Опубликована");
    expect(html).toContain("Скидка 20%");
    expect(html).toContain("/covers/promo-jazz.jpg");
    expect(html).not.toContain("Список промокодов");
  });

  it("draws the promo-code list and the new-code form from the mocks", () => {
    const noop = () => {};
    const list = renderToStaticMarkup(createElement(PromoCodesScreen, { onBack: noop, onCreate: noop }));
    const form = renderToStaticMarkup(createElement(PromoCodeCreate, { draft: EMPTY_PROMO_DRAFT, block: null, onChange: noop, onSubmit: noop, onBack: noop }));

    expect(list).toContain("Промокоды");
    expect(list).toContain("Архивные");
    expect(list).toContain("Создавайте промокоды и привлекайте больше гостей на ваши события!");
    expect(list).toContain("Создать промокод");
    expect(list).toContain("Список промокодов");
    for (const row of PROMO_CODE_ROWS) {
      expect(list).toContain(row.code);
      expect(list).toContain(row.detail);
      expect(list).toContain(row.delta);
    }
    expect(form).toContain("Новый промокод");
    expect(form).not.toContain("SUMMER2025");
    expect(form).not.toContain("01.08.2025");
    expect(form).not.toContain("<select");
    expect(form).toContain("Тип скидки");
    expect(form).toContain("Размер скидки, %");
    expect(form).toContain("Процент");
    expect(form).toContain("Выберите событие");
    expect(form).toContain("Без ограничений");
    expect(form).toContain("Применять ко всем билетам");
    expect(form).toContain('aria-checked="true"');
    expect(form).toContain('aria-haspopup="listbox"');
  });
});
