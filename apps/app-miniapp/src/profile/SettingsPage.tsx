// START_MODULE_CONTRACT
// PURPOSE: Settings screen: edit profile fields (city, interests) through the profile API; opened from the profile topbar gear.
// SCOPE: Data via apiClient.getProfile/updateProfile (mock or live); drafts reset when the profile loads; back navigation after a successful save.
// DEPENDS: ../api/client.js (apiClient), ../auth/AuthContext.js, ./ProfilePage.js (toProfilePatch), @max-events/api-contracts (Profile, UpdateProfile), ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - SettingsView - presentational: city/interests form, save/cancel actions
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
  useEffect(() => {
    setCityDraft(profile.city);
    setInterestsDraft(profile.interests.join(", "));
  }, [profile]);

  return (
    <form
      className="app-profile-form"
      onSubmit={(submit) => {
        submit.preventDefault();
        onSave(toProfilePatch(cityDraft, interestsDraft));
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
