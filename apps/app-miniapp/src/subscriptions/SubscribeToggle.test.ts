import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Subscription } from "@max-events/api-contracts";
import { matchesSubscriptionTarget, SubscribeToggleView } from "./SubscribeToggle";

const organizerId = "d0000001-0000-4000-8000-000000000001";
const placeId = "b0000001-0000-4000-8000-000000000001";

function subscription(overrides: Partial<Subscription>): Subscription {
  return { id: "d0000008-0000-4000-8000-000000000001", userId: "a0000000-0000-4000-8000-000000000001", type: "organizer", organizerUserId: organizerId, placeId: null, interest: null, title: "Культурный центр", createdAt: "2026-09-12T10:00:00+03:00", ...overrides } as Subscription;
}

function viewHtml(over: { state?: Parameters<typeof SubscribeToggleView>[0]["state"]; busy?: boolean; failed?: boolean } = {}): string {
  return renderToStaticMarkup(
    createElement(SubscribeToggleView, {
      state: over.state ?? { status: "ready", subscriptionId: null },
      subscribeLabel: "Подписаться на организатора",
      unsubscribeLabel: "Отписаться от организатора",
      busy: over.busy,
      failed: over.failed,
    }),
  );
}

describe("matchesSubscriptionTarget", () => {
  it("matches a follow to its own target and to nothing else", () => {
    expect(matchesSubscriptionTarget(subscription({}), { type: "organizer", organizerUserId: organizerId })).toBe(true);
    expect(matchesSubscriptionTarget(subscription({ type: "user", organizerUserId: null, targetUserId: organizerId }), { type: "user", userId: organizerId })).toBe(true);
    expect(matchesSubscriptionTarget(subscription({}), { type: "organizer", organizerUserId: placeId })).toBe(false);
    // Same uuid, different kind of target: a place follow is not an organizer follow.
    expect(matchesSubscriptionTarget(subscription({}), { type: "place", placeId: organizerId })).toBe(false);
  });

  it("compares an interest case-insensitively, like the backend does", () => {
    const interest = subscription({ type: "interest", organizerUserId: null, interest: "Походы", title: "Походы" });
    expect(matchesSubscriptionTarget(interest, { type: "interest", interest: "походы" })).toBe(true);
    expect(matchesSubscriptionTarget(interest, { type: "interest", interest: "джаз" })).toBe(false);
  });
});

describe("SubscribeToggleView", () => {
  it("offers to follow when the viewer does not yet", () => {
    const html = viewHtml();

    expect(html).toContain("Подписаться на организатора");
    expect(html).not.toContain("Отписаться");
  });

  it("offers the way out once the viewer follows", () => {
    const html = viewHtml({ state: { status: "ready", subscriptionId: "d0000008-0000-4000-8000-000000000001" } });

    expect(html).toContain("Отписаться от организатора");
    expect(html).toMatch(/aria-pressed/);
  });

  it("waits instead of guessing a label it does not know yet", () => {
    // A button that says «Подписаться» and flips to «Отписаться» a moment later invites a double tap.
    const html = viewHtml({ state: { status: "loading" } });

    expect(html).toContain("Проверяем подписку…");
    expect(html).not.toContain("Подписаться на организатора");
    expect(html).toContain("disabled");
  });

  it("says the state is unknown rather than claiming the viewer does not follow", () => {
    // «Подписаться» after a failed read is a lie to a follower: they press it, the label flips to
    // «Отписаться», they press again to undo — and lose the subscription they came in with.
    const html = viewHtml({ state: { status: "failed" } });

    expect(html).toContain("Не удалось проверить подписку.");
    expect(html).toContain("Повторить");
    expect(html).not.toContain("Подписаться на организатора");
    expect(html).not.toContain("Отписаться от организатора");
  });

  it("blocks a second tap while the change is in flight and reports a failure", () => {
    expect(viewHtml({ busy: true })).toContain("disabled");
    expect(viewHtml({ failed: true })).toContain("Не удалось изменить подписку.");
    expect(viewHtml()).not.toContain("Не удалось изменить подписку.");
  });
});
