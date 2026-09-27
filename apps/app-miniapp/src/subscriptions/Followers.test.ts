import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Friend } from "@max-events/api-contracts";
import { FollowersView, followersCountLabel, personInitial } from "./Followers";

const followers: Friend[] = [
  { id: "a0000000-0000-4000-8000-0000000000b1", name: "Анна Соколова", avatarUrl: null },
  { id: "a0000000-0000-4000-8000-0000000000b2", name: "Дима Кузнецов", avatarUrl: null },
  { id: "a0000000-0000-4000-8000-0000000000b4", name: "Пётр Новиков", avatarUrl: null },
];

describe("personInitial", () => {
  it("takes the letter of the name, uppercased, so the row has a face without a photograph", () => {
    expect(personInitial("Анна Соколова")).toBe("А");
    expect(personInitial("  дима")).toBe("Д");
  });
});

describe("followersCountLabel", () => {
  it("declines the counter for its number", () => {
    expect(followersCountLabel(1)).toBe("1 подписчик");
    expect(followersCountLabel(3)).toBe("3 подписчика");
    expect(followersCountLabel(8)).toBe("8 подписчиков");
  });
});

describe("FollowersView", () => {
  it("names every follower and counts them over the list", () => {
    const html = renderToStaticMarkup(createElement(FollowersView, { followers }));

    expect(html).toContain("3 подписчика");
    expect(html).toContain("Анна Соколова");
    expect(html).toContain("Пётр Новиков");
    expect(html).not.toContain("a0000000-0000-4000-8000-0000000000b1");
  });

  it("offers a follow back to everyone the viewer does not follow yet", () => {
    const html = renderToStaticMarkup(createElement(FollowersView, { followers, followingIds: [followers[0]!.id] }));

    expect(html).toContain("Друзья");
    expect(html.match(/aria-label="Добавить: /g)).toHaveLength(2);
    expect(html).not.toContain('aria-label="Добавить: Анна Соколова"');
  });

  it("blocks the button of the person being followed right now, and only that one", () => {
    const html = renderToStaticMarkup(createElement(FollowersView, { followers, pendingId: followers[1]!.id }));

    expect(html).toMatch(new RegExp(`<button[^>]*disabled[^>]*aria-label="Добавить: ${followers[1]!.name}"`));
    expect(html).not.toMatch(new RegExp(`<button[^>]*disabled[^>]*aria-label="Добавить: ${followers[0]!.name}"`));
  });

  it("says so when the follow failed, since the button stays where it was", () => {
    expect(renderToStaticMarkup(createElement(FollowersView, { followers, failed: true }))).toContain("Не удалось добавить.");
    expect(renderToStaticMarkup(createElement(FollowersView, { followers }))).not.toContain("Не удалось добавить.");
  });

  it("explains an empty list instead of showing a bare counter", () => {
    const html = renderToStaticMarkup(createElement(FollowersView, { followers: [] }));

    expect(html).toContain("Вас пока никто не добавил");
    expect(html).not.toContain("0 подписчиков");
  });
});
