// START_MODULE_CONTRACT
// PURPOSE: Profile screen: MAX avatar and name, Instagram-style stats, city/interests editing through the profile API.
// SCOPE: Data via apiClient.getProfile/updateProfile/listCalendar (mock or live); stats derived from calendar entries; no navigation logic.
// DEPENDS: ../api/client.js (apiClient, CalendarEntry), ../auth/AuthContext.js, @max-events/api-contracts (Profile, UpdateProfile, User), ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ProfileStats - counters derived from calendar entries (events, unique places)
// - profileStats - derive ProfileStats from calendar entries
// - toProfilePatch - form drafts (city, comma-separated interests) -> UpdateProfile payload
// - ProfileState - union of profile fetch states (loading / error / ready)
// - ProfileView - presentational: avatar, name, stats row, profile facts, edit form
// - ProfilePage - route container: resolves auth, loads profile + stats, wires saving
// END_MODULE_MAP

import { useCallback, useEffect, useState } from "react";
import type { Profile, UpdateProfile, User } from "@max-events/api-contracts";
import { apiClient, type CalendarEntry } from "../api/client";
import { useAuth } from "../auth/AuthContext";

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

interface ProfileViewProps {
  user: User;
  profile: Profile;
  stats: ProfileStats;
  saving: boolean;
  onSave: (patch: UpdateProfile) => void;
}

export function ProfileView({ user, profile, stats, saving, onSave }: ProfileViewProps) {
  const [cityDraft, setCityDraft] = useState(profile.city);
  const [interestsDraft, setInterestsDraft] = useState(profile.interests.join(", "));
  useEffect(() => {
    setCityDraft(profile.city);
    setInterestsDraft(profile.interests.join(", "));
  }, [profile]);

  return (
    <section className="app-profile">
      <div className="app-profile-header">
        <span className="app-profile-avatar" aria-hidden="true">
          {user.avatarUrl === null ? user.firstName.charAt(0).toUpperCase() : <img src={user.avatarUrl} alt="" />}
        </span>
        <div className="app-profile-stats">
          <span className="app-profile-stat">
            <span className="app-profile-stat-value">{stats.events}</span>
            <span className="app-profile-stat-label">События</span>
          </span>
          <span className="app-profile-stat">
            <span className="app-profile-stat-value">{stats.places}</span>
            <span className="app-profile-stat-label">Места</span>
          </span>
        </div>
      </div>
      <h1 className="app-profile-name">{[user.firstName, user.lastName].filter(Boolean).join(" ")}</h1>
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
      <form
        className="app-profile-form"
        onSubmit={(submit) => {
          submit.preventDefault();
          onSave(toProfilePatch(cityDraft, interestsDraft));
        }}
      >
        <input className="app-profile-input" type="text" aria-label="Город" value={cityDraft} onChange={(change) => setCityDraft(change.target.value)} />
        <input className="app-profile-input" type="text" aria-label="Интересы" placeholder="Интересы через запятую" value={interestsDraft} onChange={(change) => setInterestsDraft(change.target.value)} />
        <button type="submit" className="app-profile-save" disabled={saving}>
          {saving ? "Сохранение…" : "Сохранить"}
        </button>
      </form>
    </section>
  );
}

interface ProfileData {
  profile: Profile | null;
  failed: boolean;
  saving: boolean;
  stats: ProfileStats;
}

function useProfileData(userId: string): [ProfileData, (patch: UpdateProfile) => void] {
  const [data, setData] = useState<ProfileData>({ profile: null, failed: false, saving: false, stats: { events: 0, places: 0 } });

  useEffect(() => {
    let alive = true;
    setData({ profile: null, failed: false, saving: false, stats: { events: 0, places: 0 } });
    apiClient.getProfile(userId).then(
      (profile) => {
        if (alive) setData((current) => ({ ...current, profile }));
      },
      () => {
        if (alive) setData((current) => ({ ...current, failed: true }));
      },
    );
    apiClient.listCalendar(userId).then(
      (entries) => {
        if (alive) setData((current) => ({ ...current, stats: profileStats(entries) }));
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
      apiClient.updateProfile(userId, patch).then(
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
  const [{ profile, failed, saving, stats }, save] = useProfileData(user.id);

  if (failed) return <p className="app-state app-state--error">Не удалось загрузить профиль.</p>;
  if (profile === null) return <p className="app-state">Загрузка…</p>;
  return <ProfileView user={user} profile={profile} stats={stats} saving={saving} onSave={save} />;
}

export function ProfilePage() {
  const auth = useAuth();

  if (auth.status === "authenticated") return <AuthenticatedProfile user={auth.user} />;
  if (auth.status === "error") {
    return <p className="app-state app-state--error">Не удалось войти: {auth.message}</p>;
  }
  if (auth.status === "loading") {
    return <p className="app-state">Загрузка…</p>;
  }
  return <p className="app-state">Откройте приложение внутри MAX, чтобы авторизоваться.</p>;
}
