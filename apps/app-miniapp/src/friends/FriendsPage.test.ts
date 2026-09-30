import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { FriendActivityByFriend } from "@max-events/api-contracts";
import { activeFriends, friendNowLine, friendsInvitePayload, friendsPeopleLabel, initials, FriendsView, type FriendsState } from "./FriendsPage";
import { personGradient, personLetter } from "./avatar";
import { friendActivityByFriend, mockEvents, mockFriends } from "../api/mock";

const noop = () => {};
const NOW = new Date("2026-09-19T12:00:00+03:00");
const HOUR = 60 * 60 * 1000;

function group(startsAt: string, participationStatus: FriendActivityByFriend["events"][number]["participationStatus"] = "going", index = 0): FriendActivityByFriend {
  return { friend: mockFriends[index], events: [{ event: { ...mockEvents[0], startsAt }, participationStatus }] };
}

function state(over: Partial<Extract<FriendsState, { status: "ready" }>> = {}): FriendsState {
  return { status: "ready", friends: mockFriends, groups: friendActivityByFriend(), ...over };
}

describe("initials and the avatar disc", () => {
  it("still gives two letters where the old avatar is used, and one on the disc", () => {
    expect(initials("Анна Соколова")).toBe("АС");
    expect(personLetter("анна соколова")).toBe("А");
  });

  it("keeps a colour attached to the person, not to their place in a list", () => {
    expect(personGradient(mockFriends[0].id)).toBe(personGradient(mockFriends[0].id));
    expect(personGradient(mockFriends[0].id)).toBeLessThan(5);
  });
});

describe("friendNowLine", () => {
  it("builds the three lines of the design out of the status and the clock", () => {
    expect(friendNowLine(group(new Date(NOW.getTime() - HOUR).toISOString()), NOW)).toBe(`На «${mockEvents[0].title}»`);
    expect(friendNowLine(group(new Date(NOW.getTime() + 26 * HOUR).toISOString()), NOW)).toBe(`Идёт на «${mockEvents[0].title}» завтра`);
    expect(friendNowLine(group(new Date(NOW.getTime() + 5 * HOUR).toISOString(), "looking_for_company"), NOW)).toBe(`Собирает компанию на «${mockEvents[0].title}»`);
  });

  it("has nothing to say about a friend with no events at all", () => {
    expect(friendNowLine({ friend: mockFriends[0], events: [] }, NOW)).toBeNull();
  });
});

describe("activeFriends", () => {
  it("keeps only what happens within the next two days, soonest first", () => {
    const soon = group(new Date(NOW.getTime() + 5 * HOUR).toISOString(), "going", 0);
    const tomorrow = group(new Date(NOW.getTime() + 26 * HOUR).toISOString(), "going", 1);
    const far = group(new Date(NOW.getTime() + 20 * 24 * HOUR).toISOString(), "going", 2);

    expect(activeFriends([far, tomorrow, soon], NOW).map((entry) => entry.friend.id)).toEqual([mockFriends[0].id, mockFriends[1].id]);
  });

  it("keeps the group short so «ВСЕ ДРУЗЬЯ» below it does not disappear", () => {
    const busy = mockFriends.slice(0, 6).map((_, index) => group(new Date(NOW.getTime() + (index + 1) * HOUR).toISOString(), "going", index));

    const active = activeFriends(busy, NOW);

    expect(active).toHaveLength(3);
    // Срез берёт ближайших, а не первых попавшихся.
    expect(active.map((entry) => entry.friend.id)).toEqual(mockFriends.slice(0, 3).map((friend) => friend.id));
  });
});

describe("FriendsView", () => {
  const view = (value: FriendsState) => renderToStaticMarkup(createElement(FriendsView, { state: value, now: NOW, onOpenFriend: noop, onOpenDiscovery: noop, onOpenPeople: noop, onInvite: noop, onRetry: noop }));

  it("renders the counter topbar without a contacts sync row", () => {
    const html = view(state());

    expect(html).toContain("Друзья");
    expect(html).toContain(`>${mockFriends.length}<`);
    expect(html).not.toContain("Контакты MAX");
    expect(html).toContain("Места, где друзья уже были");
  });

  it("invites a friend through a MAX chat link instead of explaining the graph in gray", () => {
    const html = view(state());

    expect(html).toContain("Пригласить в MAX");
    expect(html).toContain("app-friends-invite");
    expect(html).not.toContain("app-friends-rule");
    expect(html).not.toContain("кто добавил вас в ответ");
    expect(friendsInvitePayload("u1")).toEqual({ text: "Добавь меня в друзья в Афише MAX", link: "https://max.ru/t691_hakaton_max_bot?startapp=user-u1" });
  });

  it("carries the entries to «Друзья открыли» and «Люди рядом» itself", () => {
    const html = view(state());

    expect(html).toContain("Друзья открыли");
    expect(html).toContain("Люди рядом");
    expect(friendsPeopleLabel(false)).toBe("Люди в городе");
  });

  it("names the active group with its count and lists everyone else below", () => {
    const soon = group(new Date(NOW.getTime() + 5 * HOUR).toISOString(), "going", 0);
    const html = view(state({ groups: [soon] }));

    expect(html).toContain("Сейчас что-то делают · 1");
    expect(html).toContain("Все друзья");
    expect(html).toContain(mockEvents[0].title);
  });

  it("shows nobody twice: an active friend does not repeat in the list below", () => {
    const soon = group(new Date(NOW.getTime() + 5 * HOUR).toISOString(), "going", 0);
    const html = view(state({ groups: [soon] }));

    expect([...html.matchAll(new RegExp(mockFriends[0].name, "g"))]).toHaveLength(1);
  });

  it("hides the active group when nobody is up to anything", () => {
    const html = view(state({ groups: [] }));

    expect(html).not.toContain("Сейчас что-то делают");
    expect(html).toContain("Все друзья");
  });

  it("explains an empty graph without a contact sync row", () => {
    const html = view(state({ friends: [], groups: [] }));

    expect(html).toContain("Друзей пока нет");
    expect(html).toContain("Друзья открыли");
    expect(html).toContain("Пригласить в MAX");
    expect(html).not.toContain("Обновить");
    expect(html).not.toContain("Контакты MAX");
    expect(html).not.toContain("Все друзья");
  });

  it("renders loading and error states", () => {
    expect(view({ status: "loading" })).toContain("app-skeleton");
    expect(view({ status: "error" })).toContain("Не удалось загрузить друзей.");
  });
});
