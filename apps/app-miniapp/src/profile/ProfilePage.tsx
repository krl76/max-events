// START_MODULE_CONTRACT
// PURPOSE: Profile screen: Instagram-style topbar (settings gear + name), MAX avatar, stats («События»/«Друзья» navigate to the calendar/friends screens), city/interests display, visit statistics block. Editing lives on the settings route.
// SCOPE: Data via apiClient.getProfile/listCalendar/getVisitStats (mock or live); stats derived from calendar entries; no navigation logic.
// DEPENDS: ../api/client.js (apiClient, CalendarEntry), ../auth/AuthContext.js, ../catalog/CatalogPage.js (CATEGORY_LABELS), @max-events/api-contracts (Profile, UpdateProfile, User, VisitStats), ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ProfileStats - counters derived from calendar entries (events, unique places)
// - profileStats - derive ProfileStats from calendar entries
// - toProfilePatch - form drafts (city, comma-separated interests) -> UpdateProfile payload (used by the settings screen)
// - VisitStatsView - presentational: visit counters per event category (hidden hint when empty)
// - ProfileState - union of profile fetch states (loading / error / ready)
// - ProfileView - presentational: topbar (settings gear, centered name), avatar, three-column stats row («События»/«Друзья» as navigation buttons, «Места» as a plain counter), city, interests, impressions grid (3 columns), visit statistics, «Мои подписки»
// - ProfilePage - route container: resolves auth, loads profile + stats + friends count + own posts + visit stats + subscriptions, wires settings, grid navigation and unsubscribe
// END_MODULE_MAP

import { useEffect, useState } from "react";
import type { Profile, Subscription, UpdateProfile, User, VisitStats } from "@max-events/api-contracts";
import { apiClient, type CalendarEntry, type FeedPost } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { CATEGORY_LABELS } from "../catalog/CatalogPage";
import { AppAvatar, AppState, AppSkeleton, AppSection } from "../ui/primitives";
import { ActionIcon } from "../ui/icons";
import { MySubscriptionsView } from "../subscriptions/MySubscriptions";
import { useRoute } from "../routing/router";

export interface ProfileStats {
  events: number;
  places: number;
}

export function profileStats(entries: CalendarEntry[]): ProfileStats {
  return { events: entries.length, places: new Set(entries.map((entry) => entry.place?.id).filter(Boolean)).size };
}

export function toProfilePatch(cityDraft: string, interestsDraft: string): UpdateProfile {
  const city = cityDraft.trim();
  return {
    ...(city === "" ? {} : { city }),
    interests: interestsDraft
      .split(",")
      .map((interest) => interest.trim())
      .filter(Boolean),
  };
}

export type ProfileState = { status: "loading" } | { status: "error" } | { status: "ready"; profile: Profile };

export function VisitStatsView({ stats }: { stats: VisitStats | null }) {
  return (
    <AppSection title="Статистика посещений">
      {stats === null || (stats.eventsCount === 0 && stats.placesCount === 0) ? (
        <p className="app-today-summary">Пока нет посещений — отметьтесь «Я здесь» на странице события.</p>
      ) : (
        <ul className="app-participation-counters">
          {stats.byCategory
            .filter((item) => item.count > 0)
            .map((item) => (
              <li key={item.category}>
                {CATEGORY_LABELS[item.category]}: {item.count}
              </li>
            ))}
        </ul>
      )}
    </AppSection>
  );
}

interface ProfileViewProps {
  user: User;
  profile: Profile;
  stats: ProfileStats;
  friendsCount: number;
  posts: FeedPost[];
  visitStats: VisitStats | null;
  subscriptions?: Subscription[];
  removingSubscriptionId?: string | null;
  unsubscribeFailed?: boolean;
  onUnsubscribe?: (subscriptionId: string) => void;
  onOpenSettings: () => void;
  onOpenEvents: () => void;
  onOpenFriends: () => void;
  onOpenEvent?: (eventId: string) => void;
}

export function ProfileView({ user, profile, stats, friendsCount, posts, visitStats, subscriptions = [], removingSubscriptionId = null, unsubscribeFailed = false, onUnsubscribe = () => {}, onOpenSettings, onOpenEvents, onOpenFriends, onOpenEvent }: ProfileViewProps) {
  return (
    <section className="app-profile">
      <div className="app-profile-topbar">
        <button type="button" className="app-profile-topbar-action" aria-label="Настройки профиля" onClick={onOpenSettings}>
          <ActionIcon name="settings" size={24} />
        </button>
        <span className="app-profile-topbar-name">{user.username ? `@${user.username}` : [user.firstName, user.lastName].filter(Boolean).join(" ")}</span>
      </div>
      <div className="app-profile-header">
        <AppAvatar size={86} src={user.avatarUrl}>
          {user.firstName.charAt(0).toUpperCase()}
        </AppAvatar>
        <div className="app-profile-stats">
          <button type="button" className="app-profile-stat" aria-label="События: открыть календарь" onClick={onOpenEvents}>
            <span className="app-profile-stat-value">{stats.events}</span>
            <span className="app-profile-stat-label">События</span>
          </button>
          <button type="button" className="app-profile-stat" aria-label="Друзья: открыть друзей" onClick={onOpenFriends}>
            <span className="app-profile-stat-value">{friendsCount}</span>
            <span className="app-profile-stat-label">Друзья</span>
          </button>
          <span className="app-profile-stat">
            <span className="app-profile-stat-value">{stats.places}</span>
            <span className="app-profile-stat-label">Места</span>
          </span>
        </div>
      </div>
      <p className="app-profile-city">{profile.city}</p>
      {profile.interests.length > 0 && (
        <div className="app-profile-interests">
          {profile.interests.map((interest) => (
            <span key={interest} className="app-profile-interest">
              {interest}
            </span>
          ))}
        </div>
      )}
      {posts.length > 0 && (
        <div className="app-profile-grid" aria-label="Впечатления">
          {posts.map((post) => (
            <button key={post.id} type="button" className="app-profile-cell" aria-label={post.text.slice(0, 40)} onClick={onOpenEvent ? () => onOpenEvent(post.eventId) : undefined} />
          ))}
        </div>
      )}
      <VisitStatsView stats={visitStats} />
      <MySubscriptionsView subscriptions={subscriptions} removingId={removingSubscriptionId} failed={unsubscribeFailed} onUnsubscribe={onUnsubscribe} />
    </section>
  );
}

interface ProfileData {
  profile: Profile | null;
  failed: boolean;
  stats: ProfileStats;
  friendsCount: number;
  posts: FeedPost[];
  visitStats: VisitStats | null;
  subscriptions: Subscription[];
}

function useProfileData(userId: string): ProfileData {
  const [data, setData] = useState<ProfileData>({ profile: null, failed: false, stats: { events: 0, places: 0 }, friendsCount: 0, posts: [], visitStats: null, subscriptions: [] });

  useEffect(() => {
    let alive = true;
    setData({ profile: null, failed: false, stats: { events: 0, places: 0 }, friendsCount: 0, posts: [], visitStats: null, subscriptions: [] });
    apiClient.getProfile().then(
      (profile) => {
        if (alive) setData((current) => ({ ...current, profile }));
      },
      () => {
        if (alive) setData((current) => ({ ...current, failed: true }));
      },
    );
    apiClient.listCalendar().then(
      (entries) => {
        if (alive) setData((current) => ({ ...current, stats: profileStats(entries) }));
      },
      () => {},
    );
    apiClient.getVisitStats(userId).then(
      (visitStats) => {
        if (alive) setData((current) => ({ ...current, visitStats }));
      },
      () => {},
    );
    apiClient.getFriendsActivity(userId).then(
      (groups) => {
        if (alive) setData((current) => ({ ...current, friendsCount: groups.length }));
      },
      () => {},
    );
    apiClient.listFeedPosts().then(
      (posts) => {
        if (alive) setData((current) => ({ ...current, posts: posts.filter((post) => post.author.id === userId) }));
      },
      () => {},
    );
    apiClient.listSubscriptions().then(
      (subscriptions) => {
        if (alive) setData((current) => ({ ...current, subscriptions }));
      },
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
  const { profile, failed, stats, friendsCount, posts, visitStats, subscriptions } = useProfileData(user.id);
  const [removingSubscriptionId, setRemovingSubscriptionId] = useState<string | null>(null);
  // Removed ids rather than a rewritten list: the loader owns its state, this only hides what is gone.
  const [removedSubscriptionIds, setRemovedSubscriptionIds] = useState<string[]>([]);

  const [unsubscribeFailed, setUnsubscribeFailed] = useState(false);

  const unsubscribe = (subscriptionId: string) => {
    setRemovingSubscriptionId(subscriptionId);
    setUnsubscribeFailed(false);
    apiClient.removeSubscription(subscriptionId).then(
      () => {
        setRemovedSubscriptionIds((ids) => [...ids, subscriptionId]);
        setRemovingSubscriptionId(null);
      },
      () => {
        // The row stays, so the failure has to be said out loud or the button just looks dead.
        setUnsubscribeFailed(true);
        setRemovingSubscriptionId(null);
      },
    );
  };

  if (failed) return <AppState error>Не удалось загрузить профиль.</AppState>;
  if (profile === null)
    return (
      <div className="app-card" aria-hidden="true">
        <div className="app-card-body">
          <AppSkeleton variant="block" />
          <AppSkeleton />
          <AppSkeleton variant="line-short" />
        </div>
      </div>
    );
  return <ProfileView user={user} profile={profile} stats={stats} friendsCount={friendsCount} posts={posts} visitStats={visitStats} subscriptions={subscriptions.filter((row) => !removedSubscriptionIds.includes(row.id))} removingSubscriptionId={removingSubscriptionId} unsubscribeFailed={unsubscribeFailed} onUnsubscribe={unsubscribe} onOpenSettings={() => navigate({ name: "settings" })} onOpenEvents={() => navigate({ name: "calendar" })} onOpenFriends={() => navigate({ name: "friends" })} onOpenEvent={(eventId) => navigate({ name: "event", id: eventId })} />;
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
