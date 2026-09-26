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
// - FeedDraft - publish form draft (event title, text)
// - feedDraftReady - the event is picked and the text is non-empty
// - feedEventPicked - resolve the free-text event to a real event id; matched=false means the typed title matches no known event
// - FeedCreateView - presentational publish form: photo picker with a preview, event datalist, text
// - FeedCreatePage - route container: author id from the auth context, event options via apiClient.listEvents, draft state, publish via createFeedPost
// - PostAuthorAvatar - author avatar with the story ring when they have one
// END_MODULE_MAP

import { useCallback, useEffect, useRef, useState } from "react";
import type { Event, Friend, Story } from "@max-events/api-contracts";
import { apiClient, type FeedPost } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { shareResult, webApp } from "../max/bridge";
import { readFeedPhoto } from "./photo";
import { useRoute } from "../routing/router";
import { ReportButton } from "../event/ReportButton";
import { SaveToList } from "../event/SaveToList";
import { StoryViewer, type StoryGroup } from "../stories/StoryViewer";
import { OPEN_OWN_STORY } from "../create/StoryCreatePage";
import { markStoriesSeen, readSeenStories, storyRail } from "../stories/rail";
import { AppAvatar, AppButton, AppChip, AppEmptyState, AppIconButton, AppState, AppSkeleton, AppSection, AppMedia } from "../ui/primitives";
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
  hasStory?: boolean;
}

/** Аватар автора поста: фото, если оно есть, и градиентное кольцо только при живой истории. */
export function PostAuthorAvatar({ friend, hasStory = false, size = 36 }: { friend: Friend; hasStory?: boolean; size?: number }) {
  const avatar = (
    <AppAvatar src={friend.avatarUrl} size={size}>
      {friend.name[0]}
    </AppAvatar>
  );
  if (!hasStory) return avatar;
  return <span className="app-story-ring app-story-ring--active">{avatar}</span>;
}

export function FeedPostCard({ post, eventTitle, eventCategory, userId, onToggleLike, onAddComment, onOpenEvent, hasStory = false }: FeedPostCardProps) {
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
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
        <PostAuthorAvatar friend={post.author} hasStory={hasStory} />
        <span className="app-post-id">
          <span className="app-post-author">{post.author.name}</span>
          {eventTitle !== "" && <span className="app-post-place">{eventLink}</span>}
        </span>
      </header>
      {post.photoUrl === null ? <AppMedia category={eventCategory} /> : <img className="app-card-media app-post-photo" src={post.photoUrl} alt="" />}
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
        {userId === "" ? (
          <span className="app-post-action app-post-action--muted" aria-hidden="true">
            <ActionIcon name="bookmark" />
          </span>
        ) : (
          <button type="button" className="app-post-action" aria-pressed={saving} aria-label="Сохранить" onClick={() => setSaving(true)}>
            <ActionIcon name="bookmark" />
          </button>
        )}
      </div>
      {saving && userId !== "" && <SaveToList feedPostId={post.id} userId={userId} open onClose={() => setSaving(false)} />}
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
      onAddComment={(text) => {
        if (userId === "") return;
        apiClient.addFeedComment(post.id, { userId, text }).then(setPost);
      }}
      onOpenEvent={(eventId) => navigate({ name: "event", id: eventId })}
      hasStory={storyAuthors.has(post.author.id)}
    />
  );
}

export type FeedState = { status: "loading" } | { status: "error" } | { status: "ready"; posts: FeedPost[] };

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
        <AppEmptyState kind="empty-feed" onAction={() => navigate({ name: "feed-new", eventId: null })} />
      ) : (
        state.posts.map((post) => <FeedPostCard key={post.id} post={post} eventTitle={eventTitle(post.eventId)} eventCategory={events.find((item) => item.id === post.eventId)?.category} userId={userId ?? ""} onToggleLike={() => toggleLike(post.id)} onAddComment={(text) => addComment(post.id, text)} onOpenEvent={eventId === undefined ? (id) => navigate({ name: "event", id }) : undefined} hasStory={storyAuthors.has(post.author.id)} />)
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
        <button type="button" className="app-story-open" aria-label={rail.own.group === null ? "Твоя история: добавить" : "Твоя история: смотреть"} onClick={() => (rail.own.group === null ? openEditor() : setViewer({ groups: rail.groups, start: rail.own.group }))}>
          <span className={storyRingClass(rail.own.unseen)}>
            {rail.own.coverUrl === null ? (
              <AppAvatar size={58} src={me?.avatarUrl}>
                {me?.firstName[0] ?? "Я"}
              </AppAvatar>
            ) : (
              <img className="app-story-thumb" src={rail.own.coverUrl} alt="" />
            )}
          </span>
        </button>
        <button type="button" className="app-story-plus" aria-label="Добавить историю" onClick={openEditor}>
          <ActionIcon name="plus" size={14} strokeWidth={3} />
        </button>
        <span className="app-story-name">Твоя история</span>
      </div>
      {rail.tiles.map((tile) => (
        <button key={tile.friendId} type="button" className="app-story" onClick={() => setViewer({ groups: rail.groups, start: tile.group })}>
          <span className={storyRingClass(tile.unseen)}>
            <img className="app-story-thumb" src={tile.coverUrl} alt="" />
          </span>
          <span className="app-story-name">{tile.name}</span>
        </button>
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
