// START_MODULE_CONTRACT
// PURPOSE: Settings screen: city, interests, smart alerts, privacy, recommendations; opened from the profile topbar gear.
// SCOPE: Data via apiClient.getProfile/updateProfile; drafts reset when the profile loads; back navigation after a successful save.
// DEPENDS: ../api/client.js (apiClient), ../auth/AuthContext.js, ./ProfilePage.js (toProfilePatch), @max-events/api-contracts (Profile, UpdateProfile), ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - SettingsView - presentational: city/interests/alerts/privacy/recommendations form, save/cancel actions
// - SettingsPage - route container: resolves auth, loads the profile, saves via updateProfile
// END_MODULE_MAP

import { useEffect, useState } from "react";
import type { Profile, UpdateProfile } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { toProfilePatch } from "./ProfilePage";
import { AppButton, AppState, AppSkeleton } from "../ui/primitives";
import { useRoute } from "../routing/router";

interface SettingsViewProps {
  profile: Profile;
  saving: boolean;
  onSave: (patch: UpdateProfile) => void;
  onCancel: () => void;
}

export function SettingsView({ profile, saving, onSave, onCancel }: SettingsViewProps) {
  const [cityDraft, setCityDraft] = useState(profile.city);
  const [interestsDraft, setInterestsDraft] = useState(profile.interests.join(", "));
  const [leaveNow, setLeaveNow] = useState(profile.smartAlerts.leaveNow);
  const [weather, setWeather] = useState(profile.smartAlerts.weather);
  const [friendLeft, setFriendLeft] = useState(profile.smartAlerts.friendLeft);
  const [listDigest, setListDigest] = useState(profile.smartAlerts.listDigest);
  const [visitHistory, setVisitHistory] = useState(profile.privacy.visitHistory);
  const [routes, setRoutes] = useState(profile.privacy.routes);
  const [recommendationsEnabled, setRecommendationsEnabled] = useState(profile.recommendationsEnabled);
  useEffect(() => {
    setCityDraft(profile.city);
    setInterestsDraft(profile.interests.join(", "));
    setLeaveNow(profile.smartAlerts.leaveNow);
    setWeather(profile.smartAlerts.weather);
    setFriendLeft(profile.smartAlerts.friendLeft);
    setListDigest(profile.smartAlerts.listDigest);
    setVisitHistory(profile.privacy.visitHistory);
    setRoutes(profile.privacy.routes);
    setRecommendationsEnabled(profile.recommendationsEnabled);
  }, [profile]);

  return (
    <form
      className="app-profile-form"
      onSubmit={(submit) => {
        submit.preventDefault();
        onSave({
          ...toProfilePatch(cityDraft, interestsDraft),
          smartAlerts: { leaveNow, weather, friendLeft, listDigest },
          privacy: { visitHistory, routes },
          recommendationsEnabled,
        });
      }}
    >
      <label className="app-settings-field">
        <span className="app-settings-label">Город</span>
        <input className="app-profile-input" type="text" aria-label="Город" value={cityDraft} onChange={(change) => setCityDraft(change.target.value)} />
      </label>
      <label className="app-settings-field">
        <span className="app-settings-label">Интересы</span>
        <input className="app-profile-input" type="text" aria-label="Интересы" placeholder="Интересы через запятую" value={interestsDraft} onChange={(change) => setInterestsDraft(change.target.value)} />
      </label>
      <fieldset className="app-settings-field">
        <legend className="app-settings-label">Умные уведомления</legend>
        <label>
          <input type="checkbox" aria-label="Выход сейчас" checked={leaveNow} onChange={(change) => setLeaveNow(change.target.checked)} /> Выход сейчас
        </label>
        <label>
          <input type="checkbox" aria-label="Погода" checked={weather} onChange={(change) => setWeather(change.target.checked)} /> Погода
        </label>
        <label>
          <input type="checkbox" aria-label="Друг вышел" checked={friendLeft} onChange={(change) => setFriendLeft(change.target.checked)} /> Друг вышел
        </label>
        <label>
          <input type="checkbox" aria-label="Дайджест списков" checked={listDigest} onChange={(change) => setListDigest(change.target.checked)} /> Дайджест списков
        </label>
      </fieldset>
      <label className="app-settings-field">
        <span className="app-settings-label">История посещений</span>
        <select className="app-profile-input" aria-label="История посещений" value={visitHistory} onChange={(change) => setVisitHistory(change.target.value as "friends" | "hidden")}>
          <option value="friends">Друзьям</option>
          <option value="hidden">Скрыта</option>
        </select>
      </label>
      <label className="app-settings-field">
        <span className="app-settings-label">Маршруты</span>
        <select className="app-profile-input" aria-label="Маршруты" value={routes} onChange={(change) => setRoutes(change.target.value as "friends" | "hidden")}>
          <option value="friends">Друзьям</option>
          <option value="hidden">Скрыты</option>
        </select>
      </label>
      <label className="app-settings-field">
        <input type="checkbox" aria-label="Рекомендации" checked={recommendationsEnabled} onChange={(change) => setRecommendationsEnabled(change.target.checked)} /> Рекомендации
      </label>
      <div className="app-event-actions-row">
        <AppButton disabled={saving} type="submit">
          {saving ? "Сохранение…" : "Сохранить"}
        </AppButton>
        <AppButton tone="secondary" onClick={onCancel}>
          Отмена
        </AppButton>
      </div>
    </form>
  );
}

function AuthenticatedSettings() {
  const { back } = useRoute();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    apiClient.getProfile().then(
      (value) => {
        if (alive) setProfile(value);
      },
      () => {
        if (alive) setFailed(true);
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  if (failed) return <AppState error>Не удалось загрузить профиль.</AppState>;
  if (profile === null)
    return (
      <div className="app-card" aria-hidden="true">
        <div className="app-card-body">
          <AppSkeleton variant="block" />
          <AppSkeleton />
        </div>
      </div>
    );
  return (
    <SettingsView
      profile={profile}
      saving={saving}
      onCancel={back}
      onSave={(patch) => {
        setSaving(true);
        apiClient.updateProfile(patch).then(
          () => back(),
          () => setSaving(false),
        );
      }}
    />
  );
}

export function SettingsPage() {
  const auth = useAuth();

  if (auth.status === "authenticated") return <AuthenticatedSettings />;
  if (auth.status === "error") {
    return <AppState error>Не удалось войти: {auth.message}</AppState>;
  }
  if (auth.status === "loading") {
    return <AppState>Загрузка…</AppState>;
  }
  return <AppState>Откройте приложение внутри MAX, чтобы авторизоваться.</AppState>;
}
