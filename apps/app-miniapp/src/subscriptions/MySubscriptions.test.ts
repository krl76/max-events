import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Friend, Subscription } from "@max-events/api-contracts";
import { groupSubscriptions, MySubscriptionsView, PEOPLE_SUBSCRIPTION_NOTE, SUBSCRIPTION_TYPE_LABELS, subscriptionFilterLabel, SubscriptionsView } from "./MySubscriptions";

function subscription(overrides: Partial<Subscription>): Subscription {
  return { id: "d0000008-0000-4000-8000-000000000001", userId: "a0000000-0000-4000-8000-000000000001", type: "organizer", organizerUserId: "d0000001-0000-4000-8000-000000000001", placeId: null, interest: null, title: "Культурный центр", createdAt: "2026-09-12T10:00:00+03:00", ...overrides } as Subscription;
}

const rows = [subscription({}), subscription({ id: "d0000008-0000-4000-8000-000000000002", type: "place", organizerUserId: null, placeId: "b0000001-0000-4000-8000-000000000001", title: "Парк Горького" }), subscription({ id: "d0000008-0000-4000-8000-000000000003", type: "interest", organizerUserId: null, interest: "походы", title: "походы" })];

const people: Friend[] = [
  { id: "a0000000-0000-4000-8000-0000000000b1", name: "Анна Соколова", avatarUrl: null },
  { id: "a0000000-0000-4000-8000-0000000000b2", name: "Дима Кузнецов", avatarUrl: null },
];

describe("MySubscriptionsView", () => {
  it("names every followed target rather than showing its id", () => {
    const html = renderToStaticMarkup(createElement(MySubscriptionsView, { subscriptions: rows }));

    expect(html).toContain("Культурный центр");
    expect(html).toContain("Парк Горького");
    expect(html).toContain("походы");
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

describe("groupSubscriptions", () => {
  it("splits the follows into organizers, places and interests, in that order", () => {
    expect(groupSubscriptions(rows).map((group) => group.type)).toEqual(["organizer", "place", "interest"]);
    expect(groupSubscriptions(rows).map((group) => group.rows.length)).toEqual([1, 1, 1]);
  });

  it("drops a group nobody follows rather than printing a zero", () => {
    expect(groupSubscriptions([rows[1]!]).map((group) => group.type)).toEqual(["place"]);
  });
});

describe("subscriptionFilterLabel", () => {
  it("counts the follows on the all-chip and names the type on the others", () => {
    expect(subscriptionFilterLabel("all", rows)).toBe("Все · 3");
    expect(subscriptionFilterLabel("organizer", rows)).toBe("Организаторы");
    expect(subscriptionFilterLabel("interest", rows)).toBe("Интересы");
  });

  it("counts the people into the all-chip too: one word over the screen, one number under it", () => {
    expect(subscriptionFilterLabel("all", rows, people.length)).toBe("Все · 5");
    expect(subscriptionFilterLabel("people", rows, people.length)).toBe("Люди");
  });
});

describe("SubscriptionsView", () => {
  it("heads every group with its own count and gives every follow a way out", () => {
    const html = renderToStaticMarkup(createElement(SubscriptionsView, { subscriptions: rows }));

    expect(html).toContain("Организаторы · 1");
    expect(html).toContain("Места · 1");
    expect(html).toContain("Интересы · 1");
    expect(html.match(/aria-label="Отписаться: /g)).toHaveLength(rows.length);
  });

  it("says where the people group comes from, since it is not one of the three types", () => {
    const html = renderToStaticMarkup(createElement(SubscriptionsView, { subscriptions: rows }));

    expect(html).toContain(PEOPLE_SUBSCRIPTION_NOTE);
  });

  it("gives the people the viewer follows their own group, heading and way out", () => {
    const html = renderToStaticMarkup(createElement(SubscriptionsView, { subscriptions: rows, people }));

    expect(html).toContain("Люди · 2");
    expect(html).toContain("Анна Соколова");
    expect(html).toContain('aria-label="Отписаться: Анна Соколова"');
    expect(html.match(/aria-label="Отписаться: /g)).toHaveLength(rows.length + people.length);
  });

  it("drops the people group when the viewer follows nobody, rather than heading a zero", () => {
    const html = renderToStaticMarkup(createElement(SubscriptionsView, { subscriptions: rows, people: [] }));

    expect(html).not.toContain("Люди ·");
  });

  it("narrows to the people alone when their chip is pressed", () => {
    const html = renderToStaticMarkup(createElement(SubscriptionsView, { subscriptions: rows, people, filter: "people" }));

    expect(html).toContain("Люди · 2");
    expect(html).not.toContain("Культурный центр");
    expect(html).not.toContain("Организаторы · 1");
  });

  it("narrows to one type when a filter chip is pressed", () => {
    const html = renderToStaticMarkup(createElement(SubscriptionsView, { subscriptions: rows, filter: "place" }));

    expect(html).toContain("Парк Горького");
    expect(html).not.toContain("Культурный центр");
    expect(html).toContain("Места · 1");
  });

  it("leads to a place, which has a screen, and leaves the other two as plain rows", () => {
    const html = renderToStaticMarkup(createElement(SubscriptionsView, { subscriptions: rows, onOpenPlace: () => {} }));

    expect(html.match(/app-subs-target--link/g)).toHaveLength(1);
    expect(html).toMatch(/<button[^>]*app-subs-target--link[^>]*>[\s\S]*?Парк Горького/);
  });

  it("blocks the button of the follow being removed, and only that one", () => {
    const html = renderToStaticMarkup(createElement(SubscriptionsView, { subscriptions: rows, removingId: rows[1]!.id }));

    expect(html).toMatch(new RegExp(`<button[^>]*disabled[^>]*aria-label="Отписаться: ${rows[1]!.title}"`));
    expect(html).not.toMatch(new RegExp(`<button[^>]*disabled[^>]*aria-label="Отписаться: ${rows[0]!.title}"`));
  });

  it("explains an empty screen and still says where people subscriptions live", () => {
    const html = renderToStaticMarkup(createElement(SubscriptionsView, { subscriptions: [] }));

    expect(html).toContain("Пока нет подписок");
    expect(html).toContain(PEOPLE_SUBSCRIPTION_NOTE);
    expect(html).not.toContain('aria-label="Отписаться: ');
  });
});
