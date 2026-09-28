import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Friend, Story } from "@max-events/api-contracts";
import { mergeSeenStories, readSeenStories, storyRail, STORY_SEEN_KEY } from "./rail";

const MY_ID = "a0000000-0000-4000-8000-000000000001";

const friend = (index: number, name: string): Friend => ({ id: `a0000000-0000-4000-8000-0000000000b${index}`, name, avatarUrl: null });

const story = (id: string, userId: string, createdAt: string): Story => ({ id, userId, imageUrl: `data:image/svg+xml;utf8,${id}`, createdAt, text: "", sticker: null, poll: null, audience: "friends", objects: [] });

const ANNA = friend(1, "Анна Соколова");
const DIMA = friend(2, "Дима Кузнецов");
const KATYA = friend(3, "Катя Орлова");

const ANNA_OLD = story("e1000000-0000-4000-8000-000000000001", ANNA.id, "2026-09-16T09:00:00+03:00");
const ANNA_NEW = story("e1000000-0000-4000-8000-000000000002", ANNA.id, "2026-09-16T12:00:00+03:00");
const DIMA_ONE = story("e1000000-0000-4000-8000-000000000003", DIMA.id, "2026-09-16T10:00:00+03:00");
const MY_ONE = story("e1000000-0000-4000-8000-000000000004", MY_ID, "2026-09-16T11:00:00+03:00");

describe("mergeSeenStories", () => {
  it("adds new views without duplicating what is already seen", () => {
    expect(mergeSeenStories(["a"], ["b"])).toEqual(["a", "b"]);
    expect(mergeSeenStories(["a", "b"], ["a"])).toEqual(["b", "a"]);
  });

  it("keeps the newest views when the list outgrows its cap, so the ring of a fresh story never lights up again", () => {
    const old = Array.from({ length: 500 }, (_, index) => `old-${index}`);
    const merged = mergeSeenStories(old, ["fresh"]);

    expect(merged).toHaveLength(500);
    expect(merged.includes("fresh")).toBe(true);
    expect(merged.includes("old-0")).toBe(false);
  });
});

describe("readSeenStories", () => {
  it("answers an empty list outside the browser instead of throwing on a missing window", () => {
    expect(readSeenStories()).toEqual([]);
    expect(STORY_SEEN_KEY).toBe("max-events:stories-seen");
  });
});

describe("storyRail", () => {
  const stories = [ANNA_OLD, ANNA_NEW, DIMA_ONE, MY_ONE];

  it("lights the ring of an author with unseen stories and dims it once every one is seen", () => {
    const fresh = storyRail([ANNA, DIMA], stories, MY_ID, []);
    const watched = storyRail([ANNA, DIMA], stories, MY_ID, [ANNA_OLD.id, ANNA_NEW.id]);

    expect(fresh.tiles.map((tile) => tile.unseen)).toEqual([true, true]);
    expect(watched.tiles.find((tile) => tile.friendId === ANNA.id)?.unseen).toBe(false);
    expect(watched.tiles.find((tile) => tile.friendId === DIMA.id)?.unseen).toBe(true);
  });

  it("moves a fully watched author to the right and leaves an unseen author on the left", () => {
    const rail = storyRail([ANNA, DIMA], stories, MY_ID, [ANNA_OLD.id, ANNA_NEW.id]);

    expect(rail.tiles.map((tile) => tile.friendId)).toEqual([DIMA.id, ANNA.id]);
  });

  it("keeps the groups of the viewer in the order of the tiles, own stories first", () => {
    const rail = storyRail([ANNA, DIMA], stories, MY_ID, [ANNA_OLD.id, ANNA_NEW.id]);

    expect(rail.groups.map((group) => group.authorName)).toEqual(["Вы", "Дима Кузнецов", "Анна Соколова"]);
    expect(rail.own.group).toBe(0);
    expect(rail.tiles.map((tile) => rail.groups[tile.group].authorName)).toEqual(["Дима Кузнецов", "Анна Соколова"]);
  });

  it("covers a tile with the newest story and plays a group from the oldest", () => {
    const rail = storyRail([ANNA], stories, MY_ID, []);

    expect(rail.tiles[0].coverUrl).toBe(ANNA_NEW.imageUrl);
    expect(rail.groups[1].stories.map((item) => item.id)).toEqual([ANNA_OLD.id, ANNA_NEW.id]);
  });

  it("leaves friends without stories out of the rail, where a neutral ring would read as «seen»", () => {
    const rail = storyRail([ANNA, KATYA], stories, MY_ID, []);

    expect(rail.tiles.map((tile) => tile.friendId)).toEqual([ANNA.id]);
  });

  it("shortens the name under the ring to the first word and keeps its initial", () => {
    const rail = storyRail([ANNA], stories, MY_ID, []);

    expect(rail.tiles[0].name).toBe("Анна");
    expect(rail.tiles[0].initial).toBe("А");
  });

  it("holds no own group at all until the author has a story, so the own tile only opens the editor", () => {
    const rail = storyRail([ANNA], [ANNA_OLD], MY_ID, []);

    expect(rail.own).toEqual({ coverUrl: null, storyCount: 0, unseenCount: 0, unseen: false, group: null });
    expect(rail.groups[0].authorName).toBe("Анна Соколова");
  });

  it("dims the own ring once the author watched their own story back", () => {
    expect(storyRail([], stories, MY_ID, []).own).toEqual({ coverUrl: MY_ONE.imageUrl, storyCount: 1, unseenCount: 1, unseen: true, group: 0 });
    expect(storyRail([], stories, MY_ID, [MY_ONE.id]).own.unseen).toBe(false);
  });

  it("treats a guest without an id as an author without stories", () => {
    expect(storyRail([ANNA], stories, null, []).own.group).toBeNull();
  });
});

/**
 * Геометрия кольца, а не его цвет: цвета стережёт палитра в ../ui/theme.test.ts. Здесь закрыт ровно
 * тот дефект, из-за которого градиент был не виден, — тень цветом страницы шириной во всю подложку.
 * Она накрывала обводку целиком, и от градиента оставался край пикселя сглаживания.
 */
describe("кольцо истории в theme.css", () => {
  const css = readFileSync(new URL("../ui/theme.css", import.meta.url), "utf8");
  /** Последнее правило с таким селектором: файл собирается как «база плюс хвосты», выигрывает хвост. */
  const rule = (selector: string) => {
    const at = css.lastIndexOf(`${selector} {`);
    expect(at, `нет правила ${selector}`).toBeGreaterThan(-1);
    return css.slice(at, css.indexOf("}", at));
  };
  const spreads = (selector: string) => [...rule(selector).matchAll(/0 0 0 ([\d.]+)px/g)].map((match) => Number.parseFloat(match[1]));
  const padding = (selector: string) => Number.parseFloat((rule(selector).match(/padding: ([\d.]+)px/) ?? [])[1] ?? "0");

  it("разворачивает непросмотренное кольцо по кругу, а не по диагонали", () => {
    expect(rule(".app-story-ring--active")).toContain("var(--app-gradient-ring)");
    expect(css).toContain("--app-gradient-ring: conic-gradient(");
  });

  it("оставляет градиенту полосу, а не один край сглаживания: тень уже подложки", () => {
    const pad = padding(".app-stories .app-story-ring");
    const gap = spreads(".app-story-ring--active > *")[0];

    expect(pad).toBe(5);
    expect(gap).toBe(2);
    // Ровно это равенство и было дефектом: при pad === gap видимой обводки не остаётся вовсе.
    expect(pad - gap).toBeGreaterThanOrEqual(3);
  });

  it("держит просмотренное кольцо тонкой нейтралью того же внешнего радиуса — рельс не прыгает", () => {
    const seen = spreads(".app-story-ring--seen > *");

    expect(rule(".app-story-ring--seen")).toContain("background: none");
    expect(padding(".app-story-ring--seen")).toBe(padding(".app-stories .app-story-ring"));
    // Два слоя: верхний цветом страницы, нижний нейтралью — наружу выходит разница между ними.
    expect(seen).toHaveLength(2);
    expect(seen[1] - seen[0]).toBeCloseTo(1.5);
    expect(seen[1] - seen[0]).toBeLessThan(padding(".app-stories .app-story-ring") - spreads(".app-story-ring--active > *")[0]);
  });

  it("расширяет плитку под подросшее кольцо, иначе рельс режет обводку", () => {
    expect(rule(".app-stories .app-story")).toContain("width: 76px");
  });
});
