// START_MODULE_CONTRACT
// PURPOSE: Organizer space — a separate area of the miniapp with its own login/password auth (no MAX user context): login form, then the organizer screens behind their own tab bar.
// SCOPE: OrganizerAuthProvider wiring, login form with inline error, the Дашборд · События · Создать · Промо · Профиль bar (макет, экраны 42–45) and the section-to-screen mapping. Экран 44 is not a bar section: it is the event opened from the dashboard, so it lives as a pushed view over whatever section is current, the way the design enters it. The space sits outside RouteProvider, so all of this is local state, not routes.
// DEPENDS: react, ./OrganizerAuthContext.js, ./OrganizerDashboard.js, ./OrganizerEventForm.js, ./OrganizerEventManage.js, ./OrganizerPromo.js, ./OrganizerPage.js, ./OrganizerAddons.js, ./OrganizerTabs.js, ../api/client.js (OrganizerEvent), ../ui/primitives.js, ../ui/icons.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ORGANIZER_SECTION_TITLES - header title per bar section (only the two sections that use the plain header still show it)
// - ORGANIZER_BARE_SECTIONS - the sections that draw their own chrome, so the shell header steps aside
// - OrganizerSectionContent - what each section renders: dashboard -> экран 42, events -> the panel, create -> экран 43, promo -> экран 45, profile -> organization and exit
// - OrganizerSpace - auth gate + MaxUI chrome: loading/anonymous/error -> login form, authenticated -> header + section (or the pushed экран 44) + tab bar
// END_MODULE_MAP

import { useState, type FormEvent } from "react";
import type { OrganizerEvent } from "../api/client";
import { ActionIcon } from "../ui/icons";
import { AppButton, AppState } from "../ui/primitives";
import { MyOrganizerRatingCard } from "./OrganizerAddons";
import { OrganizerAuthProvider, useOrganizerAuth } from "./OrganizerAuthContext";
import { OrganizerDashboard, type OrganizerPromoIntent } from "./OrganizerDashboard";
import { OrganizerEventForm } from "./OrganizerEventForm";
import { OrganizerEventManage } from "./OrganizerEventManage";
import { OrganizerPanel } from "./OrganizerPage";
import { OrganizerPromo } from "./OrganizerPromo";
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

/** Экраны 42, 43 и 45 несут собственную шапку — общая стала бы второй, как это уже решено для экранов 08 и 16. */
export const ORGANIZER_BARE_SECTIONS: ReadonlySet<OrganizerSection> = new Set<OrganizerSection>(["dashboard", "create", "promo"]);

interface OrganizerSectionContentProps {
  section: OrganizerSection;
  organizationId: string;
  organizationName: string;
  promoIntent: OrganizerPromoIntent | null;
  onSection: (section: OrganizerSection) => void;
  onManage: (event: OrganizerEvent) => void;
  onPromoIntent: (intent: OrganizerPromoIntent) => void;
  onLogout: () => void;
}

export function OrganizerSectionContent({ section, organizationId, organizationName, promoIntent, onSection, onManage, onPromoIntent, onLogout }: OrganizerSectionContentProps) {
  if (section === "dashboard")
    return (
      <OrganizerDashboard
        organizationId={organizationId}
        organizationName={organizationName}
        onOpenEvent={onManage}
        onAllEvents={() => onSection("events")}
        onTool={(intent) => {
          onPromoIntent(intent);
          onSection("promo");
        }}
      />
    );
  if (section === "create") return <OrganizerEventForm organizationName={organizationName} onBack={() => onSection("dashboard")} onPublished={() => onSection("dashboard")} />;
  if (section === "promo") return <OrganizerPromo organizationName={organizationName} intent={promoIntent} onOpenEvent={() => onSection("events")} />;
  if (section === "profile")
    return (
      <section className="app-gathering">
        <p className="app-gathering-hint">{organizationName}</p>
        <MyOrganizerRatingCard organizationId={organizationId} />
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
  const [manage, setManage] = useState<OrganizerEvent | null>(null);
  const [promoIntent, setPromoIntent] = useState<OrganizerPromoIntent | null>(null);
  if (state.status === "loading") return <AppState>Загрузка…</AppState>;
  if (state.status !== "authenticated") return <OrganizerLoginForm onExit={onExit} />;
  const bare = manage !== null || ORGANIZER_BARE_SECTIONS.has(section);
  return (
    <>
      {!bare && (
        <header className="app-header">
          <span className="app-header-title">{ORGANIZER_SECTION_TITLES[section]}</span>
        </header>
      )}
      <main className={bare ? "app-content app-content--flush" : "app-content"}>
        {manage === null ? (
          <OrganizerSectionContent
            section={section}
            organizationId={state.session.organization.id}
            organizationName={state.session.organization.name}
            promoIntent={promoIntent}
            onSection={(next) => {
              if (next !== "promo") setPromoIntent(null);
              setSection(next);
            }}
            onManage={setManage}
            onPromoIntent={setPromoIntent}
            onLogout={logout}
          />
        ) : (
          <OrganizerEventManage
            event={manage}
            onBack={() => setManage(null)}
            onPromo={() => {
              setManage(null);
              setSection("promo");
            }}
          />
        )}
      </main>
      <OrganizerTabBar
        section={section}
        onSection={(next) => {
          setManage(null);
          if (next !== "promo") setPromoIntent(null);
          setSection(next);
        }}
      />
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
