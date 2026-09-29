import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { catalogCards } from "../api/mock";
import { assistNarrowed, browseEmptyCopy, browseTitle, BrowseView, cardsByIds, eventFitsInterests, selectBrowseCards, selectFriendCards, selectSuitableCards } from "./BrowsePage";

const CARDS = catalogCards({ sort: "near" }, { latitude: 55.7522, longitude: 37.6156 });

describe("selectBrowseCards", () => {
  it("keeps events with friends and events that match an interest", () => {
    const bare = CARDS.map((card) => ({ ...card, event: { ...card.event, friendsGoing: [] as { id: string; name: string }[] } }));
    const withFriend = { ...bare[0], event: { ...bare[0].event, friendsGoing: [{ id: bare[0].event.id, name: "Анна" }] } };

    expect(selectBrowseCards([withFriend, ...bare.slice(1)], "friends", []).map((card) => card.event.id)).toEqual([bare[0].event.id]);
    expect(eventFitsInterests({ category: "sport", title: "Матч", description: "" }, ["спорт"])).toBe(true);
    expect(eventFitsInterests({ category: "afisha", title: "Опера", description: "Вечер" }, ["спорт"])).toBe(false);
    expect(selectBrowseCards(CARDS, "suitable", ["йога"]).every((card) => eventFitsInterests(card.event, ["йога"]))).toBe(true);
    expect(selectBrowseCards(CARDS, "nearby", ["йога"])).toHaveLength(CARDS.length);
    const hinted = { ...bare[1], labels: [{ kind: "friend_attending" as const, friendName: "Катя" }] };
    expect(selectFriendCards(bare, [hinted]).map((card) => card.event.id)).toEqual([bare[1].event.id]);
    const personal = { summary: { nearbyCount: 9, suitableCount: 1, withFriendsCount: 0 }, cards: [hinted] };
    expect(selectSuitableCards(bare, [], personal).map((card) => card.event.id)).toEqual([bare[1].event.id]);
    expect(selectSuitableCards(bare, [], { summary: { nearbyCount: bare.length, suitableCount: bare.length, withFriendsCount: 0 }, cards: [hinted] })).toHaveLength(bare.length);
    const buckets = { nearbyIds: [bare[0]!.event.id, bare[2]!.event.id], suitableIds: [bare[2]!.event.id], friendIds: [bare[2]!.event.id] };
    const counted = { summary: { nearbyCount: 2, suitableCount: 1, withFriendsCount: 1 }, cards: [], buckets };
    expect(cardsByIds(bare, buckets.nearbyIds).map((card) => card.event.id)).toEqual(buckets.nearbyIds);
    expect(selectBrowseCards(bare, "nearby", [], counted).map((card) => card.event.id)).toEqual(buckets.nearbyIds);
    expect(selectBrowseCards([withFriend, ...bare.slice(1)], "friends", [], counted).map((card) => card.event.id)).toEqual([bare[2]!.event.id]);
    expect(selectBrowseCards(bare, "suitable", ["йога"], counted).map((card) => card.event.id)).toEqual([bare[2]!.event.id]);
  });

  it("names each list and says a query missed", () => {
    expect(browseTitle("nearby")).toBe("Сегодня рядом");
    expect(browseTitle("nearby", undefined, "2026-09-18")).toBe("18 сентября");
    expect(browseTitle("suitable")).toBe("Подходят тебе");
    expect(browseTitle("friends")).toBe("С друзьями");
    expect(browseTitle("results", "джаз")).toBe("джаз");
    expect(browseEmptyCopy("results", "джаз")).toBe("Ничего не нашлось по запросу «джаз».");
    const open = { when: "any" as const, budgetMaxRub: null, company: "alone" as const, genre: "any" as const };
    expect(assistNarrowed(open)).toBe(false);
    expect(assistNarrowed({ ...open, genre: "volunteering" })).toBe(true);
  });
});

describe("BrowseView", () => {
  it("offers other events when a query finds nothing", () => {
    const html = renderToStaticMarkup(
      createElement(BrowseView, {
        list: "results",
        query: "кварк",
        state: {
          status: "ready",
          cards: [],
          suggesting: false,
          suggestions: [
            { card: CARDS[0]!, reason: "Похоже на запрос" },
            { card: CARDS[1]!, reason: null },
          ],
        },
        inCity: true,
        onOpen: () => {},
        onBack: () => {},
        onRetry: () => {},
      }),
    );

    expect(html).toContain("Ничего не нашлось по запросу «кварк».");
    expect(html).toContain("Похожее");
    expect(html).toContain("Похоже на запрос");
    expect(html).toContain(CARDS[0].event.title);
    expect(html).toContain(CARDS[1].event.title);
    expect(html).not.toContain("Может подойти");
  });

  it("lists the events of a stat without the suggestion block", () => {
    const html = renderToStaticMarkup(createElement(BrowseView, { list: "nearby", state: { status: "ready", cards: CARDS.slice(0, 1), suggestions: [], suggesting: false }, inCity: true, onOpen: () => {}, onBack: () => {}, onRetry: () => {} }));

    expect(html).toContain('aria-label="Назад"');
    expect(html).toContain("Сегодня рядом");
    expect(html).toContain(CARDS[0].event.title);
    expect(html).not.toContain("Похожее");
    expect(html).not.toContain("Ничего не нашлось");
  });
});
