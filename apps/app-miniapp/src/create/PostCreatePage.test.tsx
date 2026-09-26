import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Friend } from "@max-events/api-contracts";
import { POST_AUDIENCES } from "../api/client";
import { mockEvents, mockFriends, mockPlaces } from "../api/mock";
import { firstNameOf, PostCreateView, POST_PHOTO_LIMIT, postDateLine, postDraftOf, postDraftReady, postEventLine, postFriendsLine, postPayload, type PostComposeDraft } from "./PostCreatePage";

// Локальное время без смещения: «Сб, 19 сен · 14:00» обязано читаться одинаково в любой зоне прогона.
const STARTS_AT = "2026-09-19T14:00:00";
const USER_ID = "a0000000-0000-4000-8000-000000000001";

const draftOf = (over: Partial<PostComposeDraft> = {}): PostComposeDraft => ({ text: "", photoUrls: [], eventId: null, placeId: null, pinLabel: null, taggedFriendIds: [], audience: "friends", allowJoin: false, ...over });

const friend = (name: string, id: string): Friend => ({ id, name, avatarUrl: null });

describe("post event line of the design", () => {
  it("prints the weekday, the short month and the hour the way the design does", () => {
    expect(postDateLine(STARTS_AT)).toBe("Сб, 19 сен · 14:00");
  });

  it("pads the hour, so 09:05 never reads as 9:5", () => {
    expect(postDateLine("2026-09-19T09:05:00")).toBe("Сб, 19 сен · 09:05");
  });

  it("adds the binding the design spells out under the event title", () => {
    expect(postEventLine(STARTS_AT)).toBe("Сб, 19 сен · 14:00 · привязано к посту");
  });
});

describe("postFriendsLine", () => {
  it("names nobody until somebody is tagged", () => {
    expect(postFriendsLine([])).toBe("Отметить друзей");
  });

  it("names the tagged friends by first name, as «Анна, Дима» of the design", () => {
    expect(postFriendsLine([friend("Анна Соколова", "f1"), friend("Дима Кузнецов", "f2")])).toBe("Отметить друзей · Анна, Дима");
  });

  it("keeps a one-word name whole instead of losing it to the split", () => {
    expect(firstNameOf("Анна")).toBe("Анна");
  });
});

describe("postDraftReady", () => {
  it("publishes text without an event", () => {
    expect(postDraftReady(draftOf({ text: "Собираемся" }))).toBe(true);
  });

  it("refuses a post whose text is only spaces", () => {
    expect(postDraftReady(draftOf({ eventId: mockEvents[0].id, text: "   " }))).toBe(false);
  });

  it("accepts a bound event with text", () => {
    expect(postDraftReady(draftOf({ eventId: mockEvents[0].id, text: "Собираемся" }))).toBe(true);
  });
});

describe("postPayload", () => {
  it("sends the first photo as the one the backend stores and the whole grid beside it (#502)", () => {
    const payload = postPayload(draftOf({ text: " Собираемся ", photoUrls: ["data:image/jpeg;base64,a", "data:image/jpeg;base64,b"] }), USER_ID, mockEvents[0].id);

    expect(payload.text).toBe("Собираемся");
    expect(payload.photoUrl).toBe("data:image/jpeg;base64,a");
    expect(payload.photoUrls).toHaveLength(2);
  });

  it("carries the place, the tagged friends, the audience and the join switch of the design", () => {
    const payload = postPayload(draftOf({ text: "Собираемся", placeId: mockPlaces[0].id, taggedFriendIds: [mockFriends[0].id], audience: "company", allowJoin: true }), USER_ID, mockEvents[0].id);

    expect(payload.placeId).toBe(mockPlaces[0].id);
    expect(payload.taggedFriendIds).toEqual([mockFriends[0].id]);
    expect(payload.audience).toBe("company");
    expect(payload.allowJoin).toBe(true);
  });

  it("answers a null photo for a post without one, rather than an empty string url", () => {
    expect(postPayload(draftOf({ text: "Собираемся" }), USER_ID, mockEvents[0].id).photoUrl).toBeNull();
  });
});

describe("postDraftOf", () => {
  it("saves a draft that has no event yet, since a draft is savable long before it is publishable", () => {
    const draft = postDraftOf(draftOf({ text: "Собираемся" }), USER_ID);

    expect(draft.eventId).toBeNull();
    expect(draft.userId).toBe(USER_ID);
    expect(draft.text).toBe("Собираемся");
  });
});

describe("PostCreateView", () => {
  const noop = () => {};
  const view = (over: Partial<Parameters<typeof PostCreateView>[0]> = {}) =>
    renderToStaticMarkup(
      createElement(PostCreateView, {
        draft: draftOf({ eventId: mockEvents[0].id, text: "Собираемся" }),
        authorName: "Кирилл Соколов",
        events: [{ ...mockEvents[0], title: "Мангальная зона в парке Горького", startsAt: STARTS_AT }],
        places: mockPlaces,
        friends: mockFriends,
        state: "idle" as const,
        photoRejected: false,
        draftSaved: true,
        onDraft: noop,
        onPickPhoto: noop,
        onPublish: noop,
        onClose: noop,
        ...over,
      }),
    );

  it("draws the header, the bound event, the audience chips and the join switch of the design", () => {
    const html = view();

    expect(html).toContain("Новый пост");
    expect(html).toContain("Опубликовать");
    expect(html).toContain("Мангальная зона в парке Горького");
    expect(html).toContain("Сб, 19 сен · 14:00 · привязано к посту");
    for (const audience of POST_AUDIENCES) expect(html).toContain(audience.label);
    expect(html).toContain("Разрешить запись через пост");
    expect(html).toContain("Друзья смогут присоединиться одним тапом");
  });

  it("offers one photo slot until the grid of the design is full", () => {
    const full = view({ draft: draftOf({ eventId: mockEvents[0].id, text: "Собираемся", photoUrls: Array.from({ length: POST_PHOTO_LIMIT }, (_, index) => `data:image/jpeg;base64,${index}`) }) });

    expect(view()).toContain("app-post-compose-add");
    expect(full).not.toContain("app-post-compose-add");
    expect(full.match(/app-post-compose-shot-drop/g)).toHaveLength(POST_PHOTO_LIMIT);
  });

  it("holds the switch off until the author turns it on", () => {
    expect(view()).toContain('aria-checked="false"');
    expect(view({ draft: draftOf({ eventId: mockEvents[0].id, text: "Собираемся", allowJoin: true }) })).toContain('aria-checked="true"');
  });

  it("offers to bind an event while none is bound, instead of showing an empty card", () => {
    const html = view({ draft: draftOf() });

    expect(html).toContain("Привязать событие");
    expect(html).not.toContain("привязано к посту");
  });

  it("keeps «Черновик сохранён» out until a save actually happened", () => {
    expect(view({ draftSaved: false })).not.toContain("Черновик сохранён");
    expect(view()).toContain("Черновик сохранён");
  });

  it("says out loud that the publication failed instead of returning to an idle button", () => {
    expect(view({ state: "error" })).toContain("Не удалось опубликовать пост");
  });
});
