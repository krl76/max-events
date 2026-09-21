// START_MODULE_CONTRACT
// PURPOSE: Impressions feed (Instagram-стилистика): post cards with a photo placeholder, likes and comments, the event wall (block of the event's posts) and the publish form (photo placeholder + text).
// SCOPE: Data via apiClient.listFeedPosts/toggleFeedLike/addFeedComment/createFeedPost + listEvents (event titles) + listFriends (stories rail); the wall is the same section filtered by eventId; no photo upload (placeholder button).
// DEPENDS: ../api/client.js (apiClient, FeedPost), ../auth/AuthContext.js, ../catalog/format.js (pluralRu), ../routing/router.js, ../max/bridge.js (webApp, shareResult), ../stories/StoryViewer.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - FeedPostCard - presentational Instagram-style post: author header, 4:5 media placeholder, icon actions (like/comment/share), likes line, caption, comments, add form and a «Пожаловаться» report control
// - StoriesRow - stories rail over the home feed: own ring publishes a picked photo or opens the viewer, friend rings with stories open the viewer
// - FeedState - union of the feed fetch states (loading / error / ready)
// - FeedSection - container: posts (optionally one event — the wall), event titles for the cards, like/comment wiring, «+» publish CTA
// - FeedDraft - publish form draft (event title, text)
// - feedDraftReady - the event is picked and the text is non-empty
// - feedEventPicked - resolve the free-text event to a real event id; matched=false means the typed title matches no known event
// - FeedCreateView - presentational publish form: photo placeholder, event datalist, text
// - FeedCreatePage - route container: author id from the auth context, event options via apiClient.listEvents, draft state, publish via createFeedPost
// END_MODULE_MAP

import { useCallback, useEffect, useRef, useState } from "react";
import type { Event, Friend, Story } from "@max-events/api-contracts";
import { apiClient, type FeedPost } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { shareResult, webApp } from "../max/bridge";
import { useRoute } from "../routing/router";
import { ReportButton } from "../event/ReportButton";
import { StoryViewer, type StoryGroup } from "../stories/StoryViewer";
import { AppAvatar, AppButton, AppChip, AppIconButton, AppState, AppSkeleton, AppSection, AppMedia } from "../ui/primitives";
import { ActionIcon } from "../ui/icons";
import { pluralRu } from "../catalog/format";

interface FeedPostCardProps {
  post: FeedPost;
  eventTitle: string;
  eventCategory?: Event["category"];
  userId: string;
  onToggleLike: () => void;
  onAddComment: (text: string) => void;
  onOpenEvent?: (eventId: string) => void;
}

export function FeedPostCard({ post, eventTitle, eventCategory, userId, onToggleLike, onAddComment, onOpenEvent }: FeedPostCardProps) {
  const [comment, setComment] = useState("");
  const commentRef = useRef<HTMLInputElement | null>(null);
  const eventLink = onOpenEvent ? (
    <button type="button" className="app-plan-event" onClick={() => onOpenEvent(post.eventId)}>
      {eventTitle}
    </button>
  ) : (
    <span className="app-post-place-text">{eventTitle}</span>
  );
  return (
    <article className="app-card app-card--post">
      <header className="app-post-head">
        <AppAvatar size={36}>{post.author.name[0]}</AppAvatar>
        <span className="app-post-id">
          <span className="app-post-author">{post.author.name}</span>
          {eventTitle !== "" && <span className="app-post-place">{eventLink}</span>}
        </span>
      </header>
      <AppMedia category={eventCategory} />
      <div className="app-post-actions">
        <button type="button" className="app-post-action" aria-pressed={post.likedByMe} aria-label="Нравится" onClick={onToggleLike}>
          <ActionIcon filled={post.likedByMe} name="heart" />
        </button>
        <button type="button" className="app-post-action" aria-label="Комментировать" onClick={() => commentRef.current?.focus()}>
          <ActionIcon name="comment" />
        </button>
        <button type="button" className="app-post-action" aria-label="Поделиться" onClick={() => void shareResult(webApp, `${post.author.name} — ${eventTitle}: ${post.text}`)}>
          <ActionIcon name="share" />
        </button>
        <span className="app-post-action app-post-action--muted" aria-hidden="true">
          <ActionIcon name="bookmark" />
        </span>
      </div>
      <p className="app-post-likes">
        {post.likesCount} {pluralRu(post.likesCount, "отметка", "отметки", "отметок")} «нравится»
      </p>
      <p className="app-post-caption">
        <span className="app-post-caption-author">{post.author.name}</span> {post.text}
      </p>
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
        <input ref={commentRef} className="app-filters-input" placeholder="Добавить комментарий…" value={comment} onChange={(change) => setComment(change.target.value)} />
        <AppChip disabled={comment.trim() === ""} type="submit">
          Отправить
        </AppChip>
      </form>
      {userId !== "" && <ReportButton target={{ feedPostId: post.id }} userId={userId} />}
    </article>
  );
}

export type FeedState = { status: "loading" } | { status: "error" } | { status: "ready"; posts: FeedPost[] };

export function FeedSection({ eventId, onCreate }: { eventId?: string; onCreate: () => void }) {
  const auth = useAuth();
  const userId = auth.status === "authenticated" ? auth.user.id : null;
  const { navigate } = useRoute();
  const [state, setState] = useState<FeedState>({ status: "loading" });
  const [events, setEvents] = useState<Event[]>([]);

  const load = useCallback(() => {
    apiClient.listFeedPosts(eventId).then(
      (posts) => setState({ status: "ready", posts }),
      () => setState({ status: "error" }),
    );
  }, [eventId]);
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
    (postId: string, text: string) => {
      if (userId === null) return;
      apiClient.addFeedComment(postId, { userId, text }).then(update);
    },
    [userId, update],
  );

  const eventTitle = (id: string) => events.find((item) => item.id === id)?.title ?? "";

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
        <AppState>Пока нет постов — расскажи первым.</AppState>
      ) : (
        state.posts.map((post) => <FeedPostCard key={post.id} post={post} eventTitle={eventTitle(post.eventId)} eventCategory={events.find((item) => item.id === post.eventId)?.category} userId={userId ?? ""} onToggleLike={() => toggleLike(post.id)} onAddComment={(text) => addComment(post.id, text)} onOpenEvent={eventId === undefined ? (id) => navigate({ name: "event", id }) : undefined} />)
      )}
    </AppSection>
  );
}

export function StoriesRow() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [viewer, setViewer] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const auth = useAuth();

  const reloadStories = useCallback(() => {
    apiClient.listStories().then(setStories, () => {});
  }, []);

  useEffect(() => {
    let alive = true;
    apiClient.listFriends().then(
      (list) => {
        if (alive) setFriends(list);
      },
      () => {},
    );
    reloadStories();
    return () => {
      alive = false;
    };
  }, [reloadStories]);

  const myId = auth.status === "authenticated" ? auth.user.id : null;
  const ownStories = myId === null ? [] : stories.filter((item) => item.userId === myId);
  const friendStories = (id: string) => stories.filter((item) => item.userId === id);

  const groups: StoryGroup[] = [...(ownStories.length > 0 ? [{ authorName: "Вы", stories: ownStories }] : []), ...friends.map((friend) => ({ authorName: friend.name, stories: friendStories(friend.id) })).filter((group) => group.stories.length > 0)];

  const publish = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") void apiClient.createStory(reader.result).then(reloadStories, () => {});
    };
    reader.readAsDataURL(file);
  };

  const openOwn = () => {
    if (ownStories.length > 0) setViewer(0);
    else fileRef.current?.click();
  };

  const openFriend = (friend: Friend) => {
    const groupIndex = groups.findIndex((group) => group.stories[0]?.userId === friend.id);
    if (groupIndex >= 0) setViewer(groupIndex);
  };

  return (
    <div className="app-stories" aria-label="Друзья и планы">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        aria-label="Выбрать фото для истории"
        hidden
        onChange={(change) => {
          const file = change.target.files?.[0];
          if (file) publish(file);
          change.target.value = "";
        }}
      />
      <button type="button" className="app-story" onClick={openOwn}>
        <span className={ownStories.length > 0 ? "app-story-ring app-story-ring--own app-story-ring--active" : "app-story-ring app-story-ring--own"}>{ownStories.length > 0 ? <img className="app-story-thumb" src={ownStories[0].imageUrl} alt="" /> : <AppAvatar size={58}>Д</AppAvatar>}</span>
        <span className="app-story-name">Твоя история</span>
      </button>
      {friends.map((friend) => {
        const items = friendStories(friend.id);
        const active = items.length > 0;
        return (
          <button key={friend.id} type="button" className="app-story" disabled={!active} onClick={() => active && openFriend(friend)}>
            <span className={active ? "app-story-ring app-story-ring--active" : "app-story-ring"}>{active ? <img className="app-story-thumb" src={items[0].imageUrl} alt="" /> : <AppAvatar size={58}>{friend.name[0]}</AppAvatar>}</span>
            <span className="app-story-name">{friend.name.split(" ")[0]}</span>
          </button>
        );
      })}
      {viewer !== null && groups.length > 0 && <StoryViewer groups={groups} startGroup={viewer} onClose={() => setViewer(null)} />}
    </div>
  );
}

export interface FeedDraft {
  event: string;
  text: string;
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
  onChange: (field: keyof FeedDraft, value: string) => void;
  onSubmit: () => void;
}

export function FeedCreateView({ draft, events, submitting, failed, eventMissing, onChange, onSubmit }: FeedCreateViewProps) {
  return (
    <section className="app-gathering">
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
      <AppButton disabled={!feedDraftReady(draft) || submitting} onClick={onSubmit} stretched>
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
  const [draft, setDraft] = useState<FeedDraft>({ event: "", text: "" });
  const [events, setEvents] = useState<Event[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [eventMissing, setEventMissing] = useState(false);

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
    apiClient.createFeedPost({ userId, eventId: picked.eventId, text: draft.text.trim() }).then(
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
      onChange={(field, value) => {
        if (field === "event") setEventMissing(false);
        setDraft((current) => ({ ...current, [field]: value }));
      }}
      onSubmit={publish}
    />
  );
}
