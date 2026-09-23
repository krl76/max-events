// START_MODULE_CONTRACT
// PURPOSE: Экран 36 «Профиль»: gradient hero with the share/menu actions, the ring avatar, name and the city · interests line, the three counters, the three social actions, the five entry rows with their counter hints and the grid of impressions.
// SCOPE: The profile screen only — data via apiClient.getProfile/getProfileCounters/listVisitedPlaces/listLists/listSubscriptions/getAchievements/listWeGroups/listFriends; secondary blocks stay silent when their request fails. Editing lives on the settings route (./SettingsPage.tsx).
// DEPENDS: ../api/client.js (apiClient, ProfileCounters, VisitedPlace, ListSummary), ../auth/AuthContext.js, ../catalog/format.js (pluralRu), ../max/bridge.js (shareResult, webApp), ../routing/router.js, ../ui/icons.js, ../ui/primitives.js, @max-events/api-contracts (Achievement, Profile, Subscription, User, WeGroupScreen), ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - profileAbout - «Москва · джаз, падел» — the city and the interests on one line, city alone when there are no interests
// - profileMetrics - the three counters with their ru labels declined for the number; «компании» drops out when nothing counts it (#496)
// - listsHint - «6 готовых полок и 3 своих» from the lists of the viewer
// - subscriptionsHint - «4 организатора, 6 мест, 4 интереса» from the follows, silent about a kind with nothing in it
// - achievementsHint - «1 из 4 собрано»
// - weGroupsHint - «3 активные компании» counting only the groups still open
// - friendsHint - «24 из чатов MAX»
// - visitsLabel - «12 визитов» under an impression cell
// - ProfileRow - one entry row: icon tile, title, counter hint, chevron
// - ProfileEntries - what the entry rows of экран 36 lead to
// - ProfileView - presentational: hero, avatar, identity, counters, actions, entry rows, impressions grid
// - ProfilePage - route container: resolves auth, loads the profile and every counter the rows show, wires the navigation and the share action
// END_MODULE_MAP

import { useEffect, useState } from "react";
import type { Achievement, Profile, Subscription, User, WeGroupScreen } from "@max-events/api-contracts";
import { apiClient, type ListSummary, type ProfileCounters, type VisitedPlace } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { pluralRu } from "../catalog/format";
import { shareResult, webApp } from "../max/bridge";
import { useRoute } from "../routing/router";
import { ActionIcon, type ActionIconName } from "../ui/icons";
import { AppSkeleton, AppState } from "../ui/primitives";

/** The single line under the name: город and interests, separated the way the design separates them. */
export function profileAbout(profile: Pick<Profile, "city" | "interests">): string {
  return profile.interests.length === 0 ? profile.city : `${profile.city} · ${profile.interests.join(", ")}`;
}

/**
 * The three counters. «Компании» is nullable on purpose: no service counts companies yet (#496), and a
 * fabricated zero would read as «ты ни с кем не ходил» instead of «мы пока не считаем».
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

/** «6 готовых полок и 3 своих»: the preset shelves the product ships with, then what the viewer added. */
export function listsHint(lists: ListSummary[]): string {
  const presets = lists.filter((row) => row.list.preset !== null).length;
  const own = lists.length - presets;
  return `${presets} ${pluralRu(presets, "готовая полка", "готовые полки", "готовых полок")} и ${own} ${pluralRu(own, "своя", "свои", "своих")}`;
}

/** «4 организатора, 6 мест, 4 интереса» — a kind nobody follows is left out rather than printed as a zero. */
export function subscriptionsHint(subscriptions: Subscription[]): string {
  const count = (type: Subscription["type"]) => subscriptions.filter((row) => row.type === type).length;
  const parts: { n: number; forms: readonly [string, string, string] }[] = [
    { n: count("organizer"), forms: ["организатор", "организатора", "организаторов"] },
    { n: count("place"), forms: ["место", "места", "мест"] },
    { n: count("interest"), forms: ["интерес", "интереса", "интересов"] },
  ];
  const line = parts.filter((part) => part.n > 0).map((part) => `${part.n} ${pluralRu(part.n, ...part.forms)}`);
  return line.length === 0 ? "Пока ни на кого" : line.join(", ");
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

export interface ProfileEntries {
  onSettings: () => void;
  onShare: () => void;
  onLists: () => void;
  onSubscriptions: () => void;
  onAchievements: () => void;
  onWeGroups: () => void;
  onFriends: () => void;
  onSubscribe: () => void;
  onWrite: () => void;
  onInvite: () => void;
  onOpenPlace: (placeId: string) => void;
}

interface ProfileViewProps extends ProfileEntries {
  user: User;
  profile: Profile;
  counters: ProfileCounters | null;
  lists: ListSummary[] | null;
  subscriptions: Subscription[] | null;
  achievements: Achievement[] | null;
  weGroups: WeGroupScreen[] | null;
  friendsCount: number | null;
  visitedPlaces: VisitedPlace[];
}

export function ProfileView({ user, profile, counters, lists, subscriptions, achievements, weGroups, friendsCount, visitedPlaces, ...entries }: ProfileViewProps) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
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
      {counters !== null && (
        <div className="app-me-metrics">
          {profileMetrics(counters).map((metric) => (
            <span key={metric.label} className="app-me-metric">
              <span className="app-me-metric-value">{metric.value}</span>
              <span className="app-me-metric-label">{metric.label}</span>
            </span>
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
      <nav className="app-me-rows" aria-label="Разделы профиля">
        <ProfileRow icon="bookmark" title="Списки" hint={lists === null ? null : listsHint(lists)} onClick={entries.onLists} />
        <ProfileRow icon="bell" title="Подписки" hint={subscriptions === null ? null : subscriptionsHint(subscriptions)} onClick={entries.onSubscriptions} />
        <ProfileRow icon="medal" title="Достижения" hint={achievements === null ? null : achievementsHint(achievements)} onClick={entries.onAchievements} />
        <ProfileRow icon="group" title="Мы · группы" hint={weGroups === null ? null : weGroupsHint(weGroups)} onClick={entries.onWeGroups} />
        <ProfileRow icon="user" title="Друзья" hint={friendsCount === null ? null : friendsHint(friendsCount)} onClick={entries.onFriends} />
      </nav>
      {visitedPlaces.length > 0 && (
        <div className="app-me-grid" aria-label="Впечатления">
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
    </section>
  );
}

interface ProfileData {
  profile: Profile | null;
  failed: boolean;
  counters: ProfileCounters | null;
  lists: ListSummary[] | null;
  subscriptions: Subscription[] | null;
  achievements: Achievement[] | null;
  weGroups: WeGroupScreen[] | null;
  friendsCount: number | null;
  visitedPlaces: VisitedPlace[];
}

const EMPTY_PROFILE_DATA: ProfileData = { profile: null, failed: false, counters: null, lists: null, subscriptions: null, achievements: null, weGroups: null, friendsCount: null, visitedPlaces: [] };

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
    apiClient.listLists(userId).then(
      (lists) => put({ lists }),
      () => {},
    );
    apiClient.listSubscriptions().then(
      (subscriptions) => put({ subscriptions }),
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
      achievements={data.achievements}
      weGroups={data.weGroups}
      friendsCount={data.friendsCount}
      visitedPlaces={data.visitedPlaces}
      onSettings={() => navigate({ name: "settings" })}
      onShare={() => void shareResult(webApp, `${[user.firstName, user.lastName].filter(Boolean).join(" ")} в Афише MAX`)}
      // Экрана «Списки» нет: полки живут вкладкой «Сохранённое» экрана «Моё»
      onLists={() => navigate({ name: "plans" })}
      onSubscriptions={() => navigate({ name: "subscriptions" })}
      onAchievements={() => navigate({ name: "achievements" })}
      onWeGroups={() => navigate({ name: "we-groups" })}
      onFriends={() => navigate({ name: "friends" })}
      onSubscribe={() => navigate({ name: "subscriptions" })}
      onWrite={() => void shareResult(webApp, `${[user.firstName, user.lastName].filter(Boolean).join(" ")} в Афише MAX`)}
      onInvite={() => navigate({ name: "plan-new" })}
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
