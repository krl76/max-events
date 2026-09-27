import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { catalogCards } from "../api/mock";
import { browseEmptyCopy, browseTitle, BrowseView, eventFitsInterests, selectBrowseCards, selectFriendCards, selectSuitableCards } from "./BrowsePage";

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
  });

  it("names each list and says a query missed", () => {
    expect(browseTitle("nearby")).toBe("Сегодня рядом");
    expect(browseTitle("suitable")).toBe("Подходят тебе");
    expect(browseTitle("friends")).toBe("С друзьями");
    expect(browseTitle("results", "джаз")).toBe("джаз");
    expect(browseEmptyCopy("results", "джаз")).toBe("Ничего не нашлось по запросу «джаз».");
  });
});

describe("BrowseView", () => {
  it("offers other events when a query finds nothing", () => {
    const html = renderToStaticMarkup(createElement(BrowseView, { list: "results", query: "кварк", state: { status: "ready", cards: [], suggestions: CARDS.slice(0, 2) }, inCity: true, onOpen: () => {}, onBack: () => {}, onRetry: () => {} }));

    expect(html).toContain("Ничего не нашлось по запросу «кварк».");
    expect(html).toContain("Может подойти");
    expect(html).toContain(CARDS[0].event.title);
    expect(html).toContain(CARDS[1].event.title);
  });

  it("lists the events of a stat without the suggestion block", () => {
    const html = renderToStaticMarkup(createElement(BrowseView, { list: "nearby", state: { status: "ready", cards: CARDS.slice(0, 1), suggestions: [] }, inCity: true, onOpen: () => {}, onBack: () => {}, onRetry: () => {} }));

    expect(html).toContain('aria-label="Назад"');
    expect(html).toContain("Сегодня рядом");
    expect(html).toContain(CARDS[0].event.title);
    expect(html).not.toContain("Может подойти");
    expect(html).not.toContain("Ничего не нашлось");
  });
});
