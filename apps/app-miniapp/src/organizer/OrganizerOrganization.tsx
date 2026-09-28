// START_MODULE_CONTRACT
// PURPOSE: Organization screen opened from the overview avatar: activities, payment link, contacts, rating and logout. The first-run wizard stays separate; this screen is how those answers are edited later.
// SCOPE: Load and patch /organizer/setup. Does not collect bank details.
// DEPENDS: react, ../api/client.js, ./organizer-onboarding.js, ./OrganizerAddons.js, ../ui/primitives.js
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - OrganizerOrganization - the editable organization card
// END_MODULE_MAP

import { useEffect, useState } from "react";
import type { OrganizerActivity, OrganizerSetup } from "../api/client";
import { apiClient } from "../api/client";
import { AppButton, AppState } from "../ui/primitives";
import { MyOrganizerRatingCard } from "./OrganizerAddons";
import { ORGANIZER_ACTIVITY_OPTIONS } from "./organizer-onboarding";

export function OrganizerOrganization({ organizationId, organizationName, onLogout }: { organizationId: string; organizationName: string; onLogout: () => void }) {
  const [setup, setSetup] = useState<OrganizerSetup | null>(null);
  const [failed, setFailed] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    apiClient.getOrganizerSetup().then(
      (loaded) => {
        if (alive) setSetup(loaded);
      },
      () => {
        if (alive) setFailed(true);
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  const save = (patch: Parameters<typeof apiClient.updateOrganizerSetup>[0]) => {
    setSaveFailed(false);
    apiClient.updateOrganizerSetup(patch).then(setSetup, () => setSaveFailed(true));
  };

  const toggleActivity = (activity: OrganizerActivity) => {
    if (setup === null) return;
    const activities = setup.activities.includes(activity) ? setup.activities.filter((item) => item !== activity) : [...setup.activities, activity];
    setSetup({ ...setup, activities });
    save({ activities });
  };

  return (
    <section className="app-gathering" aria-label="Организация">
      <h1 className="app-section-title">{organizationName}</h1>
      {failed && <AppState error>Не удалось загрузить организацию.</AppState>}
      {setup === null && !failed && <AppState>Загрузка…</AppState>}
      {setup !== null && (
        <>
          <p className="app-gathering-hint">
            {setup.venue.title === "" ? "Площадка ещё не названа" : `${setup.venue.title}${setup.venue.city === "" ? "" : ` · ${setup.venue.city}`}`}
          </p>
          <p className="app-org-group-title">Чем занимаетесь</p>
          <div className="app-org-setup-chips" role="group" aria-label="Чем занимаетесь">
            {ORGANIZER_ACTIVITY_OPTIONS.map((option) => {
              const on = setup.activities.includes(option.activity);
              return (
                <button key={option.activity} type="button" aria-pressed={on} className={on ? "app-org-setup-chip app-org-setup-chip--on" : "app-org-setup-chip"} onClick={() => toggleActivity(option.activity)}>
                  {option.label}
                </button>
              );
            })}
          </div>
          <p className="app-org-group-title">Оплата</p>
          <div className="app-org-setup-modes" role="group" aria-label="Приём оплаты">
            <button
              type="button"
              aria-pressed={setup.payouts.mode === "external"}
              className={setup.payouts.mode === "external" ? "app-org-setup-mode app-org-setup-mode--on" : "app-org-setup-mode"}
              onClick={() => {
                setSetup({ ...setup, payouts: { ...setup.payouts, mode: "external" } });
                if (setup.payouts.paymentUrl) save({ payouts: { mode: "external", paymentUrl: setup.payouts.paymentUrl } });
              }}
            >
              Платные события
            </button>
            <button type="button" aria-pressed={setup.payouts.mode === "none"} className={setup.payouts.mode === "none" ? "app-org-setup-mode app-org-setup-mode--on" : "app-org-setup-mode"} onClick={() => save({ payouts: { mode: "none" } })}>
              Пока только бесплатные
            </button>
          </div>
          {setup.payouts.mode === "external" && (
            <label className="app-org-field">
              <span className="app-org-field-label">Ссылка на оплату</span>
              <input
                className="app-profile-input"
                type="url"
                placeholder="https://"
                value={setup.payouts.paymentUrl ?? ""}
                onChange={(change) => setSetup({ ...setup, payouts: { ...setup.payouts, paymentUrl: change.target.value } })}
                onBlur={(change) => {
                  const value = change.target.value.trim();
                  if (value === "") {
                    save({ payouts: { paymentUrl: null } });
                    return;
                  }
                  try {
                    save({ payouts: { paymentUrl: new URL(value).toString() } });
                  } catch {
                    setSaveFailed(true);
                  }
                }}
              />
            </label>
          )}
          <label className="app-org-field">
            <span className="app-org-field-label">Контакт для покупателя</span>
            <input
              className="app-profile-input"
              type="text"
              placeholder="Почта или телефон"
              value={setup.payouts.contacts ?? ""}
              onChange={(change) => setSetup({ ...setup, payouts: { ...setup.payouts, contacts: change.target.value } })}
              onBlur={(change) => save({ payouts: { contacts: change.target.value.trim() === "" ? null : change.target.value.trim() } })}
            />
          </label>
          {saveFailed && <AppState error>Не удалось сохранить. Ссылка должна начинаться с https://</AppState>}
        </>
      )}
      <MyOrganizerRatingCard organizationId={organizationId} />
      <AppButton stretched onClick={onLogout}>
        Выйти из кабинета
      </AppButton>
    </section>
  );
}
