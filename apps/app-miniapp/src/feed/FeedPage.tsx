// START_MODULE_CONTRACT
// PURPOSE: Impressions feed (Instagram-стилистика): post cards showing the post photo, likes and comments, the event or place wall and the publish form with a photo picker.
// SCOPE: Data via apiClient.listFeedPosts/toggleFeedLike/addFeedComment/createFeedPost + listEvents (event titles) + listFriends/listStories (stories rail); the wall is the same section filtered by eventId or by placeId; a picked photo is downscaled by ./photo and travels as a data URL until object storage lands (#477).
// DEPENDS: ../api/client.js (apiClient, FeedPost), ../auth/AuthContext.js, ../catalog/format.js (pluralRu), ./photo.js (readFeedPhoto), ../routing/router.js, ../max/bridge.js (webApp, shareResult), ../stories/StoryViewer.js, ../stories/rail.js (storyRail, readSeenStories, markStoriesSeen), ../ui/icons.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - FeedPostCard - presentational Instagram-style post: author header, the post photo in the 4:5 frame (category placeholder without one), icon actions (like/comment/share), likes line, caption, comments, add form and a «Пожаловаться» report control
// - FeedPostPage - one post by id: the card of the wall, opened from the profile grid and the feed
// - StoriesRow - stories rail over the home feed, Instagram-style: the own tile carries a «+» corner that opens the story editor, unseen rings burn with the brand gradient and go neutral once watched (seen state from ../stories/rail.js)
// - FeedState - union of the feed fetch states (loading / error / ready)
// - FeedSection - container: posts (optionally one event or one place — the wall), event titles for the cards, like/comment wiring, «+» publish CTA
// - feedWallEmptyCopy - empty line of a scoped wall; null on the general feed, which keeps its own weekend copy
// - FeedDraft - publish form draft (event title, text)
// - feedDraftReady - the event is picked and the text is non-empty
// - feedEventPicked - resolve the free-text event to a real event id; matched=false means the typed title matches no known event
// - FeedCreateView - presentational publish form: photo picker with a preview, event datalist, text
// - FeedCreatePage - route container: author id from the auth context, event options via apiClient.listEvents, draft state, publish via createFeedPost
// - PostAuthorAvatar - author avatar with the story ring when they have one
// END_MODULE_MAP

import { useCallback, useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import type { Event, Friend, Story } from "@max-events/api-contracts";
import { apiClient, type FeedPost } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { shareResult, webApp } from "../max/bridge";
import { sharePayload } from "../max/links";
import { readFeedPhoto } from "./photo";
import { useRoute } from "../routing/router";
import { ReportButton } from "../event/ReportButton";
import { SaveToList } from "../event/SaveToList";
import { StoryViewer, type StoryGroup } from "../stories/StoryViewer";
import { OPEN_OWN_STORY } from "../create/StoryCreatePage";
import { markStoriesSeen, readSeenStories, storyRail } from "../stories/rail";
import { StoryRing } from "../stories/StoryRing";
import { PhotoGallery } from "./gallery";
import { pictured } from "../ui/photos";
import { AppAvatar, AppButton, AppEmptyState, AppIconButton, AppState, AppSkeleton, AppSection, AppMedia } from "../ui/primitives";
import { ActionIcon } from "../ui/icons";
import { parsePinLabel } from "../ui/pin-label";
import { useSheetSwipe } from "../ui/sheet";
import { pluralRu } from "../catalog/format";

type FeedComment = FeedPost["comments"][number];
const COMMENT_LIKES = "max-events:comment-likes";
const COMMENT_PARENTS = "max-events:comment-parents";

function readJson(key: string): Record<string, string> {
  try {
    if (typeof localStorage === "undefined") return {};
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "{}");
    if (parsed === null || typeof parsed !== "object") return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

function readCommentLikes(): Record<string, true> {
  const stored = readJson(COMMENT_LIKES);
  return Object.fromEntries(Object.keys(stored).map((id) => [id, true as const]));
}

function readCommentParents(): Record<string, string> {
  return readJson(COMMENT_PARENTS);
}

function toggleCommentLike(id: string): Record<string, true> {
  const next = readCommentLikes();
  if (next[id]) delete next[id];
  else next[id] = true;
  const stored = Object.fromEntries(Object.keys(next).map((key) => [key, "1"]));
  try {
    localStorage.setItem(COMMENT_LIKES, JSON.stringify(stored));
  } catch {
    // The heart still flips for this visit.
  }
  return next;
}

function rememberCommentParent(id: string, parentId: string): Record<string, string> {
  const next = { ...readCommentParents(), [id]: parentId };
  try {
    localStorage.setItem(COMMENT_PARENTS, JSON.stringify(next));
  } catch {
    // The reply still shows in the flat list.
  }
  return next;
}

/** Top comment of a reply chain. A cycle keeps the smallest id so every reply still has a root. */
export function commentRootId(id: string, parents: Record<string, string>, known: ReadonlySet<string>): string {
  let current = id;
  const chain: string[] = [];
  const index = new Map<string, number>();
  while (!index.has(current)) {
    index.set(current, chain.length);
    chain.push(current);
    const parent = parents[current];
    if (parent === undefined || !known.has(parent)) return current;
    current = parent;
  }
  const cycle = chain.slice(index.get(current) ?? 0);
  return [...cycle].sort()[0] ?? id;
}

/** Every reply, including a reply to a reply, sits under the top comment of its chain. */
export function commentThreads(comments: FeedComment[], parents: Record<string, string>): Array<{ root: FeedComment; replies: FeedComment[] }> {
  const known = new Set(comments.map((item) => item.id));
  const replies = new Map<string, FeedComment[]>();
  const roots: FeedComment[] = [];
  for (const comment of comments) {
    const rootId = commentRootId(comment.id, parents, known);
    if (rootId === comment.id) roots.push(comment);
    else {
      const list = replies.get(rootId) ?? [];
      list.push(comment);
      replies.set(rootId, list);
    }
  }
  return roots.map((root) => ({ root, replies: replies.get(root.id) ?? [] }));
}

export function repliesLabel(count: number): string {
  return `Посмотреть ответы (${count})`;
}

/** «Смотреть все 3 комментария» — на карточке виден счёт, сами реплики живут в шторке. */
export function commentsEntryLabel(count: number): string {
  return `Смотреть все ${count} ${pluralRu(count, "комментарий", "комментария", "комментариев")}`;
}

function CommentRow({ item, liked, onLike, onReply, onOpenAuthor }: { item: { comment: FeedComment; reply: boolean }; liked: boolean; onLike: () => void; onReply: () => void; onOpenAuthor?: (userId: string) => void }) {
  const { comment, reply } = item;
  const open = onOpenAuthor ? () => onOpenAuthor(comment.author.id) : undefined;
  return (
    <li className={reply ? "app-feed-comment app-feed-comment--reply" : "app-feed-comment"}>
      {open ? (
        <button type="button" className="app-feed-comment-avatar" aria-label={`Профиль ${comment.author.name}`} onClick={open}>
          <AppAvatar size={reply ? 28 : 36} src={comment.author.avatarUrl}>
            {comment.author.name[0]}
          </AppAvatar>
        </button>
      ) : (
        <span className="app-feed-comment-avatar">
          <AppAvatar size={reply ? 28 : 36} src={comment.author.avatarUrl}>
            {comment.author.name[0]}
          </AppAvatar>
        </span>
      )}
      <div className="app-feed-comment-body">
        <div className="app-feed-comment-line">
          {open ? (
            <button type="button" className="app-feed-comment-author" aria-label={`Профиль ${comment.author.name}`} onClick={open}>
              {comment.author.name}
            </button>
          ) : (
            <span className="app-feed-comment-author">{comment.author.name}</span>
          )}
        </div>
        <p className="app-feed-comment-text">{comment.text}</p>
        <div className="app-feed-comment-actions">
          <button type="button" className="app-feed-comment-like" aria-pressed={liked} aria-label="Нравится" onClick={onLike}>
            <ActionIcon filled={liked} name="heart" size={16} />
            {liked ? 1 : 0}
          </button>
          <button type="button" className="app-feed-comment-reply" onClick={onReply}>
            Ответить
          </button>
        </div>
      </div>
    </li>
  );
}

interface FeedPostCardProps {
  post: FeedPost;
  eventTitle: string;
  eventCategory?: Event["category"];
  userId: string;
  onToggleLike: () => void;
  onAddComment: (text: string, parentId?: string | null) => void | Promise<FeedPost | void>;
  /** When set, the comment button opens the comments screen instead of the field on this card. */
  onOpenComments?: () => void;
  onOpenEvent?: (eventId: string) => void;
  onOpenMap?: () => void;
  /** Avatar, name, caption and each comment author open this person's profile. */
  onOpenAuthor?: (userId: string) => void;
  onDelete?: () => void;
  hasStory?: boolean;
}

function CommentThread({ thread, revealToken, liked, onLike, onReply, onOpenAuthor }: { thread: { root: FeedComment; replies: FeedComment[] }; revealToken: number; liked: Record<string, true>; onLike: (id: string) => void; onReply: (comment: FeedComment) => void; onOpenAuthor?: (userId: string) => void }) {
  const [opened, setOpened] = useState<boolean | null>(null);
  const [seenToken, setSeenToken] = useState(revealToken);
  const tokenChanged = revealToken !== seenToken;
  if (tokenChanged) {
    setSeenToken(revealToken);
    setOpened(revealToken > 0);
  }
  const open = tokenChanged ? revealToken > 0 : (opened ?? revealToken > 0);
  const row = (comment: FeedComment, reply: boolean) => <CommentRow key={comment.id} item={{ comment, reply }} liked={liked[comment.id] === true} onLike={() => onLike(comment.id)} onReply={() => onReply(comment)} onOpenAuthor={onOpenAuthor} />;
  return (
    <>
      {row(thread.root, false)}
      {thread.replies.length > 0 && (
        <li className="app-feed-replies">
          <button type="button" className="app-feed-replies-toggle" aria-expanded={open} onClick={() => setOpened(!open)}>
            {open ? "Скрыть ответы" : repliesLabel(thread.replies.length)}
          </button>
        </li>
      )}
      {open && thread.replies.map((comment) => row(comment, true))}
    </>
  );
}

/** Аватар автора поста: фото, если оно есть, и градиентное кольцо только при живой истории. */
export function CommentSheet({
  comments,
  parents,
  liked,
  replyTo,
  reveal,
  draft,
  onDraft,
  onClose,
  onLike,
  onReply,
  onCancelReply,
  onSubmit,
  onOpenAuthor,
  inputRef,
}: {
  comments: FeedComment[];
  parents: Record<string, string>;
  liked: Record<string, true>;
  replyTo: FeedComment | null;
  reveal?: { rootId: string; token: number } | null;
  draft: string;
  onDraft: (value: string) => void;
  onClose: () => void;
  onLike: (id: string) => void;
  onReply: (comment: FeedComment) => void;
  onCancelReply: () => void;
  onSubmit: () => void;
  onOpenAuthor?: (userId: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  const swipe = useSheetSwipe(onClose);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };
  return (
    <div className="app-picker app-comments-layer" role="dialog" aria-modal="true" aria-label="Комментарии">
      <button type="button" className="app-picker-scrim" aria-label="Закрыть" onClick={onClose} />
      <div className="app-comments-sheet app-sheet" style={swipe.style}>
        <div className="app-sheet-grab" aria-hidden="true" {...swipe.grab} />
        <p className="app-comments-count">{comments.length === 0 ? "Комментарии" : `${comments.length}`}</p>
        {comments.length === 0 ? (
          <p className="app-picker-empty">Пока никто не написал.</p>
        ) : (
          <ul className="app-comments-list">
            {commentThreads(comments, parents).map((thread) => (
              <CommentThread key={thread.root.id} thread={thread} revealToken={reveal?.rootId === thread.root.id ? reveal.token : 0} liked={liked} onLike={onLike} onReply={onReply} onOpenAuthor={onOpenAuthor} />
            ))}
          </ul>
        )}
        <form className="app-comments-compose" onSubmit={submit}>
          {replyTo !== null && (
            <button type="button" className="app-comments-reply" onClick={onCancelReply}>
              Ответ для {replyTo.author.name}
            </button>
          )}
          <input ref={inputRef} aria-label="Комментарий" placeholder={replyTo === null ? "Комментарий" : `Ответ для ${replyTo.author.name}`} value={draft} onChange={(change) => onDraft(change.target.value)} />
          <button type="submit" className="app-comments-send" aria-label="Отправить" disabled={draft.trim() === ""}>
            <ActionIcon name="arrow" size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}

export function PostAuthorAvatar({ friend, hasStory = false, size = 36 }: { friend: Friend; hasStory?: boolean; size?: number }) {
  const avatar = (
    <AppAvatar src={friend.avatarUrl} size={size}>
      {friend.name[0]}
    </AppAvatar>
  );
  if (!hasStory) return avatar;
  return (
    <StoryRing total={1} unseen={1} label="Есть история">
      {avatar}
    </StoryRing>
  );
}

export function FeedPostCard({ post, eventTitle, eventCategory, userId, onToggleLike, onAddComment, onOpenEvent, onOpenMap, onOpenAuthor, onDelete, hasStory = false }: FeedPostCardProps) {
  const [comment, setComment] = useState("");
  const [commentsOpen, setCommentsOpen] = useState(() => typeof sessionStorage !== "undefined" && sessionStorage.getItem("max-events:open-comments") === post.id);
  const [saving, setSaving] = useState(false);
  const [replyTo, setReplyTo] = useState<FeedComment | null>(null);
  const [likedComments, setLikedComments] = useState<Record<string, true>>(readCommentLikes);
  const [commentParents, setCommentParents] = useState<Record<string, string>>(readCommentParents);
  const [reveal, setReveal] = useState<{ rootId: string; token: number } | null>(null);
  const revealSeq = useRef(0);
  const commentRef = useRef<HTMLInputElement | null>(null);
  const photos = post.photoUrls && post.photoUrls.length > 0 ? post.photoUrls : post.photoUrl ? [post.photoUrl] : [];
  const eventLink =
    onOpenEvent && post.eventId !== null ? (
      <button type="button" className="app-plan-event" onClick={() => onOpenEvent(post.eventId!)}>
        {eventTitle}
      </button>
    ) : (
      <span className="app-post-place-text">{eventTitle}</span>
    );
  const pin = parsePinLabel(post.locationLabel ?? "");
  const showMark = onOpenMap !== undefined && (pin !== null || post.placeId !== null);
  const markLabel = pin !== null ? "Точка на карте" : "Показать на карте";
  useEffect(() => {
    if (typeof sessionStorage === "undefined") return;
    if (sessionStorage.getItem("max-events:open-comments") === post.id) sessionStorage.removeItem("max-events:open-comments");
  }, [post.id]);
  const sendComment = () => {
    const text = comment.trim();
    if (text === "") return;
    const before = new Set(post.comments.map((item) => item.id));
    const parent = replyTo;
    const result = onAddComment(text, parent?.id ?? null);
    setComment("");
    setReplyTo(null);
    if (parent !== null && result instanceof Promise) {
      void result.then((next) => {
        if (!next) return;
        const created = next.comments.find((item) => !before.has(item.id));
        if (!created) return;
        const parents = rememberCommentParent(created.id, parent.id);
        setCommentParents(parents);
        revealSeq.current += 1;
        setReveal({ rootId: commentRootId(created.id, parents, new Set(next.comments.map((item) => item.id))), token: revealSeq.current });
      });
    }
  };
  return (
    <article className="app-card app-card--post">
      <header className="app-post-head">
        {onOpenAuthor ? (
          <button type="button" className="app-feed-author-open" aria-label={`Профиль ${post.author.name}`} onClick={() => onOpenAuthor(post.author.id)}>
            <PostAuthorAvatar friend={post.author} hasStory={hasStory} />
          </button>
        ) : (
          <PostAuthorAvatar friend={post.author} hasStory={hasStory} />
        )}
        <span className="app-post-id">
          {onOpenAuthor ? (
            <button type="button" className="app-feed-author-open" aria-label={`Профиль ${post.author.name}`} onClick={() => onOpenAuthor(post.author.id)}>
              <span className="app-post-author">{post.author.name}</span>
            </button>
          ) : (
            <span className="app-post-author">{post.author.name}</span>
          )}
          {showMark && (
            <button type="button" className="app-feed-post-where" onClick={onOpenMap}>
              <ActionIcon name="pin" size={12} />
              <span>{markLabel}</span>
            </button>
          )}
          {eventTitle !== "" && <span className="app-post-place">{eventLink}</span>}
        </span>
        {userId !== "" && <ReportButton mode="dialog" target={{ feedPostId: post.id }} userId={userId} />}
      </header>
      {photos.length > 0 ? <PhotoGallery photos={photos} /> : <AppMedia category={eventCategory} src={pictured(post.eventId ?? post.id)} />}
      {post.text.trim() !== "" && <p className="app-post-caption">{post.text}</p>}
      <div className="app-post-actions">
        <button type="button" className="app-post-action" aria-pressed={post.likedByMe} aria-label="Нравится" onClick={onToggleLike}>
          <ActionIcon filled={post.likedByMe} name="heart" />
          <span>{post.likesCount}</span>
        </button>
        <button type="button" className="app-post-action" aria-label="Комментировать" onClick={() => setCommentsOpen(true)}>
          <ActionIcon name="comment" />
          <span>{post.comments.length}</span>
        </button>
        <button
          type="button"
          className="app-post-action"
          aria-label="Поделиться"
          onClick={() => {
            const payload = sharePayload(`${post.author.name} — ${eventTitle}: ${post.text}`, post.eventId ? `event-${post.eventId}` : `post-${post.id}`);
            void shareResult(webApp, payload.text, payload.link);
          }}
        >
          <ActionIcon name="share" />
        </button>
        {userId === "" ? (
          <span className="app-post-action app-post-action--muted" aria-hidden="true">
            <ActionIcon name="bookmark" />
          </span>
        ) : (
          <button type="button" className="app-post-action" aria-pressed={saving} aria-label="Сохранить" onClick={() => setSaving(true)}>
            <ActionIcon name="bookmark" />
          </button>
        )}
        {userId !== "" && post.author.id === userId && onDelete !== undefined && (
          <button type="button" className="app-post-action app-post-action--danger" aria-label="Удалить пост" onClick={onDelete}>
            <ActionIcon name="trash" size={24} />
          </button>
        )}
      </div>
      {saving && userId !== "" && <SaveToList feedPostId={post.id} userId={userId} open onClose={() => setSaving(false)} />}
      <p className="app-post-likes">
        {post.likesCount} {pluralRu(post.likesCount, "отметка", "отметки", "отметок")} «нравится»
      </p>
      {post.comments.length > 0 && (
        <ul className="app-post-comment-list">
          {post.comments.slice(0, 2).map((comment) => (
            <li key={comment.id} className="app-feed-comment">
              <button type="button" className="app-feed-comment-avatar" aria-label={`Профиль ${comment.author.name}`} onClick={() => onOpenAuthor?.(comment.author.id)}>
                <AppAvatar size={36} src={comment.author.avatarUrl}>
                  {comment.author.name.slice(0, 1)}
                </AppAvatar>
              </button>
              <p className="app-feed-comment-text">
                <span className="app-feed-comment-author">{comment.author.name}</span> {comment.text}
              </p>
            </li>
          ))}
        </ul>
      )}
      {post.comments.length > 0 && (
        <button type="button" className="app-comments-entry" onClick={() => setCommentsOpen(true)}>
          {commentsEntryLabel(post.comments.length)}
        </button>
      )}
      {commentsOpen && (
        <CommentSheet
          comments={post.comments}
          parents={{ ...commentParents, ...Object.fromEntries(post.comments.flatMap((item) => (item.parentId ? [[item.id, item.parentId]] : []))) }}
          liked={likedComments}
          replyTo={replyTo}
          reveal={reveal}
          draft={comment}
          onDraft={setComment}
          onClose={() => setCommentsOpen(false)}
          onLike={(id) => setLikedComments(toggleCommentLike(id))}
          onReply={(item) => {
            setReplyTo(item);
            commentRef.current?.focus();
          }}
          onCancelReply={() => setReplyTo(null)}
          onSubmit={sendComment}
          onOpenAuthor={onOpenAuthor}
          inputRef={commentRef}
        />
      )}
    </article>
  );
}

export function FeedPostPage({ id }: { id: string }) {
  const auth = useAuth();
  const { navigate } = useRoute();
  const userId = auth.status === "authenticated" ? auth.user.id : "";
  const [post, setPost] = useState<FeedPost | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [failed, setFailed] = useState(false);
  const [storyAuthors, setStoryAuthors] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    setFailed(false);
    apiClient.getFeedPost(id).then(
      (row) => {
        setPost(row);
        apiClient.listEvents().then(
          (list) => setEvent(list.find((item) => item.id === row.eventId) ?? null),
          () => {},
        );
      },
      () => setFailed(true),
    );
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    apiClient.listStories().then(
      (stories) => setStoryAuthors(new Set(stories.map((story) => story.userId))),
      () => {},
    );
  }, []);

  if (failed)
    return (
      <AppState error action={{ label: "Повторить", onClick: load }}>
        Не удалось загрузить пост.
      </AppState>
    );
  if (post === null) return <AppState>Загрузка…</AppState>;

  return (
    <FeedPostCard
      post={post}
      eventTitle={event?.title ?? ""}
      eventCategory={event?.category}
      userId={userId}
      onToggleLike={() => {
        if (userId === "") return;
        apiClient.toggleFeedLike(post.id, userId).then(setPost);
      }}
      onAddComment={(text, parentId) => {
        if (userId === "") return;
        return apiClient.addFeedComment(post.id, { userId, text, parentId: parentId ?? null }).then((next) => {
          setPost(next);
          return next;
        });
      }}
      onOpenEvent={(eventId) => navigate({ name: "event", id: eventId })}
      onOpenMap={() => {
        const pin = parsePinLabel(post.locationLabel ?? "");
        if (pin) navigate({ name: "map", pin });
        else if (post.placeId) navigate({ name: "map", placeId: post.placeId });
      }}
      hasStory={storyAuthors.has(post.author.id)}
      onOpenAuthor={(authorId) => navigate({ name: "user", id: authorId })}
      onDelete={() => {
        if (userId === "") return;
        void apiClient.deleteFeedPost(post.id).then(() => navigate({ name: "home" }));
      }}
    />
  );
}

export type FeedState = { status: "loading" } | { status: "error" } | { status: "ready"; posts: FeedPost[] };

/** A wall of one event or place is not the weekend feed. Null means the caller keeps the feed empty state. */
export function feedWallEmptyCopy(eventId?: string, placeId?: string): { text: string; action: string } | null {
  if (eventId !== undefined) return { text: "Пока никто не написал об этом событии", action: "Написать первым" };
  if (placeId !== undefined) return { text: "Пока никто не написал об этом месте", action: "Написать первым" };
  return null;
}

function FeedWallEmpty({ eventId, placeId, onCreate, onCompose }: { eventId?: string; placeId?: string; onCreate: () => void; onCompose: () => void }) {
  const wall = feedWallEmptyCopy(eventId, placeId);
  if (wall === null) return <AppEmptyState kind="empty-feed" onAction={onCompose} />;
  return <AppState action={{ label: wall.action, onClick: onCreate }}>{wall.text}</AppState>;
}

export function FeedSection({ eventId, placeId, onCreate }: { eventId?: string; placeId?: string; onCreate: () => void }) {
  const auth = useAuth();
  const userId = auth.status === "authenticated" ? auth.user.id : null;
  const { navigate } = useRoute();
  const [state, setState] = useState<FeedState>({ status: "loading" });
  const [events, setEvents] = useState<Event[]>([]);
  const [storyAuthors, setStoryAuthors] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    apiClient.listFeedPosts(eventId, placeId).then(
      (posts) => setState({ status: "ready", posts }),
      () => setState({ status: "error" }),
    );
  }, [eventId, placeId]);
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let alive = true;
    apiClient.listEvents().then(
      (list) => {
        if (alive) setEvents(list);
      },
      () => {},
    );
    apiClient.listStories().then(
      (stories) => {
        if (alive) setStoryAuthors(new Set(stories.map((story) => story.userId)));
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, []);

  const update = useCallback((next: FeedPost) => {
    setState((current) => (current.status === "ready" ? { ...current, posts: current.posts.map((item) => (item.id === next.id ? next : item)) } : current));
  }, []);

  const toggleLike = useCallback(
    (postId: string) => {
      if (userId === null) return;
      apiClient.toggleFeedLike(postId, userId).then(update);
    },
    [userId, update],
  );

  const addComment = useCallback(
    (postId: string, text: string, parentId?: string | null) => {
      if (userId === null) return;
      return apiClient.addFeedComment(postId, { userId, text, parentId: parentId ?? null }).then((next) => {
        update(next);
        return next;
      });
    },
    [userId, update],
  );

  const eventTitle = (id: string | null) => (id === null ? "" : (events.find((item) => item.id === id)?.title ?? ""));

  return (
    <AppSection
      title="Впечатления"
      action={
        <AppIconButton aria-label="Поделиться впечатлением" onClick={onCreate}>
          +
        </AppIconButton>
      }
    >
      {state.status === "loading" ? (
        <article className="app-card app-card--post" aria-hidden="true">
          <div className="app-post-head">
            <AppSkeleton width="45%" />
          </div>
          <AppSkeleton variant="media" />
        </article>
      ) : state.status === "error" ? (
        <AppState error action={{ label: "Повторить", onClick: load }}>
          Не удалось загрузить впечатления.
        </AppState>
      ) : state.posts.length === 0 ? (
        <FeedWallEmpty eventId={eventId} placeId={placeId} onCreate={onCreate} onCompose={() => navigate({ name: "feed-new", eventId: null })} />
      ) : (
        state.posts.map((post) => (
          <FeedPostCard
            key={post.id}
            post={post}
            eventTitle={eventTitle(post.eventId)}
            eventCategory={events.find((item) => item.id === post.eventId)?.category}
            userId={userId ?? ""}
            onToggleLike={() => toggleLike(post.id)}
            onAddComment={(text, parentId) => addComment(post.id, text, parentId)}
            onOpenComments={() => navigate({ name: "post", id: post.id })}
            onOpenEvent={eventId === undefined ? (id) => navigate({ name: "event", id }) : undefined}
            onOpenAuthor={(authorId) => navigate({ name: "user", id: authorId })}
            onOpenMap={() => {
              const pin = parsePinLabel(post.locationLabel ?? "");
              if (pin) navigate({ name: "map", pin });
              else if (post.placeId) navigate({ name: "map", placeId: post.placeId });
            }}
            hasStory={storyAuthors.has(post.author.id)}
          />
        ))
      )}
    </AppSection>
  );
}

/** Непросмотренное кольцо — фирменный градиент, просмотренное — нейтральная тонкая обводка; другого отличия у историй нет. */
function storyRingClass(unseen: boolean): string {
  return unseen ? "app-story-ring app-story-ring--active" : "app-story-ring app-story-ring--seen";
}

export function StoriesRow() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [seen, setSeen] = useState<string[]>(() => readSeenStories());
  // Просмотр идёт по слепку рельса, снятому на открытии: отметка просмотра переставляет
  // непросмотренных вперёд, и живой порядок увёл бы открытый просмотрщик на чужую историю.
  const [viewer, setViewer] = useState<{ groups: StoryGroup[]; start: number } | null>(null);
  const auth = useAuth();
  const { navigate } = useRoute();

  const myId = auth.status === "authenticated" ? auth.user.id : null;
  const me = auth.status === "authenticated" ? auth.user : null;

  useEffect(() => {
    let alive = true;
    const mergePeople = (list: Friend[]) => {
      setFriends((current) => {
        const seen = new Set(current.map((person) => person.id));
        const extra = list.filter((person) => !seen.has(person.id));
        return extra.length === 0 ? current : [...current, ...extra];
      });
    };
    apiClient.listFriends().then(
      (list) => {
        if (alive) mergePeople(list);
      },
      () => {},
    );
    if (myId !== null) {
      apiClient.listFollowing(myId).then(
        (list) => {
          if (alive) mergePeople(list);
        },
        () => {},
      );
    }
    apiClient.listStories().then(
      (list) => {
        if (alive) setStories(list);
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [myId]);

  useEffect(() => {
    const known = new Set(friends.map((person) => person.id));
    if (myId !== null) known.add(myId);
    const missing = [...new Set(stories.map((story) => story.userId))].filter((id) => !known.has(id));
    if (missing.length === 0) return;
    let alive = true;
    Promise.all(
      missing.map((id) =>
        apiClient.getUser(id).then(
          (user) => ({ id: user.id, name: [user.firstName, user.lastName].filter(Boolean).join(" "), avatarUrl: user.avatarUrl }),
          () => null,
        ),
      ),
    ).then((rows) => {
      if (!alive) return;
      const extra = rows.filter((row): row is Friend => row !== null);
      if (extra.length === 0) return;
      setFriends((current) => {
        const seen = new Set(current.map((person) => person.id));
        return [...current, ...extra.filter((person) => !seen.has(person.id))];
      });
    });
    return () => {
      alive = false;
    };
  }, [friends, stories, myId]);

  const rail = storyRail(friends, stories, myId, seen);
  const openEditor = () => navigate({ name: "story-new" });

  useEffect(() => {
    if (typeof sessionStorage === "undefined" || sessionStorage.getItem(OPEN_OWN_STORY) !== "1") return;
    if (rail.own.group === null) return;
    sessionStorage.removeItem(OPEN_OWN_STORY);
    setViewer({ groups: rail.groups, start: rail.own.group });
  }, [rail.own.group, rail.groups]);

  // Отметка просмотра не меняет список, если история уже просмотрена: иначе показ истории
  // перерисовывал бы рельс под открытым просмотрщиком на каждом кадре.
  const rememberSeen = useCallback((story: Story) => {
    setSeen((current) => (current.includes(story.id) ? current : markStoriesSeen([story.id])));
  }, []);

  return (
    <div className="app-stories" aria-label="Истории">
      {/* Как в инстаграме: рельс открывается своим кружком с плюсом в углу — плюс ведёт в редактор истории, кольцо со своей историей открывает её просмотр. */}
      <div className="app-story app-story--own">
        {/* Подписи кружка и плюса разные: две кнопки с одним именем неразличимы и для скринридера, и для теста. */}
        <button type="button" className="app-story-open" aria-label={rail.own.group === null ? "Твоя история: добавить" : `Твоя история: ${rail.own.storyCount}`} onClick={() => (rail.own.group === null ? openEditor() : setViewer({ groups: rail.groups, start: rail.own.group }))}>
          {rail.own.storyCount > 0 ? (
            <StoryRing total={rail.own.storyCount} unseen={rail.own.unseenCount} label={rail.own.unseenCount > 0 ? `Твои истории, новых ${rail.own.unseenCount} из ${rail.own.storyCount}` : `Твои истории, ${rail.own.storyCount}, уже смотрел`}>
              <AppAvatar size={58} src={me?.avatarUrl}>
                {me?.firstName[0] ?? "Я"}
              </AppAvatar>
            </StoryRing>
          ) : (
            <span className={storyRingClass(false)}>
              <AppAvatar size={58} src={me?.avatarUrl}>
                {me?.firstName[0] ?? "Я"}
              </AppAvatar>
            </span>
          )}
        </button>
        <button type="button" className="app-story-plus" aria-label="Добавить историю" onClick={openEditor}>
          <ActionIcon name="plus" size={14} strokeWidth={3} />
        </button>
      </div>
      {rail.tiles.map((tile) => (
        <div key={tile.friendId} className="app-story">
          <button type="button" className="app-story-open" aria-label={`История ${tile.name}, ${tile.storyCount}`} onClick={() => setViewer({ groups: rail.groups, start: tile.group })}>
            <StoryRing total={tile.storyCount} unseen={tile.unseenCount} label={tile.unseenCount > 0 ? `${tile.name}: новых историй ${tile.unseenCount} из ${tile.storyCount}` : `${tile.name}: истории ${tile.storyCount}, уже смотрел`}>
              <AppAvatar size={58} src={tile.avatarUrl ?? friends.find((person) => person.id === tile.friendId)?.avatarUrl}>
                {tile.initial}
              </AppAvatar>
            </StoryRing>
          </button>
          <button type="button" className="app-story-name" aria-label={`Профиль ${tile.name}`} onClick={() => navigate({ name: "user", id: tile.friendId })}>
            {tile.name}
          </button>
        </div>
      ))}
      {viewer !== null && <StoryViewer groups={viewer.groups} startGroup={viewer.start} onView={rememberSeen} onClose={() => setViewer(null)} />}
    </div>
  );
}

export interface FeedDraft {
  event: string;
  text: string;
  /** Data URL of the picked photo, null until one is chosen; a post may still be text only. */
  photoUrl?: string | null;
}

export function feedDraftReady(draft: FeedDraft): boolean {
  return draft.event.trim() !== "" && draft.text.trim() !== "";
}

/** Maps the draft's free-text event title to a real event id; matched=false means the user typed a title that matches no known event. */
export function feedEventPicked(draft: FeedDraft, events: Event[]): { eventId: string | null; matched: boolean } {
  const event = events.find((item) => item.title === draft.event.trim());
  return event === undefined ? { eventId: null, matched: false } : { eventId: event.id, matched: true };
}

interface FeedCreateViewProps {
  draft: FeedDraft;
  events: Event[];
  submitting: boolean;
  failed: boolean;
  eventMissing: boolean;
  photoRejected?: boolean;
  /** A photo is still being prepared; publishing now would post without it. */
  photoPending?: boolean;
  onChange: (field: keyof FeedDraft, value: string) => void;
  onPhoto?: (file: File) => void;
  onPhotoClear?: () => void;
  onSubmit: () => void;
}

export function FeedCreateView({ draft, events, submitting, failed, eventMissing, photoRejected = false, photoPending = false, onChange, onPhoto = () => {}, onPhotoClear = () => {}, onSubmit }: FeedCreateViewProps) {
  const photoRef = useRef<HTMLInputElement | null>(null);
  const photoUrl = draft.photoUrl ?? null;
  return (
    <section className="app-gathering">
      <p className="app-gathering-hint">Фото и пара слов — пост в ленте</p>
      {photoUrl !== null && <img className="app-card-media app-post-photo" src={photoUrl} alt="Выбранное фото" />}
      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        aria-label="Выбрать фото для поста"
        hidden
        onChange={(change) => {
          const file = change.target.files?.[0];
          if (file) onPhoto(file);
          // Cleared so picking the same file twice still fires a change event.
          change.target.value = "";
        }}
      />
      <button type="button" className="app-review-photo" disabled={photoPending} onClick={() => (photoUrl === null ? photoRef.current?.click() : onPhotoClear())}>
        {photoPending ? "Готовим фото…" : photoUrl === null ? "Добавить фото" : "Убрать фото"}
      </button>
      {photoRejected && <AppState error>Не удалось подготовить фото. Попробуйте другое.</AppState>}
      <label className="app-gathering-time">
        К какому событию
        <input className="app-gathering-time-input" list="feed-event-options" value={draft.event} placeholder="Событие" onChange={(change) => onChange("event", change.target.value)} />
        <datalist id="feed-event-options">
          {events.map((event) => (
            <option key={event.id} value={event.title} />
          ))}
        </datalist>
      </label>
      <textarea className="app-review-text" placeholder="Расскажи, как всё прошло" value={draft.text} onChange={(change) => onChange("text", change.target.value)} />
      {/* Blocked while a photo is being prepared: publishing now would quietly post without it. */}
      <AppButton disabled={!feedDraftReady(draft) || submitting || photoPending} onClick={onSubmit} stretched>
        {submitting ? "Публикуем…" : "Опубликовать"}
      </AppButton>
      {failed && <AppState error>Не удалось опубликовать впечатление.</AppState>}
      {eventMissing && <AppState error>Выбери событие из списка.</AppState>}
    </section>
  );
}

export function FeedCreatePage({ eventId }: { eventId: string | null }) {
  const auth = useAuth();
  const userId = auth.status === "authenticated" ? auth.user.id : null;
  const { navigate } = useRoute();
  const [draft, setDraft] = useState<FeedDraft>({ event: "", text: "", photoUrl: null });
  const [events, setEvents] = useState<Event[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [eventMissing, setEventMissing] = useState(false);
  const [photoRejected, setPhotoRejected] = useState(false);
  const [photoPending, setPhotoPending] = useState(false);
  // Only the newest pick may land: a big photo picked first can resolve after a small one picked
  // second, and would otherwise overwrite it — or come back after the author removed it.
  const photoPick = useRef(0);

  const pickPhoto = useCallback((file: File) => {
    const pick = ++photoPick.current;
    setPhotoRejected(false);
    setPhotoPending(true);
    // A photo too heavy to send is said out loud: dropping it silently would publish a post the
    // author believes carries their picture.
    void readFeedPhoto(file).then((photoUrl) => {
      if (pick !== photoPick.current) return;
      setPhotoPending(false);
      if (photoUrl === null) setPhotoRejected(true);
      else setDraft((current) => ({ ...current, photoUrl }));
    });
  }, []);

  useEffect(() => {
    let alive = true;
    apiClient.listEvents().then(
      (list) => {
        if (alive) setEvents(list);
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (eventId === null) return;
    const found = events.find((item) => item.id === eventId);
    if (found) setDraft((current) => (current.event === "" ? { ...current, event: found.title } : current));
  }, [events, eventId]);

  const publish = useCallback(() => {
    if (!feedDraftReady(draft) || userId === null) return;
    const picked = feedEventPicked(draft, events);
    if (picked.eventId === null) {
      setEventMissing(true);
      return;
    }
    setSubmitting(true);
    setFailed(false);
    setEventMissing(false);
    apiClient.createFeedPost({ userId, eventId: picked.eventId, text: draft.text.trim(), photoUrl: draft.photoUrl ?? null }).then(
      () => navigate({ name: "home" }),
      () => {
        setSubmitting(false);
        setFailed(true);
      },
    );
  }, [draft, events, userId, navigate]);

  return (
    <FeedCreateView
      draft={draft}
      events={events}
      submitting={submitting}
      failed={failed}
      eventMissing={eventMissing}
      photoRejected={photoRejected}
      photoPending={photoPending}
      onChange={(field, value) => {
        if (field === "event") setEventMissing(false);
        setDraft((current) => ({ ...current, [field]: value }));
      }}
      onPhoto={pickPhoto}
      onPhotoClear={() => {
        // Bumped so a pick still in flight cannot put the photo back after it was removed.
        photoPick.current += 1;
        setPhotoRejected(false);
        setPhotoPending(false);
        setDraft((current) => ({ ...current, photoUrl: null }));
      }}
      onSubmit={publish}
    />
  );
}
