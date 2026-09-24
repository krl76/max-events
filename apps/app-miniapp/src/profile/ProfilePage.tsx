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
// - ProfileView - presentational: hero, avatar, identity, counters, actions, entry rows, the grid switch and the grid under it
// - ProfilePage - route container: resolves auth, loads the profile and every counter the screen shows, wires the navigation and the share action
// END_MODULE_MAP

import { useEffect, useState } from "react";
import type { Achievement, Friend, Profile, Subscription, User, WeGroupScreen } from "@max-events/api-contracts";
import { apiClient, type ListSummary, type ProfileCounters, type ProfilePost, type VisitedPlace } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { pluralRu } from "../catalog/format";
import { shareResult, webApp } from "../max/bridge";
import { useRoute } from "../routing/router";
import { ActionIcon, type ActionIconName } from "../ui/icons";
import { AppMedia, AppSkeleton, AppState } from "../ui/primitives";

/** The single line under the name: город and interests, separated the way the design separates them. */
export function profileAbout(profile: Pick<Profile, "city" | "interests">): string {
  return profile.interests.length === 0 ? profile.city : `${profile.city} · ${profile.interests.join(", ")}`;
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
export function ProfilePostGrid({ posts, failed, onOpenPost, onNewPost }: { posts: ProfilePost[] | null; failed: boolean; onOpenPost: (post: ProfilePost) => void; onNewPost: () => void }) {
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
      <AppState hint="Впечатление с фотографией или без — оно встанет плиткой сюда." action={{ label: "Опубликовать впечатление", onClick: onNewPost }}>
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
}

export function ProfileView({ user, profile, counters, lists, subscriptions, following, followers, achievements, weGroups, friendsCount, posts, postsFailed, visitedPlaces, tab, ...entries }: ProfileViewProps) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
  const numbers = profileMetrics(counters);
  const follows = followMetrics({ subscriptions, following, followers });
  const openList = { subscriptions: entries.onSubscriptions, followers: entries.onFollowers };
  return (
    <section className="app-me">
      <div className="app-me-hero">
        {/* Две окружности брендбука вместо фотографии: фото людей бриф запрещает */}
        <span className="app-me-blob app-me-blob--light" aria-hidden="true" />
        <span className="app-me-blob app-me-blob--cool" aria-hidden="true" />
        <span className="app-me-hero-actions">
          <button type="button" className="app-me-hero-action" aria-label="Поделиться профилем" onClick={entries.onShare}>
            <ActionIcon name="upload" size={18} strokeWidth={2} />
          </button>
          {/* «…» ведёт в настройки: другого меню у профиля нет, а шестерёнка на макете отсутствует */}
          <button type="button" className="app-me-hero-action" aria-label="Настройки" onClick={entries.onSettings}>
            <ActionIcon name="dots" size={18} strokeWidth={2} />
          </button>
        </span>
      </div>
      <div className="app-me-avatar-ring">
        <span className="app-me-avatar">{user.avatarUrl === null ? user.firstName.charAt(0).toUpperCase() : <img alt="" src={user.avatarUrl} />}</span>
      </div>
      <h1 className="app-me-name">{name}</h1>
      <p className="app-me-about">{profileAbout(profile)}</p>
      {numbers.length + follows.length > 0 && (
        <div className="app-me-metrics app-me-metrics--wrap">
          {numbers.map((metric) => (
            <span key={metric.label} className="app-me-metric">
              <span className="app-me-metric-value">{metric.value}</span>
              <span className="app-me-metric-label">{metric.label}</span>
            </span>
          ))}
          {/* Подписки и подписчики — кнопки, а не цифры: за каждой стоит список, и это единственное, что отличает их от визитов */}
          {follows.map((metric) => (
            <button key={metric.id} type="button" className="app-me-metric app-me-metric--link" onClick={openList[metric.id]}>
              <span className="app-me-metric-value">{metric.value}</span>
              <span className="app-me-metric-label">{metric.label}</span>
            </button>
          ))}
        </div>
      )}
      <div className="app-me-actions">
        <button type="button" className="app-me-action app-me-action--primary" onClick={entries.onSubscribe}>
          Подписаться
        </button>
        <button type="button" className="app-me-action" onClick={entries.onWrite}>
          Написать
        </button>
        <button type="button" className="app-me-action" onClick={entries.onInvite}>
          Позвать
        </button>
      </div>
      {/* Строки «Подписки» здесь больше нет: подписки переехали в счётчик шапки, откуда их видно, не открывая раздел */}
      <nav className="app-me-rows" aria-label="Разделы профиля">
        <ProfileRow icon="bookmark" title="Списки" hint={lists === null ? null : listsHint(lists)} onClick={entries.onLists} />
        <ProfileRow icon="medal" title="Достижения" hint={achievements === null ? null : achievementsHint(achievements)} onClick={entries.onAchievements} />
        <ProfileRow icon="group" title="Мы · группы" hint={weGroups === null ? null : weGroupsHint(weGroups)} onClick={entries.onWeGroups} />
        <ProfileRow icon="user" title="Друзья" hint={friendsCount === null ? null : friendsHint(friendsCount)} onClick={entries.onFriends} />
      </nav>
      <div className="app-me-tabs" role="tablist" aria-label="Что показывать">
        {PROFILE_TABS.map((candidate) => (
          <button key={candidate.id} type="button" role="tab" id={`app-me-tab-${candidate.id}`} aria-selected={tab === candidate.id} aria-controls="app-me-tabpanel" className={tab === candidate.id ? "app-me-tab app-me-tab--active" : "app-me-tab"} onClick={() => entries.onTab(candidate.id)}>
            {profileTabLabel(candidate.id, candidate.id === "posts" ? (posts?.length ?? null) : visitedPlaces.length)}
          </button>
        ))}
      </div>
      <div id="app-me-tabpanel" role="tabpanel" aria-labelledby={`app-me-tab-${tab}`}>
        {tab === "posts" && <ProfilePostGrid posts={posts} failed={postsFailed} onOpenPost={entries.onOpenPost} onNewPost={entries.onNewPost} />}
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

function useProfileData(userId: string): ProfileData {
  const [data, setData] = useState<ProfileData>(EMPTY_PROFILE_DATA);

  useEffect(() => {
    let alive = true;
    setData(EMPTY_PROFILE_DATA);
    const put = (patch: Partial<ProfileData>) => {
      if (alive) setData((current) => ({ ...current, ...patch }));
    };
    // The profile is the screen; every counter below it is a hint, so a failed hint stays silent
    // (null) and its row simply carries no subtitle instead of blanking the screen.
    apiClient.getProfile().then(
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
    apiClient.listSubscriptions().then(
      (subscriptions) => put({ subscriptions }),
      () => {},
    );
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
  }, [userId]);

  return data;
}

function AuthenticatedProfile({ user }: { user: User }) {
  const { navigate } = useRoute();
  const data = useProfileData(user.id);
  const [tab, setTab] = useState<ProfileTab>("posts");

  if (data.failed) return <AppState error>Не удалось загрузить профиль.</AppState>;
  if (data.profile === null)
    return (
      <div className="app-card" aria-hidden="true">
        <div className="app-card-body">
          <AppSkeleton variant="block" />
          <AppSkeleton />
          <AppSkeleton variant="line-short" />
        </div>
      </div>
    );
  return (
    <ProfileView
      user={user}
      profile={data.profile}
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
      onTab={setTab}
      onSettings={() => navigate({ name: "settings" })}
      onShare={() => void shareResult(webApp, `${[user.firstName, user.lastName].filter(Boolean).join(" ")} в Афише MAX`)}
      // Экрана «Списки» нет: полки живут вкладкой «Сохранённое» экрана «Моё»
      onLists={() => navigate({ name: "plans" })}
      onSubscriptions={() => navigate({ name: "subscriptions" })}
      onFollowers={() => navigate({ name: "followers" })}
      onAchievements={() => navigate({ name: "achievements" })}
      onWeGroups={() => navigate({ name: "we-groups" })}
      onFriends={() => navigate({ name: "friends" })}
      onSubscribe={() => navigate({ name: "subscriptions" })}
      onWrite={() => void shareResult(webApp, `${[user.firstName, user.lastName].filter(Boolean).join(" ")} в Афише MAX`)}
      onInvite={() => navigate({ name: "plan-new" })}
      // Своего экрана у поста нет: он живёт стеной события, куда плитка и ведёт
      onOpenPost={(post) => navigate({ name: "event", id: post.eventId })}
      onNewPost={() => navigate({ name: "feed-new", eventId: null })}
      onOpenPlace={(placeId) => navigate({ name: "place", id: placeId })}
    />
  );
}

export function ProfilePage() {
  const auth = useAuth();

  if (auth.status === "authenticated") return <AuthenticatedProfile user={auth.user} />;
  if (auth.status === "error") {
    return <AppState error>Не удалось войти: {auth.message}</AppState>;
  }
  if (auth.status === "loading") {
    return <AppState>Загрузка…</AppState>;
  }
  return <AppState>Откройте приложение внутри MAX, чтобы авторизоваться.</AppState>;
}
