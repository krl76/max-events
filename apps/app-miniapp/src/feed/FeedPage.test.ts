import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { commentsEntryLabel, feedDraftReady, feedEventPicked, feedWallEmptyCopy, CommentSheet, FeedCreateView, FeedPostCard, type FeedDraft } from "./FeedPage";
import type { FeedPost } from "../api/client";
import { mockEvents } from "../api/mock";

const noop = () => {};
const DEMO_USER_ID = "a0000000-0000-4000-8000-000000000001";

const post: FeedPost = {
  id: "30000000-0000-4000-8000-000000000001",
  author: { id: "a0000000-0000-4000-8000-0000000000b1", name: "Анна Соколова", avatarUrl: null },
  eventId: mockEvents[0].id,
  text: "Было здорово",
  photoUrl: null,
  placeId: null,
  taggedFriendIds: [],
  audience: "friends",
  allowJoin: false,
  likesCount: 2,
  likedByMe: false,
  comments: [{ id: "31000000-0000-4000-8000-000000000001", author: { id: "a0000000-0000-4000-8000-0000000000b2", name: "Дима Кузнецов", avatarUrl: null }, text: "Класс!" }],
};

const readyDraft: FeedDraft = { event: mockEvents[0].title, text: "Как прошло — восторг" };

describe("FeedPostCard", () => {
  const card = (over: Partial<FeedPost> = {}, withEventLink = false) => renderToStaticMarkup(createElement(FeedPostCard, { post: { ...post, ...over }, eventTitle: mockEvents[0].title, userId: DEMO_USER_ID, onToggleLike: noop, onAddComment: noop, ...(withEventLink ? { onOpenEvent: noop } : {}) }));

  it("renders the photo frame, author, event title, text and comments", () => {
    const html = card();

    expect(html).toContain("app-card-media");
    expect(html).toContain("Анна Соколова");
    expect(html).toContain(mockEvents[0].title);
    expect(html).toContain("Было здорово");
    expect(html).toContain(commentsEntryLabel(1));
    expect(html).not.toContain("Класс!");
  });

  it("turns the author icon and name into profile controls", () => {
    const html = renderToStaticMarkup(createElement(FeedPostCard, { post, eventTitle: mockEvents[0].title, userId: DEMO_USER_ID, onToggleLike: noop, onAddComment: noop, onOpenAuthor: noop }));

    expect(html).toContain('aria-label="Профиль Анна Соколова"');
  });

  it("keeps the comment thread in the sheet, with the author and the composer", () => {
    const html = renderToStaticMarkup(createElement(CommentSheet, { comments: post.comments, parents: {}, liked: {}, replyTo: null, draft: "", onDraft: noop, onClose: noop, onLike: noop, onReply: noop, onCancelReply: noop, onSubmit: noop, onOpenAuthor: noop, inputRef: { current: null } }));

    expect(html).toContain("Дима Кузнецов");
    expect(html).toContain("Класс!");
    expect(html).toContain("Добавить комментарий…");
    expect(html).toContain('aria-label="Профиль Дима Кузнецов"');
  });

  it("shows the post photo in the 4:5 frame, and the category placeholder only without one", () => {
    const withPhoto = card({ photoUrl: "https://cdn.example.com/post.jpg" });

    expect(withPhoto).toContain('src="https://cdn.example.com/post.jpg"');
    // Same 4:5 frame as the placeholder, and it replaces it rather than sitting under it.
    expect(withPhoto).toContain('class="app-card-media app-post-photo"');
    expect((withPhoto.match(/app-card-media/g) ?? []).length).toBe(1);
    expect(card({ photoUrl: null })).toContain("picsum.photos");
    expect(card({ photoUrl: null })).not.toContain("app-post-photo");
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

  it("keeps the composer in the comments sheet, disabled until there is text", () => {
    const html = renderToStaticMarkup(createElement(CommentSheet, { comments: post.comments, parents: {}, liked: {}, replyTo: null, draft: "", onDraft: noop, onClose: noop, onLike: noop, onReply: noop, onCancelReply: noop, onSubmit: noop, inputRef: { current: null } }));

    expect(html).toContain("Добавить комментарий…");
    expect(html).toContain("disabled");
  });

  it("puts the report control in the post header", () => {
    expect(card()).toContain('aria-label="Пожаловаться"');
    expect(card()).toContain("app-post-more");
  });

  it("uses the author photo and a story ring when the author has a live story", () => {
    const withPhoto = card({ author: { ...post.author, avatarUrl: "https://cdn.example.com/anna.jpg" } });
    expect(withPhoto).toContain('src="https://cdn.example.com/anna.jpg"');
    expect(withPhoto).not.toContain("app-story-ring--active");
    const withStory = renderToStaticMarkup(createElement(FeedPostCard, { post: { ...post, author: { ...post.author, avatarUrl: "https://cdn.example.com/anna.jpg" } }, eventTitle: mockEvents[0].title, userId: DEMO_USER_ID, onToggleLike: noop, onAddComment: noop, hasStory: true }));
    expect(withStory).toContain("app-story-ring--active");
    expect(withStory).toContain('src="https://cdn.example.com/anna.jpg"');
  });

  it("turns the bookmark into a save control", () => {
    expect(card()).toContain('aria-label="Сохранить"');
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
  const view = (over: { draft?: FeedDraft; submitting?: boolean; failed?: boolean; eventMissing?: boolean; photoRejected?: boolean; photoPending?: boolean } = {}) => renderToStaticMarkup(createElement(FeedCreateView, { draft: over.draft ?? { event: "", text: "" }, events: mockEvents, submitting: over.submitting ?? false, failed: over.failed ?? false, eventMissing: over.eventMissing ?? false, photoRejected: over.photoRejected ?? false, photoPending: over.photoPending ?? false, onChange: noop, onSubmit: noop }));

  it("offers a real photo picker, the event datalist and the text field", () => {
    const html = view();

    expect(html).toContain("Добавить фото");
    expect(html).toContain('type="file"');
    expect(html).toContain('aria-label="Выбрать фото для поста"');
    expect(html).toContain("К какому событию");
    expect(html).toContain('id="feed-event-options"');
    expect(html).toContain("Расскажи, как всё прошло");
  });

  it("previews the picked photo and offers to drop it", () => {
    const html = view({ draft: { ...readyDraft, photoUrl: "data:image/jpeg;base64,AAAA" } });

    expect(html).toContain('src="data:image/jpeg;base64,AAAA"');
    expect(html).toContain("Убрать фото");
    expect(html).not.toContain("Добавить фото");
  });

  it("blocks publishing while a photo is still being prepared", () => {
    // Publishing mid-preparation posted without the photo, silently — the author believed it was there.
    const html = view({ draft: readyDraft, photoPending: true });

    expect(html).toContain("Готовим фото…");
    expect((html.match(/disabled=""/g) ?? []).length).toBe(2);
    expect(view({ draft: readyDraft }).match(/disabled=""/g) ?? []).toHaveLength(0);
  });

  it("says when a picked photo could not be prepared", () => {
    // Silence would publish a post the author believes carries their picture.
    expect(view({ photoRejected: true })).toContain("Не удалось подготовить фото.");
    expect(view()).not.toContain("Не удалось подготовить фото.");
  });

  it("keeps publish disabled until the draft is ready and shows submitting and failure states", () => {
    // Only the publish button: the photo picker is no longer a dead placeholder.
    expect((view().match(/disabled=""/g) ?? []).length).toBe(1);
    expect(view({ draft: readyDraft })).toContain("Опубликовать");
    expect((view({ draft: readyDraft }).match(/disabled=""/g) ?? []).length).toBe(0);
    expect(view({ draft: readyDraft, submitting: true })).toContain("Публикуем…");
    expect(view({ draft: readyDraft, failed: true })).toContain("Не удалось опубликовать впечатление.");
  });

  it("shows an explicit input error when the event title matches no known event", () => {
    expect(view({ draft: readyDraft, eventMissing: true })).toContain("Выбери событие из списка.");
  });
});

describe("feedWallEmptyCopy", () => {
  it("talks about the event or the place, and leaves the weekend feed alone", () => {
    expect(feedWallEmptyCopy("e1")).toEqual({ text: "Пока никто не написал об этом событии", action: "Написать первым" });
    expect(feedWallEmptyCopy(undefined, "p1")).toEqual({ text: "Пока никто не написал об этом месте", action: "Написать первым" });
    expect(feedWallEmptyCopy()).toBeNull();
  });
});
