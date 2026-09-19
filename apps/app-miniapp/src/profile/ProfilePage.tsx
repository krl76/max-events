// START_MODULE_CONTRACT
// PURPOSE: Profile screen: MAX avatar and name, Instagram-style stats, city/interests editing through the profile API, visit statistics block.
// SCOPE: Data via apiClient.getProfile/updateProfile/listCalendar/getVisitStats (mock or live); stats derived from calendar entries; no navigation logic.
// DEPENDS: ../api/client.js (apiClient, CalendarEntry), ../auth/AuthContext.js, ../catalog/CatalogPage.js (CATEGORY_LABELS), @max-events/api-contracts (Profile, UpdateProfile, User, VisitStats), ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ProfileStats - counters derived from calendar entries (events, unique places)
// - profileStats - derive ProfileStats from calendar entries
// - toProfilePatch - form drafts (city, comma-separated interests) -> UpdateProfile payload
// - VisitStatsView - presentational: visit counters per event category (hidden hint when empty)
// - ProfileState - union of profile fetch states (loading / error / ready)
// - ProfileView - presentational: avatar, three-column stats row, name/city, interests, impressions grid (3 columns), visit statistics, edit form
// - ProfilePage - route container: resolves auth, loads profile + stats + friends count + own posts + visit stats, wires saving and grid navigation
// END_MODULE_MAP

import { useCallback, useEffect, useState } from "react";
import type { Profile, UpdateProfile, User, VisitStats } from "@max-events/api-contracts";
import { apiClient, type CalendarEntry, type FeedPost } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { CATEGORY_LABELS } from "../catalog/CatalogPage";
import { AppAvatar, AppButton, AppTitle, AppState, AppSkeleton, AppSection } from "../ui/primitives";
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
  saving: boolean;
  onSave: (patch: UpdateProfile) => void;
  onOpenEvent?: (eventId: string) => void;
}

export function ProfileView({ user, profile, stats, friendsCount, posts, visitStats, saving, onSave, onOpenEvent }: ProfileViewProps) {
  const [editing, setEditing] = useState(false);
  const [cityDraft, setCityDraft] = useState(profile.city);
  const [interestsDraft, setInterestsDraft] = useState(profile.interests.join(", "));
  useEffect(() => {
    setCityDraft(profile.city);
    setInterestsDraft(profile.interests.join(", "));
  }, [profile]);

  return (
    <section className="app-profile">
      <div className="app-profile-header">
        <AppAvatar size={86} src={user.avatarUrl}>
          {user.firstName.charAt(0).toUpperCase()}
        </AppAvatar>
        <div className="app-profile-stats">
          <span className="app-profile-stat">
            <span className="app-profile-stat-value">{stats.events}</span>
            <span className="app-profile-stat-label">События</span>
          </span>
          <span className="app-profile-stat">
            <span className="app-profile-stat-value">{friendsCount}</span>
            <span className="app-profile-stat-label">Друзья</span>
          </span>
          <span className="app-profile-stat">
            <span className="app-profile-stat-value">{stats.places}</span>
            <span className="app-profile-stat-label">Места</span>
          </span>
        </div>
      </div>
      <AppTitle asChild>
        <h1 className="app-profile-name">{[user.firstName, user.lastName].filter(Boolean).join(" ")}</h1>
      </AppTitle>
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
      {editing ? (
        <form
          className="app-profile-form"
          onSubmit={(submit) => {
            submit.preventDefault();
            onSave(toProfilePatch(cityDraft, interestsDraft));
            setEditing(false);
          }}
        >
          <input className="app-profile-input" type="text" aria-label="Город" value={cityDraft} onChange={(change) => setCityDraft(change.target.value)} />
          <input className="app-profile-input" type="text" aria-label="Интересы" placeholder="Интересы через запятую" value={interestsDraft} onChange={(change) => setInterestsDraft(change.target.value)} />
          <div className="app-event-actions-row">
            <AppButton disabled={saving} type="submit">
              {saving ? "Сохранение…" : "Сохранить"}
            </AppButton>
            <AppButton
              tone="secondary"
              onClick={() => {
                setCityDraft(profile.city);
                setInterestsDraft(profile.interests.join(", "));
                setEditing(false);
              }}
            >
              Отмена
            </AppButton>
          </div>
        </form>
      ) : (
        <AppButton className="app-profile-edit" tone="secondary" onClick={() => setEditing(true)}>
          Редактировать
        </AppButton>
      )}
      {posts.length > 0 && (
        <div className="app-profile-grid" aria-label="Впечатления">
          {posts.map((post) => (
            <button key={post.id} type="button" className="app-profile-cell" aria-label={post.text.slice(0, 40)} onClick={onOpenEvent ? () => onOpenEvent(post.eventId) : undefined} />
          ))}
        </div>
      )}
      <VisitStatsView stats={visitStats} />
    </section>
  );
}

interface ProfileData {
  profile: Profile | null;
  failed: boolean;
  saving: boolean;
  stats: ProfileStats;
  friendsCount: number;
  posts: FeedPost[];
  visitStats: VisitStats | null;
}

function useProfileData(userId: string): [ProfileData, (patch: UpdateProfile) => void] {
  const [data, setData] = useState<ProfileData>({ profile: null, failed: false, saving: false, stats: { events: 0, places: 0 }, friendsCount: 0, posts: [], visitStats: null });

  useEffect(() => {
    let alive = true;
    setData({ profile: null, failed: false, saving: false, stats: { events: 0, places: 0 }, friendsCount: 0, posts: [], visitStats: null });
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
    return () => {
      alive = false;
    };
  }, [userId]);

  const save = useCallback(
    (patch: UpdateProfile) => {
      setData((current) => ({ ...current, saving: true }));
      apiClient.updateProfile(patch).then(
        (profile) => {
          setData((current) => ({ ...current, profile, saving: false }));
        },
        () => {
          setData((current) => ({ ...current, saving: false }));
        },
      );
    },
    [userId],
  );

  return [data, save];
}

function AuthenticatedProfile({ user }: { user: User }) {
  const { navigate } = useRoute();
  const [{ profile, failed, saving, stats, friendsCount, posts, visitStats }, save] = useProfileData(user.id);

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
  return <ProfileView user={user} profile={profile} stats={stats} friendsCount={friendsCount} posts={posts} visitStats={visitStats} saving={saving} onSave={save} onOpenEvent={(eventId) => navigate({ name: "event", id: eventId })} />;
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
