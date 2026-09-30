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
import { SettingsGroup, SettingsPicker } from "../profile/SettingsPage";
import { ActionIcon } from "../ui/icons";
import { AppButton, AppState } from "../ui/primitives";
import { MyOrganizerRatingCard } from "./OrganizerAddons";
import { ORGANIZER_BACK_COVER, useOrganizerNativeBack } from "./organizer-native-back";
import { ORGANIZER_ACTIVITY_OPTIONS } from "./organizer-onboarding";

type OrganizationPane = "home" | "team" | "complaints";

export function OrganizerOrganization({ organizationId, organizationName, onLogout }: { organizationId: string; organizationName: string; onLogout: () => void }) {
  const [setup, setSetup] = useState<OrganizerSetup | null>(null);
  const [failed, setFailed] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [pane, setPane] = useState<OrganizationPane>("home");
  useOrganizerNativeBack(pane !== "home", () => setPane("home"), ORGANIZER_BACK_COVER + 1);

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

  if (pane === "team") {
    return (
      <section className="app-gathering" aria-label="Команда">
        <h1 className="app-section-title">Команда</h1>
        <p className="app-gathering-hint">Сейчас кабинет ведёт один аккаунт организации. Роли сотрудников появятся здесь.</p>
        <AppState>Сотрудников пока нет.</AppState>
      </section>
    );
  }

  if (pane === "complaints") {
    return (
      <section className="app-gathering" aria-label="Жалобы">
        <h1 className="app-section-title">Жалобы</h1>
        <p className="app-gathering-hint">Жалобы гостей рассматривает модерация афиши. Если событие сняли, статус появится здесь. Разбирать жалобы в кабинете нельзя.</p>
        <AppState>Открытых жалоб нет.</AppState>
      </section>
    );
  }

  return (
    <section className="app-gathering" aria-label="Организация">
      <h1 className="app-section-title">{organizationName}</h1>
      {failed && <AppState error>Не удалось загрузить организацию.</AppState>}
      {setup === null && !failed && <AppState>Загрузка…</AppState>}
      {setup !== null && (
        <>
          <p className="app-gathering-hint">{setup.venue.title === "" ? "Площадка ещё не названа" : `${setup.venue.title}${setup.venue.city === "" ? "" : ` · ${setup.venue.city}`}`}</p>
          <SettingsGroup title="Чем занимаетесь">
            <SettingsPicker options={ORGANIZER_ACTIVITY_OPTIONS.map((option) => ({ value: option.activity, label: option.label }))} selected={setup.activities} multiple onPick={(value) => toggleActivity(value as OrganizerActivity)} />
          </SettingsGroup>
          <SettingsGroup title="Оплата">
            <p className="app-gathering-hint">Ссылка нужна, если билет покупают на вашем сайте. Деньги в кабинет не приходят.</p>
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
                    save({ payouts: { mode: "none", paymentUrl: null } });
                    return;
                  }
                  try {
                    save({ payouts: { mode: "external", paymentUrl: new URL(value).toString() } });
                  } catch {
                    setSaveFailed(true);
                  }
                }}
              />
            </label>
            <label className="app-org-field">
              <span className="app-org-field-label">Контакт для покупателя</span>
              <input className="app-profile-input" type="text" placeholder="Почта или телефон" value={setup.payouts.contacts ?? ""} onChange={(change) => setSetup({ ...setup, payouts: { ...setup.payouts, contacts: change.target.value } })} onBlur={(change) => save({ payouts: { contacts: change.target.value.trim() === "" ? null : change.target.value.trim() } })} />
            </label>
          </SettingsGroup>
          {saveFailed && <AppState error>Не удалось сохранить. Ссылка должна начинаться с https://</AppState>}
        </>
      )}
      <SettingsGroup title="Организация">
        <button type="button" className="app-set-row" onClick={() => setPane("team")}>
          <span className="app-set-row-text">
            <span className="app-set-row-title">Команда</span>
            <span className="app-set-row-hint">Один аккаунт ведёт кабинет</span>
          </span>
          <ActionIcon name="chevron" size={16} strokeWidth={2.6} />
        </button>
        <button type="button" className="app-set-row" onClick={() => setPane("complaints")}>
          <span className="app-set-row-text">
            <span className="app-set-row-title">Жалобы</span>
            <span className="app-set-row-hint">Статус модерации, без разбора в кабинете</span>
          </span>
          <ActionIcon name="chevron" size={16} strokeWidth={2.6} />
        </button>
      </SettingsGroup>
      <MyOrganizerRatingCard organizationId={organizationId} />
      {confirmExit ? (
        <>
          <p className="app-gathering-hint">Выйти из кабинета и вернуться к выбору входа?</p>
          <AppButton tone="danger" stretched onClick={onLogout}>
            Выйти
          </AppButton>
          <AppButton tone="secondary" stretched onClick={() => setConfirmExit(false)}>
            Остаться
          </AppButton>
        </>
      ) : (
        <AppButton tone="secondary" stretched onClick={() => setConfirmExit(true)}>
          Выйти из кабинета
        </AppButton>
      )}
    </section>
  );
}
