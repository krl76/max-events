import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Subscription } from "@max-events/api-contracts";
import { MySubscriptionsView, SUBSCRIPTION_TYPE_LABELS } from "./MySubscriptions";

function subscription(overrides: Partial<Subscription>): Subscription {
  return { id: "d0000008-0000-4000-8000-000000000001", userId: "a0000000-0000-4000-8000-000000000001", type: "organizer", organizerUserId: "d0000001-0000-4000-8000-000000000001", placeId: null, interest: null, title: "Культурный центр", createdAt: "2026-09-12T10:00:00+03:00", ...overrides } as Subscription;
}

const rows = [
  subscription({}),
  subscription({ id: "d0000008-0000-4000-8000-000000000002", type: "place", organizerUserId: null, placeId: "b0000001-0000-4000-8000-000000000001", title: "Парк Горького" }),
  subscription({ id: "d0000008-0000-4000-8000-000000000003", type: "interest", organizerUserId: null, interest: "походы", title: "походы" }),
  subscription({ id: "d0000008-0000-4000-8000-000000000004", type: "user", organizerUserId: null, targetUserId: "a0000000-0000-4000-8000-0000000000b1", title: "Анна Соколова" }),
];

describe("MySubscriptionsView", () => {
  it("names every followed target rather than showing its id", () => {
    const html = renderToStaticMarkup(createElement(MySubscriptionsView, { subscriptions: rows }));

    expect(html).toContain("Культурный центр");
    expect(html).toContain("Парк Горького");
    expect(html).toContain("походы");
    expect(html).toContain("Анна Соколова");
    expect(html).not.toContain("d0000001-0000-4000-8000-000000000001");
    for (const label of Object.values(SUBSCRIPTION_TYPE_LABELS)) expect(html).toContain(label);
  });

  it("gives every follow a way out", () => {
    const html = renderToStaticMarkup(createElement(MySubscriptionsView, { subscriptions: rows }));

    expect(html.match(/Отписаться<\/ion-button>/g)).toHaveLength(rows.length);
  });

  it("blocks the button of the follow being removed, and only that one", () => {
    const html = renderToStaticMarkup(createElement(MySubscriptionsView, { subscriptions: rows, removingId: rows[1]!.id }));

    // Anchored to the row: a counter alone would pass even if the wrong button were blocked.
    expect(html).toMatch(new RegExp(`<ion-button[^>]*disabled[^>]*aria-label="Отписаться: ${rows[1]!.title}"`));
    expect(html).not.toMatch(new RegExp(`<ion-button[^>]*disabled[^>]*aria-label="Отписаться: ${rows[0]!.title}"`));
    expect(html.match(/disabled/g)).toHaveLength(1);
  });

  it("says so when the unsubscribe failed, since the row stays put", () => {
    const html = renderToStaticMarkup(createElement(MySubscriptionsView, { subscriptions: rows, failed: true }));

    expect(html).toContain("Не удалось отписаться.");
    expect(renderToStaticMarkup(createElement(MySubscriptionsView, { subscriptions: rows }))).not.toContain("Не удалось отписаться.");
  });

  it("explains an empty list instead of showing a bare heading", () => {
    const html = renderToStaticMarkup(createElement(MySubscriptionsView, { subscriptions: [] }));

    expect(html).toContain("Мои подписки");
    expect(html).toContain("Пока нет подписок");
    expect(html).not.toContain("Отписаться");
  });
});
