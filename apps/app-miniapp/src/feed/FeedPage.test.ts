import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { feedDraftReady, feedEventPicked, FeedCreateView, FeedPostCard, type FeedDraft } from "./FeedPage";
import type { FeedPost } from "../api/client";
import { mockEvents } from "../api/mock";

const noop = () => {};

const post: FeedPost = {
  id: "30000000-0000-4000-8000-000000000001",
  author: { id: "a0000000-0000-4000-8000-0000000000b1", name: "Анна Соколова", avatarUrl: null },
  eventId: mockEvents[0].id,
  text: "Было здорово",
  likesCount: 2,
  likedByMe: false,
  comments: [{ id: "31000000-0000-4000-8000-000000000001", author: { id: "a0000000-0000-4000-8000-0000000000b2", name: "Дима Кузнецов", avatarUrl: null }, text: "Класс!" }],
};

const readyDraft: FeedDraft = { event: mockEvents[0].title, text: "Как прошло — восторг" };

describe("FeedPostCard", () => {
  const card = (over: Partial<FeedPost> = {}, withEventLink = false) => renderToStaticMarkup(createElement(FeedPostCard, { post: { ...post, ...over }, eventTitle: mockEvents[0].title, onToggleLike: noop, onAddComment: noop, ...(withEventLink ? { onOpenEvent: noop } : {}) }));

  it("renders the photo placeholder, author, event title, text and comments", () => {
    const html = card();

    expect(html).toContain("app-card-media");
    expect(html).toContain("Анна Соколова");
    expect(html).toContain(mockEvents[0].title);
    expect(html).toContain("Было здорово");
    expect(html).toContain("Дима Кузнецов");
    expect(html).toContain("Класс!");
  });

  it("reflects the like state and counter on the like button", () => {
    expect(card()).toContain('aria-pressed="false"');
    const liked = card({ likedByMe: true, likesCount: 3 });
    expect(liked).toContain('aria-pressed="true"');
    expect(liked).toContain("3");
  });

  it("renders the event title as a link only with onOpenEvent", () => {
    expect(card({}, true)).toContain("app-plan-event");
    expect(card()).not.toContain("app-plan-event");
  });

  it("renders the comment add form with a disabled submit until text is typed", () => {
    expect(card()).toContain("Добавить комментарий…");
    expect(card()).toContain("disabled");
  });
});

describe("feedDraftReady", () => {
  it("requires an event and a non-empty text", () => {
    expect(feedDraftReady(readyDraft)).toBe(true);
    expect(feedDraftReady({ ...readyDraft, event: "  " })).toBe(false);
    expect(feedDraftReady({ ...readyDraft, text: "  " })).toBe(false);
    expect(feedDraftReady({ event: "", text: "" })).toBe(false);
  });
});

describe("feedEventPicked", () => {
  it("resolves a draft with a matching event title to that event id", () => {
    expect(feedEventPicked(readyDraft, mockEvents)).toEqual({ eventId: mockEvents[0].id, matched: true });
  });

  it("reports unmatched free text so the raw title is never sent as an event id", () => {
    expect(feedEventPicked({ event: "Какой-то произвольный текст", text: "Было классно" }, mockEvents)).toEqual({ eventId: null, matched: false });
  });
});

describe("FeedCreateView", () => {
  const view = (over: { draft?: FeedDraft; submitting?: boolean; failed?: boolean; eventMissing?: boolean } = {}) => renderToStaticMarkup(createElement(FeedCreateView, { draft: over.draft ?? { event: "", text: "" }, events: mockEvents, submitting: over.submitting ?? false, failed: over.failed ?? false, eventMissing: over.eventMissing ?? false, onChange: noop, onSubmit: noop }));

  it("renders the photo placeholder, the event datalist and the text field", () => {
    const html = view();

    expect(html).toContain("Добавить фото");
    expect(html).toContain("disabled");
    expect(html).toContain("К какому событию");
    expect(html).toContain('id="feed-event-options"');
    expect(html).toContain("Расскажи, как всё прошло");
  });

  it("keeps publish disabled until the draft is ready and shows submitting and failure states", () => {
    expect((view().match(/disabled=""/g) ?? []).length).toBe(2);
    expect(view({ draft: readyDraft })).toContain("Опубликовать");
    expect((view({ draft: readyDraft }).match(/disabled=""/g) ?? []).length).toBe(1);
    expect(view({ draft: readyDraft, submitting: true })).toContain("Публикуем…");
    expect(view({ draft: readyDraft, failed: true })).toContain("Не удалось опубликовать впечатление.");
  });

  it("shows an explicit input error when the event title matches no known event", () => {
    expect(view({ draft: readyDraft, eventMissing: true })).toContain("Выбери событие из списка.");
  });
});
