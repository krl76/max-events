// START_MODULE_CONTRACT
// PURPOSE: Organizer space — a separate area of the miniapp with its own login/password auth (no MAX user context): login form, then the organizer sections behind their own tab bar.
// SCOPE: OrganizerAuthProvider wiring, login form with inline error, section header and the Дашборд · События · Создать · Промо · Профиль bar (макет, экраны 42–45); section content comes from OrganizerPage/OrganizerAddons. The metric blocks of экран 42, the check-in screen 44 and the campaign screen 45 are wave 13 (T-015) — this wave delivers the bar and routes each section to what already exists.
// DEPENDS: react, ./OrganizerAuthContext.js, ./OrganizerPage.js, ./OrganizerAddons.js, ./OrganizerTabs.js, ../ui/primitives.js, ../ui/icons.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ORGANIZER_SECTION_TITLES - header title per bar section
// - OrganizerSectionContent - what each section renders today: dashboard -> the organizer rating, events -> the panel, create -> the panel with the empty event draft, promo -> the way into the per-event promo tools, profile -> organization and exit
// - OrganizerSpace - auth gate + MaxUI chrome: loading/anonymous/error -> login form, authenticated -> header + section + tab bar
// END_MODULE_MAP

import { useState, type FormEvent } from "react";
import { ActionIcon } from "../ui/icons";
import { AppButton, AppState } from "../ui/primitives";
import { MyOrganizerRatingCard } from "./OrganizerAddons";
import { OrganizerAuthProvider, useOrganizerAuth } from "./OrganizerAuthContext";
import { OrganizerPanel } from "./OrganizerPage";
import { OrganizerTabBar, type OrganizerSection } from "./OrganizerTabs";

const MOCK_MODE = import.meta.env.VITE_USE_MOCK === "1";

function OrganizerLoginForm({ onExit }: { onExit: () => void }) {
  const { state, login } = useOrganizerAuth();
  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    void login(loginValue, password).finally(() => setSubmitting(false));
  };

  return (
    <form className="app-organizer-login" onSubmit={submit}>
      <div className="app-organizer-login-brand">
        <span className="app-entry-logo app-entry-logo--small">
          <ActionIcon name="ticket" size={26} strokeWidth={1.6} />
        </span>
      </div>
      <h1 className="app-organizer-login-title">Вход организатора</h1>
      {MOCK_MODE && <p className="app-organizer-login-hint">Демо-доступ: demo / demo</p>}
      <input className="app-profile-input" type="text" aria-label="Логин" placeholder="Логин" autoComplete="username" value={loginValue} onChange={(change) => setLoginValue(change.target.value)} />
      <input className="app-profile-input" type="password" aria-label="Пароль" placeholder="Пароль" autoComplete="current-password" value={password} onChange={(change) => setPassword(change.target.value)} />
      {state.status === "error" && <AppState error>Не удалось войти: проверьте логин и пароль.</AppState>}
      <AppButton stretched disabled={submitting || loginValue === "" || password === ""} type="submit">
        Войти
      </AppButton>
      <AppButton tone="secondary" stretched type="button" onClick={onExit}>
        Назад
      </AppButton>
    </form>
  );
}

export const ORGANIZER_SECTION_TITLES: Record<OrganizerSection, string> = {
  dashboard: "Дашборд",
  events: "События",
  create: "Новое событие",
  promo: "Промо и отчёты",
  profile: "Профиль",
};

export function OrganizerSectionContent({ section, organizationId, organizationName, onSection, onLogout }: { section: OrganizerSection; organizationId: string; organizationName: string; onSection: (section: OrganizerSection) => void; onLogout: () => void }) {
  if (section === "dashboard")
    return (
      <>
        <MyOrganizerRatingCard organizationId={organizationId} />
        <AppState hint="Заполнение, источники записей и отчёты за месяц появятся здесь" action={{ label: "К событиям", onClick: () => onSection("events") }}>
          Пока дашборд показывает только вашу оценку
        </AppState>
      </>
    );
  if (section === "create") return <OrganizerPanel organizationId={organizationId} createOnMount />;
  if (section === "promo")
    return (
      <AppState hint="Поднятие в ленте, промокоды и ранний доступ настраиваются внутри события" action={{ label: "К событиям", onClick: () => onSection("events") }}>
        Промо-инструменты живут в карточке события
      </AppState>
    );
  if (section === "profile")
    return (
      <section className="app-gathering">
        <p className="app-gathering-hint">{organizationName}</p>
        <AppButton tone="secondary" stretched onClick={onLogout}>
          Выйти
        </AppButton>
      </section>
    );
  return <OrganizerPanel organizationId={organizationId} />;
}

function OrganizerSpaceShell({ onExit }: { onExit: () => void }) {
  const { state, logout } = useOrganizerAuth();
  const [section, setSection] = useState<OrganizerSection>("dashboard");
  if (state.status === "loading") return <AppState>Загрузка…</AppState>;
  if (state.status !== "authenticated") return <OrganizerLoginForm onExit={onExit} />;
  return (
    <>
      <header className="app-header">
        <span className="app-header-title">{ORGANIZER_SECTION_TITLES[section]}</span>
      </header>
      <main className="app-content">
        <OrganizerSectionContent section={section} organizationId={state.session.organization.id} organizationName={state.session.organization.name} onSection={setSection} onLogout={logout} />
      </main>
      <OrganizerTabBar section={section} onSection={setSection} />
    </>
  );
}

export function OrganizerSpace({ onExit }: { onExit: () => void }) {
  return (
    <OrganizerAuthProvider>
      <OrganizerSpaceShell onExit={onExit} />
    </OrganizerAuthProvider>
  );
}
