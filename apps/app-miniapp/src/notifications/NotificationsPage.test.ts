import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { mockNotifications, resetMockNotifications } from "../api/mock";
import { NotificationsView, type NotificationsQuietHours, type NotificationsState } from "./NotificationsPage";

const noop = () => {};
const QUIET: NotificationsQuietHours = { enabled: true, from: "23:00", to: "09:00" };

function view(state: NotificationsState, quietHours: NotificationsQuietHours | null = QUIET): string {
  return renderToStaticMarkup(createElement(NotificationsView, { state, quietHours, onClose: noop, onRetry: noop, onAct: noop, onOpen: noop, onToggleQuietHours: noop }));
}

const ready = (): NotificationsState => ({ status: "ready", notifications: mockNotifications() });

describe("NotificationsView", () => {
  afterEach(() => {
    resetMockNotifications();
  });

  it("draws the bell and the title, and leaves closing to the native back button", () => {
    const html = view(ready());

    expect(html).toContain("Уведомления");
    expect(html).not.toContain('aria-label="Закрыть"');
    expect(html).toContain("app-notify-top-icon");
  });

  it("splits the inbox into the two sections of the design", () => {
    const html = view(ready());

    expect(html).toContain("Требует решения");
    expect(html).toContain("Раньше");
    expect(html.indexOf("Требует решения")).toBeLessThan(html.indexOf("Раньше"));
  });

  it("renders the four decision cards with their bodies and pills", () => {
    const html = view(ready());

    expect(html).toContain("Концерт The Weekend через 1 ч 40 мин");
    expect(html).toContain("Дима уже вышел из дома.");
    expect(html).toContain("Посмотреть маршрут");
    expect(html).toContain("Перенести под навес");
    expect(html).toContain("Оставить как есть");
    expect(html).toContain("Выбрать беседку с навесом");
  });

  it("washes only the card that asks to choose between two answers", () => {
    const html = view(ready());

    expect(html.match(/app-notify-card--choice/g)).toHaveLength(1);
    expect(html).toContain("Дождь начнётся к 19:00");
  });

  it("counts the waitlist offer down on its own pill", () => {
    const html = view(ready());

    expect(html).toContain("Освободилось место на корт в Лужниках");
    expect(html).toMatch(/Занять слот · 1[34]:\d{2}/);
  });

  it("writes the history rows with the actor bolded, the quote muted and a short stamp", () => {
    const html = view(ready());

    expect(html).toContain("записалась на джаз в «Эссе» — сегодня в 20:00");
    expect(html).toContain('class="app-notify-row-actor">Анна');
    expect(html).toContain("В плане «Мангал в Горьком» новое сообщение:");
    expect(html).toContain('class="app-notify-row-quote"> кто берёт лимонад?');
    expect(html).toContain("Достижение «Собиратель»: 30 компаний собрано");
    expect(html).toContain("2 дня");
  });

  it("carries the quiet-hours switch of экран 41 with its window and its state", () => {
    const html = view(ready());

    expect(html).toContain("Тихие часы 23:00–09:00");
    expect(html).toContain("Только срочное: брони и отмены");
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain("app-notify-switch--on");
  });

  it("leaves the quiet-hours row out while the settings have not arrived", () => {
    const html = view(ready(), null);

    expect(html).not.toContain("Тихие часы");
    expect(html).toContain("Требует решения");
  });

  it("renders the loading, error and empty states", () => {
    expect(view({ status: "loading" })).toContain("app-skeleton");
    expect(view({ status: "error" })).toContain("Не удалось загрузить уведомления.");

    const empty = view({ status: "ready", notifications: [] });
    expect(empty).toContain("Новых уведомлений нет");
    expect(empty).not.toContain("Требует решения");
  });
});
