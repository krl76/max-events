import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { OrganizerSetup as OrganizerSetupState } from "../api/client";
import { OrganizerSetupView, organizerPayoutBlock, type OrganizerSetupViewProps } from "./OrganizerSetup";
import { ORGANIZER_NEXT_UP } from "./organizer-onboarding";

const noop = () => {};

const SETUP: OrganizerSetupState = {
  organizationId: "e0000000-0000-4000-8000-000000000001",
  step: "venue",
  completedAt: null,
  venue: { placeId: "b0000001-0000-4000-8000-000000000001", title: "Парк Горького", address: "Крымский Вал, 9", city: "Москва" },
  activities: ["events", "slots"],
  payouts: { mode: "none", paymentUrl: null, contacts: null },
};

function draw(overrides: Partial<OrganizerSetupViewProps> = {}): string {
  const setup = overrides.setup ?? SETUP;
  return renderToStaticMarkup(createElement(OrganizerSetupView, { setup, step: setup.step, status: "ready", saveFailed: false, blocked: null, onToggleActivity: noop, onPayoutMode: noop, onPaymentUrl: noop, onContacts: noop, onNext: noop, onBack: noop, onCreateEvent: noop, onDashboard: noop, ...overrides }));
}

describe("organizerPayoutBlock", () => {
  it("lets the free mode through without asking for a link", () => {
    expect(organizerPayoutBlock("none", "")).toBeNull();
  });

  it("refuses a paid mode with no link — the Event contract would refuse it too", () => {
    expect(organizerPayoutBlock("external", "  ")).toContain("ссылку на оплату");
  });

  it("refuses something that is not a URL rather than storing it", () => {
    expect(organizerPayoutBlock("external", "касса на входе")).toContain("https://");
  });

  it("accepts a real link, trimmed", () => {
    expect(organizerPayoutBlock("external", " https://pay.example.com/gorky ")).toBeNull();
  });
});

describe("OrganizerSetupView, шаг «Площадка»", () => {
  it("draws the rail of макета with all three steps at once", () => {
    const html = draw();

    expect(html).toContain("Площадка");
    expect(html).toContain("Реквизиты");
    expect(html).toContain("Событие");
  });

  it("marks exactly the current step on the rail", () => {
    expect(draw().match(/aria-current="step"/g)).toHaveLength(1);
  });

  it("puts the venue behind the initials tile, since no logo field exists", () => {
    const html = draw();

    expect(html).toContain("ПГ");
    expect(html).toContain("Парк Горького");
    expect(html).toContain("Крымский Вал, 9");
  });

  it("locks «Заменить логотип» and says why instead of pretending it works", () => {
    const html = draw();

    expect(html).toContain("Заменить логотип");
    expect(html).toContain("app-org-setup-logo-btn");
    expect(html).toContain("disabled");
    expect(html).toContain("логотипа площадка ещё не хранит");
  });

  it("presses exactly the activities the setup carries", () => {
    expect(draw().match(/aria-pressed="true"/g)).toHaveLength(SETUP.activities.length);
  });

  it("lists everything «ДАЛЬШЕ ПОНАДОБИТСЯ» promises", () => {
    const html = draw();

    for (const item of ORGANIZER_NEXT_UP) expect(html).toContain(item.text);
  });

  it("names the next step on its button", () => {
    expect(draw()).toContain("Дальше · реквизиты");
  });
});

describe("OrganizerSetupView, шаг «Реквизиты»", () => {
  const payouts = { ...SETUP, step: "payouts" as const };

  it("says plainly that Афиша neither takes payments nor keeps bank details", () => {
    const html = draw({ setup: payouts });

    expect(html).toContain("Афиша не проводит платежи");
    expect(html).toContain("ИНН, расчётного счёта и получателя платежа Афиша не спрашивает");
  });

  it("asks for no bank field — every one of them would be invented", () => {
    const html = draw({ setup: payouts });

    for (const invented of ["ИНН организации", "Расчётный счёт", "БИК", "КПП", "Получатель платежа"]) expect(html).not.toContain(invented);
  });

  it("hides the payment link until the paid mode is chosen", () => {
    expect(draw({ setup: payouts })).not.toContain("Ссылка на оплату");
    expect(draw({ setup: { ...payouts, payouts: { mode: "external", paymentUrl: null, contacts: null } } })).toContain("Ссылка на оплату");
  });

  it("asks only for fields the server can actually store", () => {
    expect(draw({ setup: payouts })).toContain("Контакт для покупателя");
  });

  it("voices the refusal a swallowed swipe would otherwise hide", () => {
    expect(draw({ setup: payouts, blocked: "Добавьте ссылку на оплату" })).toContain("Добавьте ссылку на оплату");
  });
});

describe("OrganizerSetupView, шаг «Событие»", () => {
  const event = { ...SETUP, step: "event" as const };

  it("offers both exits макета: the first event and the dashboard", () => {
    const html = draw({ setup: event });

    expect(html).toContain("Создать событие");
    expect(html).toContain("Позже · в дашборд");
  });

  it("drops the rail button there — the two exits are the only way on", () => {
    expect(draw({ setup: event })).not.toContain("Готово");
  });

  it("sums up what настройка settled, payment mode included", () => {
    const html = draw({ setup: event });

    expect(html).toContain("Пока без оплаты");
    expect(draw({ setup: { ...event, payouts: { mode: "external", paymentUrl: "https://pay.example.com", contacts: null } } })).toContain("По вашей ссылке");
    expect(html).toContain("События, Слоты и аренда");
  });
});

describe("OrganizerSetupView, загрузка", () => {
  it("waits instead of drawing an empty venue card", () => {
    expect(draw({ status: "loading" })).not.toContain("Парк Горького");
  });

  it("says so when the setup could not be read", () => {
    expect(draw({ status: "error" })).toContain("Не удалось загрузить настройку площадки");
  });

  it("admits a failed save rather than swallowing it", () => {
    expect(draw({ saveFailed: true })).toContain("Не удалось сохранить шаг");
  });
});
