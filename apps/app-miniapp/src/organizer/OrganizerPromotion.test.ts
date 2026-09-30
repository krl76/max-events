// @vitest-environment happy-dom
import { act, createElement, useState, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import type { OrganizerEvent } from "../api/client";
import { posterEvents } from "./cabinet-catalog";
import { createdPromoCode, EMPTY_PROMO_DRAFT, PROMO_CAMPAIGNS, PROMO_CODE_ROWS, PROMO_HOME_TOOLS, PROMO_TOOL_CARDS, PromoCodeCreate, PromoCodesScreen, promoToolBlock, promoToolNotice, resetPromoSession, OrganizerPromotion } from "./OrganizerPromotion";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("promoToolBlock", () => {
  it("asks for a campaign name and a whole-ruble budget", () => {
    expect(promoToolBlock("campaign", EMPTY_PROMO_DRAFT)).toBe("Укажите название кампании");
    expect(promoToolBlock("campaign", { ...EMPTY_PROMO_DRAFT, name: "Осень", budget: "15.5" })).toBe("Бюджет — целое число рублей");
    expect(promoToolBlock("campaign", { ...EMPTY_PROMO_DRAFT, name: "Осень", budget: "15000" })).toBeNull();
  });

  it("requires a code with a 1–100 discount, and a mailing text", () => {
    expect(promoToolBlock("code", { ...EMPTY_PROMO_DRAFT, code: "ОСЕНЬ", discount: "0" })).toBe("Скидка — от 1 до 100%");
    expect(promoToolBlock("code", { ...EMPTY_PROMO_DRAFT, code: "ОСЕНЬ", discount: "20" })).toBeNull();
    expect(promoToolBlock("mail", EMPTY_PROMO_DRAFT)).toBe("Напишите текст рассылки");
    expect(promoToolNotice("code", { ...EMPTY_PROMO_DRAFT, code: "осень" })).toBe("Промокод ОСЕНЬ создан");
  });
});

describe("createdPromoCode", () => {
  it("shapes a new code as an active unused row and an active campaign", () => {
    const entry = createdPromoCode({ ...EMPTY_PROMO_DRAFT, code: " autumn25 ", discount: "25", period: "01.10.2026", eventTitle: "Вечер джаза" }, "code-1");

    expect(entry.row).toEqual({
      id: "code-1",
      phase: "active",
      code: "AUTUMN25",
      detail: "Скидка 25% · до 01.10.2026",
      uses: "0 использований",
      delta: "+0%",
    });
    expect(entry.campaign).toMatchObject({
      id: "code-1",
      phase: "active",
      tool: "code",
      title: "AUTUMN25",
      note: "Скидка 25%",
      status: null,
      meta: "0 оплаченных заказов",
      cover: null,
      eventTitle: "Вечер джаза",
      code: "AUTUMN25",
      discount: "25",
    });
  });

  it("keeps a fixed amount and does not repeat an until-prefix", () => {
    const entry = createdPromoCode({ ...EMPTY_PROMO_DRAFT, code: "fix", discount: "500", discountKind: "Фиксированная сумма", period: "до 01.10.2026" }, "code-2");

    expect(entry.row.detail).toBe("Скидка 500 ₽ · до 01.10.2026");
    expect(entry.campaign.note).toBe("Скидка 500 ₽");
  });

  it("omits the date when the period is empty", () => {
    expect(createdPromoCode({ ...EMPTY_PROMO_DRAFT, code: "nodate", discount: "10" }, "code-3").row.detail).toBe("Скидка 10%");
  });

  it("keeps a chosen range without an extra until-prefix", () => {
    expect(createdPromoCode({ ...EMPTY_PROMO_DRAFT, code: "range", discount: "10", period: "01.10.2026 — 15.10.2026" }, "code-4").row.detail).toBe("Скидка 10% · 01.10.2026 — 15.10.2026");
  });
});

async function mount(node: ReactElement): Promise<{ host: HTMLDivElement; root: Root }> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(node);
  });
  return { host, root };
}

function buttonNamed(host: ParentNode, label: string): HTMLButtonElement {
  const button = [...host.querySelectorAll("button")].find((node) => node.textContent?.includes(label) || node.getAttribute("aria-label") === label);
  if (button === undefined) throw new Error(`button «${label}» not found`);
  return button;
}

async function typeInto(input: HTMLInputElement, value: string): Promise<void> {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    const tracker = (input as HTMLInputElement & { _valueTracker?: { setValue: (next: string) => void } })._valueTracker;
    tracker?.setValue("");
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("creating a promo code", () => {
  afterEach(() => {
    resetPromoSession();
  });

  it("shows the new code on the promo-code list and in active campaigns", async () => {
    const { host, root } = await mount(createElement(OrganizerPromotion));

    await act(async () => {
      buttonNamed(host, "Промокод").click();
    });
    await act(async () => {
      buttonNamed(host, "Создать промокод").click();
    });

    const inputs = [...host.querySelectorAll("input")];
    const code = inputs[0];
    const discount = inputs[1];
    if (code === undefined || discount === undefined) throw new Error("promo form inputs missing");
    await typeInto(code, "autumn25");
    await typeInto(discount, "25");
    await act(async () => {
      buttonNamed(host, "Период действия").click();
    });
    const days = [...host.querySelectorAll<HTMLButtonElement>(".app-pcodes-cal-day:not(.app-pcodes-cal-day--out)")];
    const start = days[0];
    const end = days[9];
    if (start === undefined || end === undefined) throw new Error("calendar days missing");
    await act(async () => {
      start.click();
    });
    expect(host.querySelector(".app-pcodes-cal")).not.toBeNull();
    await act(async () => {
      end.click();
    });
    expect(host.querySelector(".app-pcodes-cal")).toBeNull();
    const chosen = (buttonNamed(host, "Период действия").textContent ?? "").replace(/\s+/g, " ").trim();
    expect(chosen).toMatch(/^\d{2}\.\d{2}\.\d{4} — \d{2}\.\d{2}\.\d{4}$/);

    await act(async () => {
      buttonNamed(host, "Создать промокод").click();
    });

    expect(host.textContent).toContain("Список промокодов");
    expect(host.textContent).toContain("AUTUMN25");
    expect(host.textContent).toContain(`Скидка 25% · ${chosen}`);
    expect(host.textContent).toContain("0 использований");
    for (const row of PROMO_CODE_ROWS) expect(host.textContent).toContain(row.code);

    await act(async () => {
      buttonNamed(host, "Назад").click();
    });

    expect(host.textContent).toContain("Мои кампании");
    expect(host.textContent).toContain("AUTUMN25");
    expect(host.textContent).toContain("Скидка 25%");
    expect(host.textContent).toContain("0 оплаченных заказов");
    for (const campaign of PROMO_CAMPAIGNS) expect(host.textContent).toContain(campaign.title);

    await act(async () => {
      buttonNamed(host, "AUTUMN25").click();
    });
    expect(host.textContent).toContain("Мои кампании");
    expect(host.textContent).toContain("AUTUMN25");
    expect(host.textContent).not.toContain("Список промокодов");

    await act(async () => {
      root.unmount();
    });
    host.remove();

    const again = await mount(createElement(OrganizerPromotion));
    expect(again.host.textContent).toContain("AUTUMN25");
    expect(again.host.textContent).toContain("0 оплаченных заказов");
    expect(again.host.textContent).toContain("JAZZ20");
    await act(async () => {
      again.root.unmount();
    });
    again.host.remove();
  });
});

describe("OrganizerPromotion", () => {
  it("keeps a promo code opened from campaigns on the campaigns screen", async () => {
    const { host, root } = await mount(createElement(OrganizerPromotion));

    await act(async () => {
      buttonNamed(host, "JAZZ20").click();
    });

    expect(host.textContent).toContain("Мои кампании");
    expect(host.textContent).toContain("Активные");
    expect(host.textContent).toContain("Запланированные");
    expect(host.textContent).not.toContain("Публикация о вечере джаза");
    expect(host.textContent).not.toContain("Публикация в ленте");
    expect(host.textContent).toContain("JAZZ20");
    expect(host.textContent).toContain("Скидка 20%");
    expect(host.textContent).toContain("12 оплаченных заказов");
    expect(host.textContent).not.toContain("Список промокодов");

    await act(async () => {
      root.unmount();
    });
    host.remove();
  });

  it("draws the promotion home screen from the mock", () => {
    const html = renderToStaticMarkup(createElement(OrganizerPromotion));
    const home = PROMO_HOME_TOOLS.map((id) => PROMO_TOOL_CARDS.find((card) => card.id === id));

    expect(html).toContain("Продвижение");
    expect(html).toContain("Мои кампании");
    expect(html).toContain("Активные");
    expect(html).toContain("Запланированные");
    expect(html).not.toContain("Инструменты");
    expect(html).not.toContain("Рекламная кампания");
    expect(html).not.toContain("Публикация в ленте");
    expect(html).not.toContain("Публикация о вечере джаза");
    expect(html).not.toContain("Рассказать о событии");
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
    expect(html).not.toContain("Опубликована");
    expect(html).toContain("Скидка 20%");
    expect(html).not.toContain("/covers/promo-jazz.jpg");
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
    expect(form).toContain('placeholder="Придумайте название"');
    expect(form).toContain('placeholder="Например, 20"');
    expect(form).toContain("Процент");
    expect(form).toContain("Выберите событие");
    expect(form).toContain("Выберите даты");
    expect(form).toContain('aria-label="Период действия"');
    expect(form).not.toContain('<input aria-label="Период действия"');
    expect(form).not.toContain("app-pcodes-cal");
    expect(form).toContain("Без ограничений");
    expect(form).toContain("Применять ко всем билетам");
    expect(form).toContain('aria-checked="true"');
    expect(form).toContain('aria-haspopup="listbox"');
    expect(form).toContain('aria-haspopup="dialog"');
    expect(form).not.toContain("Органный вечер в соборе");
    expect(form).not.toContain("Название или город");
  });

  it("opens a mailing from campaigns on the results screen", async () => {
    const { host, root } = await mount(createElement(OrganizerPromotion));

    await act(async () => {
      buttonNamed(host, "Специальное предложение на выходные").click();
    });

    expect(host.textContent).toContain("Результаты рассылки");
    expect(host.textContent).toContain("Специальное предложение на выходные");
    expect(host.textContent).toContain("20.09.2025 · 14:30");
    expect(host.textContent).toContain("Отправлено");
    expect(host.textContent).toContain("1 502");
    expect(host.textContent).toContain("Открыто");
    expect(host.textContent).toContain("38%");
    expect(host.textContent).toContain("570");
    expect(host.textContent).toContain("Перешли");
    expect(host.textContent).toContain("8%");
    expect(host.textContent).toContain("120");
    expect(host.textContent).toContain("График активности");
    expect(host.textContent).toContain("Открытия");
    expect(host.textContent).toContain("Переходы");
    expect(host.textContent).toContain("Детализация");
    expect(host.textContent).toContain("Успешно доставлено");
    expect(host.textContent).toContain("1 482");
    expect(host.textContent).toContain("99%");
    expect(host.textContent).toContain("Не доставлено");
    expect(host.textContent).toContain("Отписались");
    expect(host.textContent).toContain("0.2%");
    expect(host.textContent).not.toContain("Список рассылок");
    expect(host.textContent).not.toContain("Мои кампании");

    await act(async () => {
      buttonNamed(host, "Назад").click();
    });
    expect(host.textContent).toContain("Мои кампании");
    expect(host.textContent).toContain("JAZZ20");

    await act(async () => {
      root.unmount();
    });
    host.remove();
  });

  it("opens the same results screen from the mailing list", async () => {
    const { host, root } = await mount(createElement(OrganizerPromotion));

    await act(async () => {
      buttonNamed(host, "Рассылка").click();
    });
    await act(async () => {
      buttonNamed(host, "Анонс новых событий").click();
    });

    expect(host.textContent).toContain("Результаты рассылки");
    expect(host.textContent).toContain("Анонс новых событий");
    expect(host.textContent).toContain("25.09.2025 · 11:15");
    expect(host.textContent).toContain("2 342");
    expect(host.textContent).toContain("42%");
    expect(host.textContent).toContain("График активности");
    expect(host.textContent).toContain("Детализация");
    expect(host.textContent).not.toContain("1 502");

    await act(async () => {
      buttonNamed(host, "Назад").click();
    });
    expect(host.textContent).toContain("Список рассылок");

    await act(async () => {
      root.unmount();
    });
    host.remove();
  });
});

function organizerEvent(patch: Pick<OrganizerEvent, "id" | "title" | "startsAt" | "endsAt" | "draft">): OrganizerEvent {
  return {
    id: patch.id,
    title: patch.title,
    description: "",
    category: "afisha",
    city: "Москва",
    placeId: null,
    startsAt: patch.startsAt,
    endsAt: patch.endsAt,
    isPaid: false,
    priceRub: null,
    paymentUrl: null,
    capacity: null,
    chatLink: null,
    promoted: false,
    published: !patch.draft,
    bookingOpensAt: null,
    weather: null,
    coverUrl: null,
    draft: patch.draft,
  };
}

describe("promo code events", () => {
  it("keeps the poster filter to published events that have not ended", () => {
    const now = new Date("2026-09-30T12:00:00+03:00").getTime();
    const items = [
      organizerEvent({ id: "later", title: "Позже", startsAt: "2026-10-08T20:00:00+03:00", endsAt: "2026-10-08T22:00:00+03:00", draft: false }),
      organizerEvent({ id: "soon", title: "Скоро", startsAt: "2026-10-03T19:00:00+03:00", endsAt: "2026-10-03T23:00:00+03:00", draft: false }),
      organizerEvent({ id: "draft", title: "Черновик", startsAt: "2026-10-04T19:00:00+03:00", endsAt: "2026-10-04T23:00:00+03:00", draft: true }),
      organizerEvent({ id: "past", title: "Было", startsAt: "2026-09-01T19:00:00+03:00", endsAt: "2026-09-01T21:00:00+03:00", draft: false }),
    ];

    expect(posterEvents(items, now).map((item) => item.title)).toEqual(["Скоро", "Позже"]);
  });

  it("picks an organizer poster event from the post sheet", async () => {
    const events = [
      organizerEvent({ id: "soon", title: "Вечер джаза на Патриарших", startsAt: "2099-10-03T19:00:00+03:00", endsAt: "2099-10-03T23:00:00+03:00", draft: false }),
      organizerEvent({ id: "draft", title: "Черновик клуба", startsAt: "2099-10-12T20:00:00+03:00", endsAt: "2099-10-12T23:00:00+03:00", draft: true }),
      organizerEvent({ id: "past", title: "Прошедший стендап", startsAt: "2000-09-01T19:00:00+03:00", endsAt: "2000-09-01T21:00:00+03:00", draft: false }),
    ];

    function Harness() {
      const [draft, setDraft] = useState(EMPTY_PROMO_DRAFT);
      return createElement(PromoCodeCreate, {
        draft,
        block: null,
        events,
        onChange: (patch) => setDraft((current) => ({ ...current, ...patch })),
        onSubmit: () => {},
        onBack: () => {},
      });
    }

    const { host, root } = await mount(createElement(Harness));
    await act(async () => {
      buttonNamed(host, "События").click();
    });
    expect(host.querySelector('input[placeholder="Название или город"]')).not.toBeNull();
    expect(host.textContent).toContain("Вечер джаза на Патриарших");
    expect(host.textContent).toContain("Москва");
    expect(host.textContent).not.toContain("Черновик клуба");
    expect(host.textContent).not.toContain("Прошедший стендап");
    expect(host.textContent).not.toContain("Органный вечер в соборе");

    await act(async () => {
      buttonNamed(host, "Вечер джаза на Патриарших").click();
    });
    expect(buttonNamed(host, "События").textContent).toContain("Вечер джаза на Патриарших");
    expect(host.querySelector('input[placeholder="Название или город"]')).toBeNull();

    await act(async () => {
      root.unmount();
    });
    host.remove();
  });
});
