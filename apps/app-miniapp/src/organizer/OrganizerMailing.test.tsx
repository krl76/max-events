// @vitest-environment happy-dom
import { act, createElement, useState, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import type { Event } from "@max-events/api-contracts";
import { EMPTY_MAILING_DRAFT, MAILING_ROWS, MAIL_AUDIENCES, MailingCreate, MailingListScreen, createdMailing, mailingBlock, mailingRows, resetMailSession, saveMailing } from "./OrganizerMailing";
import { OrganizerPromotion } from "./OrganizerPromotion";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const jazz = {
  id: "c0000001-0000-4000-8000-000000000001",
  title: "Вечер джаза",
  description: "",
  category: "afisha",
  city: "Москва",
  placeId: null,
  startsAt: "2026-10-01T19:00:00+03:00",
  endsAt: null,
  isPaid: false,
  priceRub: null,
  paymentUrl: null,
  capacity: null,
  chatLink: null,
  promoted: false,
  published: true,
  bookingOpensAt: null,
  weather: null,
  coverUrl: "/covers/jazz.jpg",
} as Event;

describe("mailingBlock", () => {
  it("asks for a subject, a message and an event", () => {
    expect(mailingBlock(EMPTY_MAILING_DRAFT)).toBe("Введите тему");
    expect(mailingBlock({ ...EMPTY_MAILING_DRAFT, subject: "Выходные" })).toBe("Введите текст");
    expect(mailingBlock({ ...EMPTY_MAILING_DRAFT, subject: "Выходные", message: "Ждём" })).toBe("Выберите событие");
    expect(mailingBlock({ ...EMPTY_MAILING_DRAFT, subject: "Выходные", message: "Ждём", eventId: jazz.id, eventTitle: jazz.title })).toBeNull();
  });
});

describe("createdMailing", () => {
  afterEach(() => {
    resetMailSession();
  });

  it("shapes a sent mailing as an active row with the audience size", () => {
    const row = createdMailing({ ...EMPTY_MAILING_DRAFT, subject: "  Выходные  ", message: "Ждём", audience: "all", eventId: jazz.id, eventTitle: jazz.title }, "mail-1", new Date(2026, 8, 30));

    expect(row).toEqual({
      id: "mail-1",
      phase: "active",
      title: "Выходные",
      detail: "30.09.2026 · 2 842 получателя",
      opened: "0%",
      clicks: "0%",
    });
    expect(createdMailing({ ...EMPTY_MAILING_DRAFT, subject: "Только своим", message: "Ждём", audience: "active", eventId: jazz.id, eventTitle: jazz.title }, "mail-2", new Date(2026, 8, 30)).detail).toBe("30.09.2026 · 1 960 получателей");
    expect(createdMailing({ ...EMPTY_MAILING_DRAFT, subject: "Сегмент", message: "Ждём", audience: "segment", eventId: jazz.id, eventTitle: jazz.title }, "mail-3", new Date(2026, 8, 30)).detail).toBe("30.09.2026 · сегмент аудитории");
  });

  it("keeps a saved mailing ahead of the mock rows", () => {
    saveMailing({ ...EMPTY_MAILING_DRAFT, subject: "Выходные", message: "Ждём", eventId: jazz.id, eventTitle: jazz.title }, new Date(2026, 8, 30));
    const html = renderToStaticMarkup(createElement(MailingListScreen, { rows: mailingRows(), onBack: () => {}, onCreate: () => {} }));

    expect(html.indexOf("Выходные")).toBeGreaterThan(-1);
    expect(html.indexOf("Выходные")).toBeLessThan(html.indexOf("Анонс новых событий"));
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

describe("mailing screens", () => {
  afterEach(() => {
    resetMailSession();
  });

  it("draws the mailing list from the mock", () => {
    const html = renderToStaticMarkup(createElement(MailingListScreen, { onBack: () => {}, onCreate: () => {} }));

    expect(html).toContain("Рассылка");
    expect(html).toContain("Архивные");
    expect(html).toContain("Отправьте персональное сообщение вашей аудитории");
    expect(html).toContain("Создать рассылку");
    expect(html).toContain("Список рассылок");
    for (const row of MAILING_ROWS) {
      expect(html).toContain(row.title);
      expect(html).toContain(row.detail);
      expect(html).toContain(`Открыто ${row.opened}`);
      expect(html).toContain(`Переходы ${row.clicks}`);
    }
  });

  it("draws the new-mailing form with placeholders, recipients and an event field", () => {
    const html = renderToStaticMarkup(createElement(MailingCreate, { draft: EMPTY_MAILING_DRAFT, block: null, events: [jazz], onChange: () => {}, onSubmit: () => {}, onBack: () => {} }));

    expect(html).toContain("Новая рассылка");
    expect(html).toContain("Тема письма");
    expect(html).toContain('placeholder="Введите тему"');
    expect(html).toContain("Текст сообщения");
    expect(html).toContain("Введите текст");
    expect(html).toContain("0/2000");
    expect(html).toContain("Событие");
    expect(html).toContain("Выберите событие");
    expect(html).toContain("Получатели");
    for (const item of MAIL_AUDIENCES) expect(html).toContain(item.label);
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain("Отправить рассылку");
    expect(html).not.toContain("Вечер джаза");
  });

  it("picks an event from the post-style sheet and shows the sent mailing", async () => {
    function Harness() {
      const [screen, setScreen] = useState<"form" | "list">("form");
      const [draft, setDraft] = useState(EMPTY_MAILING_DRAFT);
      const [rows, setRows] = useState(MAILING_ROWS);
      if (screen === "list") return <MailingListScreen rows={rows} onBack={() => {}} onCreate={() => setScreen("form")} />;
      return (
        <MailingCreate
          draft={draft}
          block={null}
          events={[jazz]}
          onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
          onSubmit={() => {
            if (mailingBlock(draft) !== null) return;
            setRows((current) => [createdMailing(draft, "mail-new", new Date(2026, 8, 30)), ...current]);
            setScreen("list");
          }}
          onBack={() => {}}
        />
      );
    }

    const { host, root } = await mount(createElement(Harness));
    const subject = host.querySelector("input");
    if (subject === null) throw new Error("subject missing");
    await typeInto(subject, "Выходные");
    const body = host.querySelector<HTMLElement>('[aria-label="Текст сообщения"]');
    if (body === null) throw new Error("message missing");
    await act(async () => {
      body.textContent = "Ждём на вечере";
      body.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      buttonNamed(host, "Событие").click();
    });
    expect(host.querySelector('input[placeholder="Название или город"]')).not.toBeNull();
    expect(host.textContent).toContain("Вечер джаза");
    await act(async () => {
      buttonNamed(host, "Вечер джаза").click();
    });
    expect(host.textContent).toContain("Вечер джаза");
    expect(host.textContent).not.toContain("Название или город");
    await act(async () => {
      buttonNamed(host, "Отправить рассылку").click();
    });
    expect(host.textContent).toContain("Список рассылок");
    expect(host.textContent).toContain("Выходные");
    expect(host.textContent).toContain("30.09.2026 · 2 842 получателя");
    expect(host.textContent).toContain("Анонс новых событий");
    await act(async () => {
      root.unmount();
    });
    host.remove();
  });

  it("opens the mailing list from the promotion tab", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = () => Promise.resolve(new Response("[]", { status: 200, headers: { "content-type": "application/json" } }));
    try {
      const { host, root } = await mount(createElement(OrganizerPromotion));
      await act(async () => {
        buttonNamed(host, "Рассылка").click();
      });
      expect(host.textContent).toContain("Список рассылок");
      expect(host.textContent).toContain("Анонс новых событий");
      expect(host.textContent).not.toContain("Мои кампании");
      await act(async () => {
        buttonNamed(host, "Создать рассылку").click();
      });
      expect(host.textContent).toContain("Новая рассылка");
      expect(host.querySelector('input[placeholder="Введите тему"]')).not.toBeNull();
      expect(host.textContent).toContain("Введите текст");
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      await act(async () => {
        root.unmount();
      });
      host.remove();
    } finally {
      globalThis.fetch = original;
    }
  });
});
