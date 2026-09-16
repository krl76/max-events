import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FriendsView, initials } from "./FriendsPage";
import { friendActivityByFriend, mockEvents, resetMockParticipations } from "../api/mock";

const fixture = () => {
  resetMockParticipations();
  return friendActivityByFriend();
};

describe("initials", () => {
  it("builds two-letter initials from a full name", () => {
    expect(initials("Анна Соколова")).toBe("АС");
  });

  it("falls back to a single letter for a one-word name", () => {
    expect(initials("Анна")).toBe("А");
  });
});

describe("FriendsView", () => {
  it("renders the README showcase friends with their events and statuses", () => {
    const groups = fixture();
    const html = renderToStaticMarkup(createElement(FriendsView, { state: { status: "ready", groups }, onJoin: () => {} }));

    expect(html).toContain("Анна Соколова");
    expect(html).toContain(mockEvents[1].title);
    expect(html).toContain("Дима Кузнецов");
    expect(html).toContain(mockEvents[5].title);
    expect(html).toContain("Катя Орлова");
    expect(html).toContain(mockEvents[11].title);
    expect(html).toContain("Ищу компанию");
  });

  it("puts the friend with the soonest event first (Анна → выставка)", () => {
    const groups = fixture();

    expect(groups[0].friend.name).toBe("Анна Соколова");
    expect(groups[0].events[0].event.id).toBe(mockEvents[1].id);
  });

  it("sorts groups by the soonest event of each friend", () => {
    const groups = fixture();
    const soonest = groups.map((group) => group.events[0].event.startsAt);

    expect([...soonest].sort((a, b) => a.localeCompare(b))).toEqual(soonest);
  });

  it("renders a join CTA per attended event", () => {
    const groups = fixture();
    const total = groups.reduce((count, group) => count + group.events.length, 0);
    const html = renderToStaticMarkup(createElement(FriendsView, { state: { status: "ready", groups }, onJoin: () => {} }));

    expect(total).toBeGreaterThan(0);
    expect(html.match(/Присоединиться/g)).toHaveLength(total);
  });

  it("renders the empty state without cards", () => {
    const html = renderToStaticMarkup(createElement(FriendsView, { state: { status: "ready", groups: [] }, onJoin: () => {} }));

    expect(html).toContain("Пока никто из друзей никуда не идёт");
    expect(html).not.toContain("Присоединиться");
    expect(html).not.toContain("app-friends-avatar");
  });

  it("renders loading and error states", () => {
    const loading = renderToStaticMarkup(createElement(FriendsView, { state: { status: "loading" }, onJoin: () => {} }));
    const error = renderToStaticMarkup(createElement(FriendsView, { state: { status: "error" }, onJoin: () => {} }));

    expect(loading).toContain("Загрузка…");
    expect(error).toContain("app-state--error");
    expect(error).toContain("Не удалось загрузить события друзей");
  });
});
