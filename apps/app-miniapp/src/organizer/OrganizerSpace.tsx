// START_MODULE_CONTRACT
// PURPOSE: Organizer space — a separate area of the miniapp with its own login/password auth (no MAX user context): login form, then the organizer panel with a logout.
// SCOPE: OrganizerAuthProvider wiring, login form with inline error, header with the organization name and exit; panel content comes from OrganizerPage.
// DEPENDS: react, ./OrganizerAuthContext.js, ./OrganizerPage.js, ../ui/primitives.js, ../ui/icons.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - OrganizerSpace - auth gate + MaxUI chrome: loading/anonymous/error -> login form, authenticated -> panel header (organization name, exit)
// END_MODULE_MAP

import { useState, type FormEvent } from "react";
import { ActionIcon } from "../ui/icons";
import { AppButton, AppState } from "../ui/primitives";
import { OrganizerAuthProvider, useOrganizerAuth } from "./OrganizerAuthContext";
import { OrganizerPanel } from "./OrganizerPage";

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

function OrganizerSpaceShell({ onExit }: { onExit: () => void }) {
  const { state, logout } = useOrganizerAuth();
  if (state.status === "loading") return <AppState>Загрузка…</AppState>;
  if (state.status !== "authenticated") return <OrganizerLoginForm onExit={onExit} />;
  return (
    <>
      <header className="app-header">
        <span className="app-header-title">{state.session.organization.name}</span>
        <AppButton tone="secondary" onClick={logout}>
          Выйти
        </AppButton>
      </header>
      <main className="app-content">
        <OrganizerPanel organizationId={state.session.organization.id} />
      </main>
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
