// START_MODULE_CONTRACT
// PURPOSE: Экран 36 «Профиль»: gradient hero with the share/menu actions, the ring avatar, name and the city · interests line, the counters — visit numbers plus the two clickable follow counters — the three social actions, the entry rows with their counter hints and the two grids behind the «Посты» / «Впечатления» switch.
// SCOPE: The profile screen only — data via apiClient.getProfile/getProfileCounters/listUserPosts/listVisitedPlaces/listLists/listSubscriptions/listFollowing/listFollowers/getAchievements/listWeGroups/listFriends; secondary blocks stay silent when their request fails. Editing lives on the settings route (./SettingsPage.tsx), the follow lists on ../subscriptions/.
// DEPENDS: ../api/client.js (apiClient, ProfileCounters, ProfilePost, VisitedPlace, ListSummary), ../auth/AuthContext.js, ../catalog/format.js (pluralRu), ../max/bridge.js (shareResult, webApp), ../routing/router.js, ../ui/icons.js, ../ui/primitives.js, @max-events/api-contracts (Achievement, Friend, Profile, Subscription, User, WeGroupScreen), ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - profileAbout - «Москва · джаз, падел» — the city and the interests on one line, city alone when there are no interests
// - profileMetrics - the three visit counters with their ru labels declined for the number; «компании» drops out when nothing counts it (#496)
// - followMetrics - the two clickable counters of the header: everything the viewer follows and everyone following them; a direction that has not arrived is left out rather than printed as a zero
// - socialMetrics - second header row: subscriptions, posts, followers
// - ProfileTab - which grid the profile shows: the posts of the person or the places they have been
// - PROFILE_TABS - the two grids in screen order, «Посты» first
// - profileTabLabel - «Посты · 8» — the tab label with its count, bare until the count arrives
// - listsHint - «6 готовых полок и 3 своих» from the lists of the viewer
// - achievementsHint - «1 из 4 собрано»
// - weGroupsHint - «3 активные компании» counting only the groups still open
// - friendsHint - «24 из чатов MAX»
// - visitsLabel - «12 визитов» under an impression cell
// - ProfileRow - one entry row: icon tile, title, counter hint, chevron
// - ProfilePostGrid - the post grid of the profile with its three states: the tiles, the invitation to publish, the loading placeholders
// - ProfileEntries - what the entry rows, the counters and the grids of экран 36 lead to
// - isCustomProfileAvatar - in-app pick is a data URL; MAX photo_url is https
// - ProfileMediaDialog - popup to add/change a photo or delete it back to the original (avatar or cover)
// - ProfileView - presentational: hero, avatar, identity, counters, actions, entry rows, the grid switch and the grid under it
// - ProfilePage - route container: resolves auth, loads the profile and every counter the screen shows, wires the navigation and the share action
// END_MODULE_MAP

import { useCallback, useEffect, useRef, useState } from "react";
import type { Achievement, Friend, Profile, Subscription, User, WeGroupScreen } from "@max-events/api-contracts";
import { apiClient, type ListSummary, type ProfileCounters, type ProfilePost, type VisitedPlace } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { pluralRu } from "../catalog/format";
import { readFeedPhoto } from "../feed/photo";
import { shareResult, webApp } from "../max/bridge";
import { useRoute } from "../routing/router";
import { ActionIcon, type ActionIconName } from "../ui/icons";
import { AppMedia, AppSkeleton, AppState } from "../ui/primitives";

/** The single line under the name: город and interests, separated the way the design separates them. */
export function profileAbout(profile: Pick<Profile, "city" | "interests" | "bio">): string {
  const line = profile.interests.length === 0 ? profile.city : `${profile.city} · ${profile.interests.join(", ")}`;
  return profile.bio.trim() === "" ? line : `${line}\n${profile.bio.trim()}`;
}

/**
 * The three visit counters. «Компании» is nullable on purpose: no service counts companies yet (#496),
 * and a fabricated zero would read as «ты ни с кем не ходил» instead of «мы пока не считаем».
 */
export function profileMetrics(counters: ProfileCounters | null): { value: number; label: string }[] {
  if (counters === null) return [];
  const metrics = [
    { value: counters.eventsCount, label: pluralRu(counters.eventsCount, "событие", "события", "событий") },
    { value: counters.placesCount, label: pluralRu(counters.placesCount, "место", "места", "мест") },
  ];
  if (counters.companiesCount !== null) metrics.push({ value: counters.companiesCount, label: pluralRu(counters.companiesCount, "компания", "компании", "компаний") });
  return metrics;
}

/**
 * The two counters a social profile is read by, and the only ones on this screen that lead anywhere.
 *
 * «Подписки» is one number over two stores on purpose: the viewer follows organizers, places and
 * interests (`subscriptions`) and also people (the follow set of экран 02, which is not a Subscription,
 * #501). Two numbers under one word on one screen would be a riddle, so the header prints the total and
 * the list behind it shows all four kinds. A direction whose request has not answered yet is left out
 * entirely — a counter stuck on zero reads as «никто», which is worse than no counter at all.
 */
export function followMetrics(input: { subscriptions: Subscription[] | null; following: Friend[] | null; followers: Friend[] | null }): { id: "subscriptions" | "followers"; value: number; label: string }[] {
  const metrics: { id: "subscriptions" | "followers"; value: number; label: string }[] = [];
  if (input.subscriptions !== null && input.following !== null) {
    const value = input.subscriptions.length + input.following.length;
    metrics.push({ id: "subscriptions", value, label: pluralRu(value, "подписка", "подписки", "подписок") });
  }
  if (input.followers !== null) {
    const value = input.followers.length;
    metrics.push({ id: "followers", value, label: pluralRu(value, "подписчик", "подписчика", "подписчиков") });
  }
  return metrics;
}

/** Second header row: subscriptions, posts, followers — visits stay on the row above. */
export function socialMetrics(input: { posts: number | null; subscriptions: Subscription[] | null; following: Friend[] | null; followers: Friend[] | null }): { id: "posts" | "subscriptions" | "followers"; value: number; label: string }[] {
  const follows = followMetrics(input);
  const posts = input.posts === null ? [] : [{ id: "posts" as const, value: input.posts, label: pluralRu(input.posts, "пост", "поста", "постов") }];
  const subscriptions = follows.filter((metric) => metric.id === "subscriptions");
  const followers = follows.filter((metric) => metric.id === "followers");
  return [...subscriptions, ...posts, ...followers];
}

export type ProfileTab = "posts" | "places";

/** Screen order: what the person published comes before where they have been, as on any social profile. */
export const PROFILE_TABS: ReadonlyArray<{ id: ProfileTab; label: string }> = [
  { id: "posts", label: "Посты" },
  { id: "places", label: "Впечатления" },
];

/** «Посты · 8». The count is dropped rather than shown as 0 while the request is still on its way. */
export function profileTabLabel(tab: ProfileTab, count: number | null): string {
  const label = PROFILE_TABS.find((candidate) => candidate.id === tab)!.label;
  return count === null ? label : `${label} · ${count}`;
}

/** «6 готовых полок и 3 своих»: the preset shelves the product ships with, then what the viewer added. */
export function listsHint(lists: ListSummary[]): string {
  const presets = lists.filter((row) => row.list.preset !== null).length;
  const own = lists.length - presets;
  return `${presets} ${pluralRu(presets, "готовая полка", "готовые полки", "готовых полок")} и ${own} ${pluralRu(own, "своя", "свои", "своих")}`;
}

export function achievementsHint(achievements: Achievement[]): string {
  return `${achievements.filter((item) => item.grantedAt !== null).length} из ${achievements.length} собрано`;
}

/** «3 активные компании»: an archived group is a memory, not a company you are still in. */
export function weGroupsHint(groups: WeGroupScreen[]): string {
  const active = groups.filter((row) => row.group.archivedAt === null).length;
  return `${active} ${pluralRu(active, "активная компания", "активные компании", "активных компаний")}`;
}

export function friendsHint(friends: number): string {
  return `${friends} из чатов MAX`;
}

export function visitsLabel(visits: number): string {
  return `${visits} ${pluralRu(visits, "визит", "визита", "визитов")}`;
}

export function ProfileRow({ icon, title, hint, onClick }: { icon: ActionIconName; title: string; hint: string | null; onClick: () => void }) {
  return (
    <button type="button" className="app-me-row" onClick={onClick}>
      <span className="app-me-row-icon" aria-hidden="true">
        <ActionIcon name={icon} size={20} strokeWidth={2.2} />
      </span>
      <span className="app-me-row-text">
        <span className="app-me-row-title">{title}</span>
        {hint !== null && <span className="app-me-row-hint">{hint}</span>}
      </span>
      <ActionIcon name="chevron" size={20} strokeWidth={2.4} />
    </button>
  );
}

/** How many placeholder tiles the loading grid holds: two full rows, so the block has the height it will keep. */
const POST_SKELETON_TILES = 6;

/**
 * The post grid and the three states it can be in. A tile carries no text — none would fit — so it is
 * recognised by its cover and its counters: the author's own impression photo when there is one, and
 * the category gradient of the event otherwise, because the product shows no photographs of people.
 */
export function ProfilePostGrid({ posts, failed, onOpenPost, onNewPost, canPublish = true }: { posts: ProfilePost[] | null; failed: boolean; onOpenPost: (post: ProfilePost) => void; onNewPost: () => void; canPublish?: boolean }) {
  if (failed) return <AppState error>Не удалось загрузить посты.</AppState>;
  if (posts === null)
    return (
      <div className="app-me-posts" role="status" aria-label="Загружаем посты">
        {Array.from({ length: POST_SKELETON_TILES }, (_, index) => (
          <AppSkeleton key={index} variant="block" className="app-me-post-skeleton" />
        ))}
      </div>
    );
  if (posts.length === 0) {
    return (
      <AppState hint={canPublish ? "Впечатление с фотографией или без — оно встанет плиткой сюда." : undefined} action={canPublish ? { label: "Опубликовать впечатление", onClick: onNewPost } : undefined}>
        Постов пока нет
      </AppState>
    );
  }
  return (
    <div className="app-me-posts">
      {posts.map((post) => (
        <button key={post.postId} type="button" className="app-me-post" aria-label={`Пост о событии «${post.eventTitle}»`} onClick={() => onOpenPost(post)}>
          {post.photoUrl === null ? <AppMedia category={post.category} className="app-me-post-media" /> : <img className="app-me-post-photo" alt="" src={post.photoUrl} />}
          <span className="app-me-post-stats" aria-hidden="true">
            <span className="app-me-post-stat">
              <ActionIcon name="heart" size={14} strokeWidth={2.4} />
              {post.likesCount}
            </span>
            <span className="app-me-post-stat">
              <ActionIcon name="comment" size={14} strokeWidth={2.4} />
              {post.commentsCount}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

export interface ProfileEntries {
  onSettings: () => void;
  onShare: () => void;
  onLists: () => void;
  onSubscriptions: () => void;
  onFollowers: () => void;
  onAchievements: () => void;
  onWeGroups: () => void;
  onFriends: () => void;
  onSubscribe: () => void;
  onWrite: () => void;
  onInvite: () => void;
  onOpenPost: (post: ProfilePost) => void;
  onNewPost: () => void;
  onOpenPlace: (placeId: string) => void;
  onTab: (tab: ProfileTab) => void;
  onPickAvatar?: () => void;
  onPickCover?: () => void;
  onResetAvatar?: () => void;
  onResetCover?: () => void;
}

/** In-app pick is a data URL until object storage lands; MAX photo_url is https. */
export function isCustomProfileAvatar(avatarUrl: string | null): boolean {
  return avatarUrl !== null && avatarUrl.startsWith("data:");
}

function stopPointer(event: { preventDefault: () => void; stopPropagation: () => void }): void {
  event.preventDefault();
  event.stopPropagation();
}

export function ProfileMediaDialog({ title, custom, onPick, onReset, onClose }: { title: string; custom: boolean; onPick: () => void; onReset?: () => void; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="app-me-pop" role="dialog" aria-modal="true" aria-labelledby="app-me-pop-title">
      <button
        type="button"
        className="app-me-pop-scrim"
        tabIndex={-1}
        aria-label="Закрыть"
        onPointerDown={(event) => {
          stopPointer(event);
          onClose();
        }}
      />
      <div className="app-me-pop-card" onPointerDown={stopPointer}>
        <h2 id="app-me-pop-title" className="app-me-pop-title">
          {title}
        </h2>
        <button
          type="button"
          className="app-me-pop-action"
          onPointerDown={(event) => {
            stopPointer(event);
            onPick();
          }}
        >
          {custom ? "Изменить фото" : "Добавить фото"}
        </button>
        {custom && onReset !== undefined && (
          <button
            type="button"
            className="app-me-pop-action app-me-pop-action--danger"
            onPointerDown={(event) => {
              stopPointer(event);
              onReset();
            }}
          >
            Удалить
          </button>
        )}
        <button
          type="button"
          className="app-me-pop-action app-me-pop-action--ghost"
          onPointerDown={(event) => {
            stopPointer(event);
            onClose();
          }}
        >
          Отмена
        </button>
      </div>
    </div>
  );
}

interface ProfileViewProps extends ProfileEntries {
  user: User;
  profile: Profile;
  counters: ProfileCounters | null;
  lists: ListSummary[] | null;
  subscriptions: Subscription[] | null;
  following: Friend[] | null;
  followers: Friend[] | null;
  achievements: Achievement[] | null;
  weGroups: WeGroupScreen[] | null;
  friendsCount: number | null;
  posts: ProfilePost[] | null;
  postsFailed: boolean;
  visitedPlaces: VisitedPlace[];
  tab: ProfileTab;
  /** Own profile: no subscribe/write/invite, avatar and cover are editable. */
  own?: boolean;
  followingThem?: boolean;
  subscribePending?: boolean;
}

export function ProfileView({ user, profile, counters, lists, subscriptions, following, followers, achievements, weGroups, friendsCount, posts, postsFailed, visitedPlaces, tab, own = true, followingThem = false, subscribePending = false, ...entries }: ProfileViewProps) {
  const [mediaMenu, setMediaMenu] = useState<"avatar" | "cover" | null>(null);
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
  const numbers = profileMetrics(counters);
  const social = socialMetrics({ posts: posts === null ? null : posts.length, subscriptions, following, followers });
  const openList = { posts: () => entries.onTab("posts"), subscriptions: entries.onSubscriptions, followers: entries.onFollowers };
  const about = profileAbout(profile);
  const customAvatar = isCustomProfileAvatar(user.avatarUrl);
  const customCover = profile.coverUrl !== null;
  return (
    <section className="app-me">
      <div className="app-me-hero">
        {profile.coverUrl !== null ? <img className="app-me-hero-cover" src={profile.coverUrl} alt="" /> : null}
        <span className="app-me-blob app-me-blob--light" aria-hidden="true" />
        <span className="app-me-blob app-me-blob--cool" aria-hidden="true" />
        {own && entries.onPickCover !== undefined && (
          <div className="app-me-hero-edits">
            <button type="button" className="app-me-hero-edit" aria-label="Сменить шапку" aria-haspopup="dialog" aria-expanded={mediaMenu === "cover"} onClick={() => setMediaMenu("cover")}>
              <ActionIcon name="upload" size={16} strokeWidth={2} />
              Шапка
            </button>
          </div>
        )}
        <span className="app-me-hero-actions">
          <button type="button" className="app-me-hero-action" aria-label="Поделиться профилем" onClick={entries.onShare}>
            <ActionIcon name="upload" size={18} strokeWidth={2} />
          </button>
          {own && (
            <button type="button" className="app-me-hero-action" aria-label="Настройки" onClick={entries.onSettings}>
              <ActionIcon name="dots" size={18} strokeWidth={2} />
            </button>
          )}
        </span>
      </div>
      {own && entries.onPickAvatar !== undefined ? (
        <button type="button" className="app-me-avatar-ring" aria-label="Сменить аватар" aria-haspopup="dialog" aria-expanded={mediaMenu === "avatar"} onClick={() => setMediaMenu("avatar")}>
          <span className="app-me-avatar">{user.avatarUrl === null ? user.firstName.charAt(0).toUpperCase() : <img alt="" src={user.avatarUrl} />}</span>
        </button>
      ) : (
        <div className="app-me-avatar-ring">
          <span className="app-me-avatar">{user.avatarUrl === null ? user.firstName.charAt(0).toUpperCase() : <img alt="" src={user.avatarUrl} />}</span>
        </div>
      )}
      {mediaMenu === "avatar" && entries.onPickAvatar !== undefined && (
        <ProfileMediaDialog
          title="Фото профиля"
          custom={customAvatar}
          onPick={() => {
            setMediaMenu(null);
            entries.onPickAvatar?.();
          }}
          onReset={
            customAvatar && entries.onResetAvatar !== undefined
              ? () => {
                  entries.onResetAvatar?.();
                  setMediaMenu(null);
                }
              : undefined
          }
          onClose={() => setMediaMenu(null)}
        />
      )}
      {mediaMenu === "cover" && entries.onPickCover !== undefined && (
        <ProfileMediaDialog
          title="Шапка профиля"
          custom={customCover}
          onPick={() => {
            setMediaMenu(null);
            entries.onPickCover?.();
          }}
          onReset={
            customCover && entries.onResetCover !== undefined
              ? () => {
                  entries.onResetCover?.();
                  setMediaMenu(null);
                }
              : undefined
          }
          onClose={() => setMediaMenu(null)}
        />
      )}
      <h1 className="app-me-name">{name}</h1>
      <p className="app-me-about">{about}</p>
      {(numbers.length > 0 || social.length > 0) && (
        <div className="app-me-metrics">
          {numbers.length > 0 && (
            <div className="app-me-metrics-row">
              {numbers.map((metric) => (
                <span key={metric.label} className="app-me-metric">
                  <span className="app-me-metric-value">{metric.value}</span>
                  <span className="app-me-metric-label">{metric.label}</span>
                </span>
              ))}
            </div>
          )}
          {social.length > 0 && (
            <div className="app-me-metrics-row">
              {social.map((metric) => (
                <button key={metric.id} type="button" className="app-me-metric app-me-metric--link" onClick={openList[metric.id]}>
                  <span className="app-me-metric-value">{metric.value}</span>
                  <span className="app-me-metric-label">{metric.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {!own && (
        <div className="app-me-actions">
          <button type="button" className="app-me-action app-me-action--primary" disabled={subscribePending} onClick={entries.onSubscribe}>
            {followingThem ? "Отписаться" : "Подписаться"}
          </button>
          <button type="button" className="app-me-action" onClick={entries.onWrite}>
            Написать
          </button>
          <button type="button" className="app-me-action" onClick={entries.onInvite}>
            Позвать
          </button>
        </div>
      )}
      {own && (
        <nav className="app-me-rows" aria-label="Разделы профиля">
          <ProfileRow icon="bookmark" title="Списки" hint={lists === null ? null : listsHint(lists)} onClick={entries.onLists} />
          <ProfileRow icon="medal" title="Достижения" hint={achievements === null ? null : achievementsHint(achievements)} onClick={entries.onAchievements} />
          <ProfileRow icon="group" title="Мы · группы" hint={weGroups === null ? null : weGroupsHint(weGroups)} onClick={entries.onWeGroups} />
          <ProfileRow icon="user" title="Друзья" hint={friendsCount === null ? null : friendsHint(friendsCount)} onClick={entries.onFriends} />
        </nav>
      )}
      <div className="app-me-tabs" role="tablist" aria-label="Что показывать">
        {PROFILE_TABS.map((candidate) => (
          <button key={candidate.id} type="button" role="tab" id={`app-me-tab-${candidate.id}`} aria-selected={tab === candidate.id} aria-controls="app-me-tabpanel" className={tab === candidate.id ? "app-me-tab app-me-tab--active" : "app-me-tab"} onClick={() => entries.onTab(candidate.id)}>
            {profileTabLabel(candidate.id, candidate.id === "posts" ? (posts?.length ?? null) : visitedPlaces.length)}
          </button>
        ))}
      </div>
      <div id="app-me-tabpanel" role="tabpanel" aria-labelledby={`app-me-tab-${tab}`}>
        {tab === "posts" && <ProfilePostGrid posts={posts} failed={postsFailed} onOpenPost={entries.onOpenPost} onNewPost={entries.onNewPost} canPublish={own} />}
        {tab === "places" && visitedPlaces.length === 0 && <AppState>Мест пока нет — отметьтесь где-нибудь, и они появятся здесь.</AppState>}
        {tab === "places" && visitedPlaces.length > 0 && (
          <div className="app-me-grid">
            {visitedPlaces.map((place, index) => (
              <button key={place.placeId} type="button" className={`app-me-cell app-me-cell--${(index % 4) + 1}`} onClick={() => entries.onOpenPlace(place.placeId)}>
                <span className="app-me-cell-blob" aria-hidden="true" />
                <span className="app-me-cell-veil">
                  <span className="app-me-cell-title">{place.title}</span>
                  <span className="app-me-cell-visits">{visitsLabel(place.visits)}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

interface ProfileData {
  profile: Profile | null;
  failed: boolean;
  counters: ProfileCounters | null;
  lists: ListSummary[] | null;
  subscriptions: Subscription[] | null;
  following: Friend[] | null;
  followers: Friend[] | null;
  achievements: Achievement[] | null;
  weGroups: WeGroupScreen[] | null;
  friendsCount: number | null;
  posts: ProfilePost[] | null;
  postsFailed: boolean;
  visitedPlaces: VisitedPlace[];
}

const EMPTY_PROFILE_DATA: ProfileData = { profile: null, failed: false, counters: null, lists: null, subscriptions: null, following: null, followers: null, achievements: null, weGroups: null, friendsCount: null, posts: null, postsFailed: false, visitedPlaces: [] };

function useProfileData(userId: string, own: boolean): ProfileData {
  const [data, setData] = useState<ProfileData>(EMPTY_PROFILE_DATA);

  useEffect(() => {
    let alive = true;
    setData(EMPTY_PROFILE_DATA);
    const put = (patch: Partial<ProfileData>) => {
      if (alive) setData((current) => ({ ...current, ...patch }));
    };
    // Own profile is GET /profile; anyone else's is GET /users/:id/profile. A failed hint stays silent.
    (own ? apiClient.getProfile() : apiClient.getUserProfile(userId)).then(
      (profile) => put({ profile }),
      () => put({ failed: true }),
    );
    apiClient.getProfileCounters(userId).then(
      (counters) => put({ counters }),
      () => {},
    );
    apiClient.listVisitedPlaces(userId).then(
      (visitedPlaces) => put({ visitedPlaces }),
      () => {},
    );
    // The posts are a block of the screen rather than a hint, so their failure is said out loud:
    // silence here would leave the grid in its loading state for good.
    apiClient.listUserPosts(userId).then(
      (posts) => put({ posts }),
      () => put({ postsFailed: true }),
    );
    apiClient.listLists(userId).then(
      (lists) => put({ lists }),
      () => {},
    );
    // Organizer/place/interest follows belong to the viewer. On someone else's profile the header
    // counts only people they follow, so this store is not mixed in.
    if (own) {
      apiClient.listSubscriptions().then(
        (subscriptions) => put({ subscriptions }),
        () => {},
      );
    } else {
      put({ subscriptions: [] });
    }
    apiClient.listFollowing(userId).then(
      (following) => put({ following }),
      () => {},
    );
    apiClient.listFollowers(userId).then(
      (followers) => put({ followers }),
      () => {},
    );
    apiClient.getAchievements(userId).then(
      (achievements) => put({ achievements }),
      () => {},
    );
    apiClient.listWeGroups().then(
      (weGroups) => put({ weGroups }),
      () => {},
    );
    apiClient.listFriends().then(
      (friends) => put({ friendsCount: friends.length }),
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [userId, own]);

  return data;
}

function AuthenticatedProfile({ viewer, subjectId }: { viewer: User; subjectId: string | null }) {
  const { navigate } = useRoute();
  const { updateUser } = useAuth();
  const own = subjectId === null || subjectId === viewer.id;
  const data = useProfileData(own ? viewer.id : subjectId, own);
  const [tab, setTab] = useState<ProfileTab>("posts");
  const [subject, setSubject] = useState<User | null>(own ? viewer : null);
  const [followingThem, setFollowingThem] = useState(false);
  const [subscribePending, setSubscribePending] = useState(false);
  const [myFollows, setMyFollows] = useState<string[]>([]);
  const [localCover, setLocalCover] = useState<string | null | undefined>(undefined);
  const avatarRef = useRef<HTMLInputElement | null>(null);
  const coverRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (own) {
      setSubject(viewer);
      return;
    }
    let alive = true;
    apiClient.getUser(subjectId).then(
      (user) => {
        if (alive) setSubject(user);
      },
      () => {
        if (alive) setSubject(null);
      },
    );
    apiClient.listFollowing(viewer.id).then(
      (list) => {
        if (!alive) return;
        setMyFollows(list.map((person) => person.id));
        setFollowingThem(list.some((person) => person.id === subjectId));
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [own, subjectId, viewer]);

  const pickMedia = useCallback(
    (kind: "avatar" | "cover", file: File) => {
      void readFeedPhoto(file).then((url) => {
        if (url === null) return;
        if (kind === "avatar") {
          apiClient.updateProfile({ avatarUrl: url }).then(() => updateUser({ ...viewer, avatarUrl: url }));
        } else {
          apiClient.updateProfile({ coverUrl: url }).then(() => setLocalCover(url));
        }
      });
    },
    [updateUser, viewer],
  );

  const toggleFollow = useCallback(() => {
    if (own || subjectId === null) return;
    setSubscribePending(true);
    const next = followingThem ? myFollows.filter((id) => id !== subjectId) : [...myFollows, subjectId];
    apiClient.followFriends(next).then(
      (stored) => {
        setMyFollows(stored);
        setFollowingThem(stored.includes(subjectId));
        setSubscribePending(false);
      },
      () => setSubscribePending(false),
    );
  }, [followingThem, myFollows, own, subjectId]);

  if (data.failed) return <AppState error>Не удалось загрузить профиль.</AppState>;
  if (data.profile === null || subject === null)
    return (
      <div className="app-card" aria-hidden="true">
        <div className="app-card-body">
          <AppSkeleton variant="block" />
          <AppSkeleton />
          <AppSkeleton variant="line-short" />
        </div>
      </div>
    );
  const shownUser = own ? viewer : subject;
  const loadedProfile = data.profile;
  return (
    <>
      <input
        ref={avatarRef}
        type="file"
        accept="image/*"
        hidden
        aria-label="Файл аватара"
        onChange={(change) => {
          const file = change.target.files?.[0];
          if (file) pickMedia("avatar", file);
          change.target.value = "";
        }}
      />
      <input
        ref={coverRef}
        type="file"
        accept="image/*"
        hidden
        aria-label="Файл шапки"
        onChange={(change) => {
          const file = change.target.files?.[0];
          if (file) pickMedia("cover", file);
          change.target.value = "";
        }}
      />
      <ProfileView
        user={shownUser}
        profile={localCover === undefined ? loadedProfile : { ...loadedProfile, coverUrl: localCover }}
        counters={data.counters}
        lists={data.lists}
        subscriptions={data.subscriptions}
        following={data.following}
        followers={data.followers}
        achievements={data.achievements}
        weGroups={data.weGroups}
        friendsCount={data.friendsCount}
        posts={data.posts}
        postsFailed={data.postsFailed}
        visitedPlaces={data.visitedPlaces}
        tab={tab}
        own={own}
        followingThem={followingThem}
        subscribePending={subscribePending}
        onTab={setTab}
        onSettings={() => navigate({ name: "settings" })}
        onShare={() => void shareResult(webApp, `${[shownUser.firstName, shownUser.lastName].filter(Boolean).join(" ")} в Афише MAX`)}
        onLists={() => navigate({ name: "plans" })}
        onSubscriptions={() => navigate({ name: "subscriptions" })}
        onFollowers={() => navigate({ name: "followers" })}
        onAchievements={() => navigate({ name: "achievements" })}
        onWeGroups={() => navigate({ name: "we-groups" })}
        onFriends={() => navigate({ name: "friends" })}
        onSubscribe={toggleFollow}
        onWrite={() => void shareResult(webApp, `${[shownUser.firstName, shownUser.lastName].filter(Boolean).join(" ")} в Афише MAX`)}
        onInvite={() => navigate({ name: "plan-new" })}
        onOpenPost={(post) => navigate({ name: "post", id: post.postId })}
        onNewPost={() => navigate({ name: "feed-new", eventId: null })}
        onOpenPlace={(placeId) => navigate({ name: "place", id: placeId })}
        onPickAvatar={own ? () => avatarRef.current?.click() : undefined}
        onPickCover={own ? () => coverRef.current?.click() : undefined}
        onResetAvatar={
          own
            ? () => {
                const previous = viewer;
                updateUser({ ...viewer, avatarUrl: null });
                apiClient.updateProfile({ avatarUrl: null }).then(
                  () => {
                    apiClient.getMe().then(({ user: next }) => updateUser(next), () => {});
                  },
                  () => updateUser(previous),
                );
              }
            : undefined
        }
        onResetCover={
          own
            ? () => {
                const previous = localCover === undefined ? loadedProfile.coverUrl : localCover;
                setLocalCover(null);
                apiClient.updateProfile({ coverUrl: null }).then(
                  () => {},
                  () => setLocalCover(previous),
                );
              }
            : undefined
        }
      />
    </>
  );
}

export function ProfilePage({ userId = null }: { userId?: string | null }) {
  const auth = useAuth();

  if (auth.status === "authenticated") return <AuthenticatedProfile viewer={auth.user} subjectId={userId} />;
  if (auth.status === "error") {
    return <AppState error>Не удалось войти: {auth.message}</AppState>;
  }
  if (auth.status === "loading") {
    return <AppState>Загрузка…</AppState>;
  }
  return <AppState>Откройте приложение внутри MAX, чтобы авторизоваться.</AppState>;
}
