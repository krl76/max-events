// START_MODULE_CONTRACT
// PURPOSE: Impressions feed (Instagram-стилистика): post cards with a photo placeholder, likes and comments, the event wall (block of the event's posts) and the publish form (photo placeholder + text).
// SCOPE: Data via apiClient.listFeedPosts/toggleFeedLike/addFeedComment/createFeedPost (mock or live); the wall is the same section filtered by eventId; no photo upload (placeholder button).
// DEPENDS: ../api/client.js (apiClient, FeedPost), ../api/mock.js (mockEvents for the event datalist), ../auth/AuthContext.js, ../event/EventPage.js (DEMO_USER_ID), ../routing/router.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - FeedPostCard - presentational post: media placeholder, author, event title, text, like toggle with counter, comment list and add form
// - FeedState - union of the feed fetch states (loading / error / ready)
// - FeedSection - container: posts (optionally one event — the wall), like/comment wiring, «+» publish CTA
// - FeedDraft - publish form draft (event title, text)
// - feedDraftReady - the event is picked and the text is non-empty
// - FeedCreateView - presentational publish form: photo placeholder, event datalist, text
// - FeedCreatePage - route container: author id, draft state, publish via createFeedPost
// END_MODULE_MAP

import { useCallback, useEffect, useState } from "react";
import type { Event } from "@max-events/api-contracts";
import { apiClient, type FeedPost } from "../api/client";
import { mockEvents } from "../api/mock";
import { useAuth } from "../auth/AuthContext";
import { DEMO_USER_ID } from "../event/EventPage";
import { useRoute } from "../routing/router";

interface FeedPostCardProps {
  post: FeedPost;
  onToggleLike: () => void;
  onAddComment: (text: string) => void;
  onOpenEvent?: (eventId: string) => void;
}

export function FeedPostCard({ post, onToggleLike, onAddComment, onOpenEvent }: FeedPostCardProps) {
  const [comment, setComment] = useState("");
  const eventTitle = mockEvents.find((item) => item.id === post.eventId)?.title ?? "";
  return (
    <article className="app-card">
      <div className="app-card-media" />
      <div className="app-card-body">
        <span className="app-feed-author">
          <span className="app-friends-avatar">{post.author.name[0]}</span>
          {post.author.name}
        </span>
        {onOpenEvent ? (
          <button type="button" className="app-plan-event" onClick={() => onOpenEvent(post.eventId)}>
            {eventTitle}
          </button>
        ) : (
          <span className="app-card-title">{eventTitle}</span>
        )}
        <span>{post.text}</span>
        <button type="button" className="app-feed-like" aria-pressed={post.likedByMe} onClick={onToggleLike}>
          {post.likedByMe ? "♥" : "♡"} {post.likesCount}
        </button>
        <ul className="app-feed-comments">
          {post.comments.map((item) => (
            <li key={item.id} className="app-feed-comment">
              <span className="app-feed-comment-author">{item.author.name}</span> {item.text}
            </li>
          ))}
        </ul>
        <form
          className="app-feed-comment-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (comment.trim() === "") return;
            onAddComment(comment);
            setComment("");
          }}
        >
          <input className="app-filters-input" placeholder="Добавить комментарий…" value={comment} onChange={(change) => setComment(change.target.value)} />
          <button type="submit" className="app-participation-chip" disabled={comment.trim() === ""}>
            Отправить
          </button>
        </form>
      </div>
    </article>
  );
}

export type FeedState = { status: "loading" } | { status: "error" } | { status: "ready"; posts: FeedPost[] };

export function FeedSection({ eventId, onCreate }: { eventId?: string; onCreate: () => void }) {
  const auth = useAuth();
  const userId = auth.status === "authenticated" ? auth.user.id : DEMO_USER_ID;
  const { navigate } = useRoute();
  const [state, setState] = useState<FeedState>({ status: "loading" });

  const load = useCallback(() => {
    apiClient.listFeedPosts(eventId).then(
      (posts) => setState({ status: "ready", posts }),
      () => setState({ status: "error" }),
    );
  }, [eventId]);
  useEffect(() => {
    load();
  }, [load]);

  const update = useCallback((next: FeedPost) => {
    setState((current) => (current.status === "ready" ? { ...current, posts: current.posts.map((item) => (item.id === next.id ? next : item)) } : current));
  }, []);

  const toggleLike = useCallback(
    (postId: string) => {
      apiClient.toggleFeedLike(postId, userId).then(update);
    },
    [userId, update],
  );

  const addComment = useCallback(
    (postId: string, text: string) => {
      apiClient.addFeedComment(postId, { userId, text }).then(update);
    },
    [userId, update],
  );

  return (
    <section aria-label="Впечатления">
      <div className="app-micro-head">
        <h2 className="app-today-heading">Впечатления</h2>
        <button type="button" className="app-micro-add" aria-label="Поделиться впечатлением" onClick={onCreate}>
          +
        </button>
      </div>
      {state.status === "loading" ? null : state.status === "error" ? <p className="app-state app-state--error">Не удалось загрузить впечатления.</p> : state.posts.length === 0 ? <p className="app-state">Пока нет постов — расскажи первым.</p> : state.posts.map((post) => <FeedPostCard key={post.id} post={post} onToggleLike={() => toggleLike(post.id)} onAddComment={(text) => addComment(post.id, text)} onOpenEvent={eventId === undefined ? (id) => navigate({ name: "event", id }) : undefined} />)}
    </section>
  );
}

export interface FeedDraft {
  event: string;
  text: string;
}

export function feedDraftReady(draft: FeedDraft): boolean {
  return draft.event.trim() !== "" && draft.text.trim() !== "";
}

interface FeedCreateViewProps {
  draft: FeedDraft;
  events: Event[];
  submitting: boolean;
  failed: boolean;
  onChange: (field: keyof FeedDraft, value: string) => void;
  onSubmit: () => void;
}

export function FeedCreateView({ draft, events, submitting, failed, onChange, onSubmit }: FeedCreateViewProps) {
  return (
    <section className="app-gathering">
      <h2 className="app-gathering-title">Новое впечатление</h2>
      <p className="app-gathering-hint">Фото-заглушка и пара слов — пост в ленте</p>
      {/* ponytail: photo upload is a placeholder until the backend accepts post photos */}
      <button type="button" className="app-review-photo" disabled>
        Добавить фото
      </button>
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
      <button type="button" className="app-gathering-launch" disabled={!feedDraftReady(draft) || submitting} onClick={onSubmit}>
        {submitting ? "Публикуем…" : "Опубликовать"}
      </button>
      {failed && <p className="app-state app-state--error">Не удалось опубликовать впечатление.</p>}
    </section>
  );
}

export function FeedCreatePage({ eventId }: { eventId: string | null }) {
  const auth = useAuth();
  const userId = auth.status === "authenticated" ? auth.user.id : DEMO_USER_ID;
  const { navigate } = useRoute();
  const [draft, setDraft] = useState<FeedDraft>({ event: eventId === null ? "" : (mockEvents.find((item) => item.id === eventId)?.title ?? ""), text: "" });
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  const publish = useCallback(() => {
    if (!feedDraftReady(draft)) return;
    setSubmitting(true);
    setFailed(false);
    const event = mockEvents.find((item) => item.title === draft.event.trim());
    apiClient.createFeedPost({ userId, eventId: event?.id ?? draft.event.trim(), text: draft.text.trim() }).then(
      () => navigate({ name: "home" }),
      () => {
        setSubmitting(false);
        setFailed(true);
      },
    );
  }, [draft, userId, navigate]);

  return <FeedCreateView draft={draft} events={mockEvents} submitting={submitting} failed={failed} onChange={(field, value) => setDraft((current) => ({ ...current, [field]: value }))} onSubmit={publish} />;
}
