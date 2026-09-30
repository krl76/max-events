// START_MODULE_CONTRACT
// PURPOSE: Organizer space — a separate area of the miniapp with its own login/password auth (no MAX user context): login form, then the organizer screens behind their own tab bar.
// SCOPE: OrganizerAuthProvider wiring, the login form of экран 42 with its inline error, the first-visit gate (вступление экрана 43, настройка экрана 44), the Дашборд · События · Создать · Промо · Профиль bar (макет, экраны 42–45) and the section-to-screen mapping. Экран 44 is not a bar section: it is the event opened from the dashboard, so it lives as a pushed view over whatever section is current, the way the design enters it. The space sits outside RouteProvider, so all of this is local state, not routes.
// DEPENDS: react, ./OrganizerAuthContext.js, ./OrganizerDashboard.js, ./OrganizerEventForm.js, ./OrganizerEventManage.js, ./OrganizerIntro.js, ./OrganizerSetup.js, ./organizer-onboarding.js, ./organizer-native-back.js, ./OrganizerPromo.js, ./OrganizerPage.js, ./OrganizerAddons.js, ./OrganizerTabs.js, ../api/client.js (OrganizerEvent, apiClient.getOrganizerSetup), ../auth/EntryPage.js (AfishaWordmark), ../ui/primitives.js, ../ui/icons.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - OrganizerLoginForm - вход в панель организатора (макет, экран 42): wordmark, «Панель организатора», подписанные ЛОГИН/ПАРОЛЬ с показом пароля, «Войти» и строка справки
// - ORGANIZER_SECTION_TITLES - header title per bar section (section roots draw it themselves; the shell header shows it on screens pushed over a section)
// - ORGANIZER_BARE_SECTIONS - the sections that draw their own chrome, so the shell header steps aside
// - OrganizerSectionContent - what each section renders: dashboard -> экран 45, events -> the panel, create -> экран 46, promo -> экран 48, profile -> the org profile; its settings button opens the visitor settings screen
// - OrganizerOnboardingGate - первый заход: вступление (экран 43) по флагу аппарата, затем настройка (экран 44) по признаку учётной записи; отказ GET /organizer/setup не пропускает в панель
// - OrganizerSpace - auth gate + MaxUI chrome: loading/anonymous/error -> login form, authenticated -> onboarding gate -> header + section (or the pushed экран 44) + tab bar
// END_MODULE_MAP

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { OrganizerEvent } from "../api/client";
import { apiClient } from "../api/client";
import { AuthProvider } from "../auth/AuthContext";
import { NotificationsPage } from "../notifications/NotificationsPage";
import { AfishaWordmark } from "../auth/EntryPage";
import { LeaveEntryProvider } from "../auth/leave-entry";
import { OnboardingFlow } from "../onboarding/OnboardingFlow";
import { SettingsPage } from "../profile/SettingsPage";
import { ActionIcon } from "../ui/icons";
import { AppButton, AppState } from "../ui/primitives";
import { OrganizerAuthProvider, useOrganizerAuth } from "./OrganizerAuthContext";
import { OrganizerDashboard, type OrganizerPromoIntent } from "./OrganizerDashboard";
import { OrganizerOrganization } from "./OrganizerOrganization";
import { OrganizerEventManage, type ManageScreen } from "./OrganizerEventManage";
import { OrganizerIntro } from "./OrganizerIntro";
import { isOrganizerIntroDone } from "./organizer-onboarding";
import { OrganizerPanel } from "./OrganizerPage";
import { OrganizerFinance } from "./OrganizerFinance";
import { OrganizerProfile } from "./OrganizerProfile";
import { OrganizerStats } from "./OrganizerStats";
import { OrganizerPromo } from "./OrganizerPromo";
import { OrganizerSetup } from "./OrganizerSetup";
import { OrganizerTabBar, type OrganizerSection } from "./OrganizerTabs";
import { ORGANIZER_BACK_COVER, OrganizerNativeBackRoot, useOrganizerBackReclaim, useOrganizerNativeBack } from "./organizer-native-back";

const MOCK_MODE = import.meta.env.VITE_USE_MOCK === "1";

/**
 * Вход в панель организатора (макет, экран 42). Тот же экран, что был, приведённый к макету:
 * словомарк рядом с плиткой, заголовок «Панель организатора», подписанные поля и строка справки.
 *
 * «Назад» макет не рисует, но оставить экран без выхода нельзя: попасть сюда можно тапом по
 * «Вход организатора» на экране 01, и без обратного хода промах запирал бы приложение целиком.
 * Поэтому кнопка осталась — тихой строкой под справкой, а не второй пилюлей под «Войти».
 */
export function OrganizerLoginForm({ onExit }: { onExit: () => void }) {
  const { state, login } = useOrganizerAuth();
  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");
  const [revealed, setRevealed] = useState(false);
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
          <ActionIcon name="ticket" size={22} strokeWidth={1.6} />
        </span>
        <AfishaWordmark />
      </div>
      <h1 className="app-organizer-login-title">Кабинет организатора</h1>
      <p className="app-organizer-login-lead">Управляйте событиями, билетами и продвижением.</p>
      {MOCK_MODE && <p className="app-organizer-login-hint">Демо-доступ: demo / demo</p>}
      <label className="app-organizer-login-field">
        <span className="app-organizer-login-label">Логин</span>
        <input className="app-profile-input" type="text" placeholder="gorkypark" autoComplete="username" value={loginValue} onChange={(change) => setLoginValue(change.target.value)} />
      </label>
      <label className="app-organizer-login-field">
        <span className="app-organizer-login-label">Пароль</span>
        <span className="app-organizer-login-secret">
          <input className="app-profile-input" type={revealed ? "text" : "password"} placeholder="••••••••" autoComplete="current-password" value={password} onChange={(change) => setPassword(change.target.value)} />
          {/* Показать пароль — единственный способ проверить набранное вслепую на телефоне */}
          <button type="button" className="app-organizer-login-reveal" aria-label={revealed ? "Скрыть пароль" : "Показать пароль"} aria-pressed={revealed} onClick={() => setRevealed(!revealed)}>
            <ActionIcon name="eye" size={20} />
          </button>
        </span>
      </label>
      {state.status === "error" && <AppState error>{state.message === "network" ? "Нет соединения. Проверьте сеть и повторите вход." : "Не удалось войти. Проверьте логин и пароль."}</AppState>}
      <AppButton stretched disabled={submitting || loginValue === "" || password === ""} type="submit">
        Войти
      </AppButton>
      <p className="app-organizer-login-help">
        Нет логина? Напишите в поддержку афиши — <span className="app-organizer-login-help-accent">заведём аккаунт</span>
      </p>
      <button type="button" className="app-organizer-login-exit" onClick={onExit}>
        Назад
      </button>
    </form>
  );
}

export const ORGANIZER_SECTION_TITLES: Record<OrganizerSection, string> = {
  dashboard: "Статистика",
  events: "События",
  promo: "Продвижение",
  profile: "Профиль",
  finance: "Финансы",
};

/** Кабинет использует ту же шапку, что и пользовательское приложение. Свой хром остаётся только у вступления и мастера настройки. */
export const ORGANIZER_BARE_SECTIONS: ReadonlySet<OrganizerSection> = new Set<OrganizerSection>([]);

interface OrganizerSectionContentProps {
  section: OrganizerSection;
  organizationId: string;
  organizationName: string;
  promoIntent: OrganizerPromoIntent | null;
  promoEventId: string | null;
  createEvent: boolean;
  onSection: (section: OrganizerSection) => void;
  onManage: (event: OrganizerEvent) => void;
  onCreateEvent: () => void;
  onOpenOrganization: () => void;
  onOpenSettings: () => void;
  onOpenStats: () => void;
  onCheckIn: (event: OrganizerEvent) => void;
  onShowDrafts: () => void;
  onOpenPlaces: () => void;
  onOpenEvent: (event: OrganizerEvent) => void;
  editRequestId: string | null;
  onEditHandled: () => void;
  placesTick: number;
  draftsTick: number;
  onComposer?: (title: string | null) => void;
  closeComposerTick?: number;
  onNotices?: () => void;
  noticesOpen?: boolean;
}

export function OrganizerSectionContent({ section, organizationId, organizationName, promoIntent, promoEventId, createEvent, onSection, onManage, onCreateEvent, onOpenOrganization, onOpenSettings, onOpenStats, onCheckIn, onShowDrafts, onOpenPlaces, onOpenEvent, onComposer, closeComposerTick, editRequestId, onEditHandled, placesTick, draftsTick, onNotices, noticesOpen }: OrganizerSectionContentProps) {
  if (section === "dashboard") return <OrganizerDashboard organizationId={organizationId} organizationName={organizationName} onOpenEvent={onManage} onCreateEvent={onCreateEvent} onOpenOrganization={onOpenOrganization} onStats={onOpenStats} onPlaces={onOpenPlaces} onCheckIn={onCheckIn} onShowDrafts={onShowDrafts} onPromote={() => onSection("promo")} onNotices={onNotices} noticesOpen={noticesOpen} />;
  if (section === "finance") return <OrganizerFinance />;
  if (section === "promo") return <OrganizerPromo organizationName={organizationName} intent={promoIntent} eventId={promoEventId} onOpenEvent={() => onSection("events")} />;
  if (section === "profile") return <OrganizerProfile organizationId={organizationId} organizationName={organizationName} onOpenEvent={onOpenEvent} onSettings={onOpenSettings} />;
  return <OrganizerPanel organizationId={organizationId} createOnMount={createEvent} onOpenEvent={onOpenEvent} onComposer={onComposer} closeComposerTick={closeComposerTick} editRequestId={editRequestId} onEditHandled={onEditHandled} placesTick={placesTick} draftsTick={draftsTick} />;
}

/**
 * Первый заход в панель: вступление (экран 43), затем настройка (экран 44), и только потом сама
 * панель. Оба заслона снимаются по-разному, потому что и держатся на разном: «вступление видели» —
 * свойство аппарата, как у пользователя, а «настройку прошли» — свойство учётной записи.
 *
 * Отказ GET /organizer/setup больше не пропускает в панель: эндпоинт есть, и «настройку прошли»
 * нельзя вывести из сетевой ошибки.
 */
export function OrganizerOnboardingGate({ onCreateEvent, children }: { onCreateEvent: () => void; children: ReactNode }) {
  const [introDone, setIntroDone] = useState(isOrganizerIntroDone);
  const [setupDone, setSetupDone] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    apiClient.getOrganizerSetup().then(
      (setup) => {
        if (alive) setSetupDone(setup.completedAt !== null);
      },
      () => {
        if (alive) setSetupDone(false);
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  if (!introDone) return <OrganizerIntro onDone={() => setIntroDone(true)} />;
  if (setupDone === null) return <AppState>Загрузка…</AppState>;
  if (setupDone) return children;
  return (
    <OrganizerSetup
      onCreateEvent={() => {
        setSetupDone(true);
        onCreateEvent();
      }}
      onDashboard={() => setSetupDone(true)}
    />
  );
}

/**
 * The cabinet's Bearer token authenticates as the organization account. The visitor settings
 * screen is the MAX user, so the token is lifted while that screen is open and put back on the way out.
 */
function OrganizerUserSettings({ onLeave, onOrganizer, onReplay }: { onLeave: () => void; onOrganizer: () => void; onReplay: (active: boolean) => void }) {
  const { state } = useOrganizerAuth();
  const token = state.status === "authenticated" ? state.session.token : null;
  const restore = useRef(true);
  const [ready, setReady] = useState(false);
  const [replay, setReplay] = useState(false);
  useOrganizerBackReclaim(replay);

  useEffect(() => {
    apiClient.setOrganizerToken(null);
    setReady(true);
    return () => {
      if (restore.current && token !== null) apiClient.setOrganizerToken(token);
    };
  }, [token]);

  useEffect(() => {
    onReplay(replay);
    return () => onReplay(false);
  }, [onReplay, replay]);

  if (!ready) return <AppState>Загрузка…</AppState>;
  return (
    <AuthProvider>
      <LeaveEntryProvider
        onLeave={() => {
          restore.current = false;
          onLeave();
        }}
      >
        {replay ? <OnboardingFlow onDone={() => setReplay(false)} onLeave={() => setReplay(false)} /> : <SettingsPage organizerCabinet onOrganizer={onOrganizer} onShowOnboarding={() => setReplay(true)} />}
      </LeaveEntryProvider>
    </AuthProvider>
  );
}

/** The cabinet bearer is the organization. The inbox is the MAX user's, so the token is lifted for this screen and put back on the way out. */
function OrganizerVisitorNotices() {
  const { state } = useOrganizerAuth();
  const token = state.status === "authenticated" ? state.session.token : null;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    apiClient.setOrganizerToken(null);
    setReady(true);
    return () => {
      if (token !== null) apiClient.setOrganizerToken(token);
    };
  }, [token]);

  if (!ready) return <AppState>Загрузка…</AppState>;
  return (
    <AuthProvider>
      <NotificationsPage />
    </AuthProvider>
  );
}

function OrganizerSpaceShell({ onExit }: { onExit: () => void }) {
  const { state, logout } = useOrganizerAuth();
  const [section, setSection] = useState<OrganizerSection>("dashboard");
  const [manage, setManage] = useState<OrganizerEvent | null>(null);
  const [manageScreen, setManageScreen] = useState<ManageScreen>("hub");
  const [organizationOpen, setOrganizationOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsReplay, setSettingsReplay] = useState(false);
  const onSettingsReplay = useCallback((active: boolean) => setSettingsReplay(active), []);
  const [statsOpen, setStatsOpen] = useState(false);
  const [noticesOpen, setNoticesOpen] = useState(false);
  const [createEvent, setCreateEvent] = useState(false);
  const [editRequestId, setEditRequestId] = useState<string | null>(null);
  const [placesTick, setPlacesTick] = useState(0);
  const [draftsTick, setDraftsTick] = useState(0);
  const [promoIntent, setPromoIntent] = useState<OrganizerPromoIntent | null>(null);
  const [promoEventId, setPromoEventId] = useState<string | null>(null);
  const [composerTitle, setComposerTitle] = useState<string | null>(null);
  const [closeComposerTick, setCloseComposerTick] = useState(0);
  const onComposer = useCallback((title: string | null) => setComposerTitle(title), []);
  const onEditHandled = useCallback(() => setEditRequestId(null), []);
  const pushed = state.status === "authenticated" && (manage !== null || organizationOpen || settingsOpen || statsOpen || composerTitle !== null);
  const covered = manage !== null || organizationOpen || settingsOpen || statsOpen;
  // До входа в кабинет та же кнопка возвращает на выбор режима. Своя «Назад» на форме остаётся:
  // в браузере вне MAX кнопки мессенджера нет, и без неё промах запирал бы приложение.
  useOrganizerNativeBack(state.status !== "authenticated", onExit, 0);
  useOrganizerNativeBack(
    pushed || noticesOpen,
    () => {
      if (noticesOpen) {
        setNoticesOpen(false);
        return;
      }
      if (manage !== null && manageScreen !== "hub" && manageScreen !== "tickets" && manageScreen !== "stats") {
        setManageScreen("hub");
        return;
      }
      if (manage !== null) {
        setManage(null);
        setManageScreen("hub");
        return;
      }
      if (organizationOpen) {
        setOrganizationOpen(false);
        return;
      }
      if (settingsReplay) {
        return;
      }
      if (settingsOpen) {
        setSettingsOpen(false);
        return;
      }
      if (statsOpen) {
        setStatsOpen(false);
        return;
      }
      setCloseComposerTick((tick) => tick + 1);
    },
    covered || noticesOpen ? ORGANIZER_BACK_COVER : 0,
  );
  const openManage = (event: OrganizerEvent, screen: ManageScreen) => {
    setManageScreen(screen);
    setManage(event);
    setOrganizationOpen(false);
    setSettingsOpen(false);
    setStatsOpen(false);
  };
  if (state.status === "loading") return <AppState>Загрузка…</AppState>;
  if (state.status !== "authenticated") return <OrganizerLoginForm onExit={onExit} />;
  const dossier = manage !== null && (manageScreen === "hub" || manageScreen === "tickets" || manageScreen === "stats");
  const ownChrome = ((section === "profile" || section === "finance" || section === "dashboard" || section === "promo" || section === "events") && !pushed) || dossier;
  const flush = composerTitle !== null || settingsReplay || noticesOpen || (ownChrome && (section === "promo" || section === "finance")) || dossier;
  const manageTitle = manageScreen === "checkin" ? "Контроль входа" : manageScreen === "participants" ? "Участники" : manageScreen === "tickets" ? "Билеты и регистрация" : manageScreen === "stats" ? "Статистика" : manageScreen === "reviews" ? "Отзывы" : "Событие";
  const title = composerTitle ?? (statsOpen ? "Статистика" : manage !== null ? manageTitle : organizationOpen ? "Организация" : settingsOpen ? "Настройки" : ORGANIZER_SECTION_TITLES[section]);
  const hideTabs = settingsReplay || composerTitle !== null || noticesOpen || (manage !== null && manageScreen === "checkin");
  const openPromotion = (eventId: string, intent: OrganizerPromoIntent | null) => {
    setManage(null);
    setOrganizationOpen(false);
    setSettingsOpen(false);
    setPromoEventId(eventId);
    setPromoIntent(intent);
    setSection("promo");
  };
  return (
    <OrganizerOnboardingGate
      onCreateEvent={() => {
        setCreateEvent(true);
        setSection("events");
      }}
    >
      {!ownChrome && !settingsReplay && (
        <header className="app-header">
          <span className="app-header-title">{title}</span>
        </header>
      )}
      <main className={`${flush ? "app-content app-content--flush" : "app-content"}${settingsReplay || noticesOpen ? " app-content--full" : ""}`}>
        <div hidden={manage !== null || organizationOpen || settingsOpen || statsOpen || noticesOpen}>
          <OrganizerSectionContent
            section={section}
            organizationId={state.session.organization.id}
            organizationName={state.session.organization.name}
            promoIntent={promoIntent}
            promoEventId={promoEventId}
            createEvent={createEvent && section === "events"}
            onSection={(next) => {
              if (next !== "promo") {
                setPromoIntent(null);
                setPromoEventId(null);
              }
              if (next !== "events") setCreateEvent(false);
              setSection(next);
            }}
            onManage={(event) => openManage(event, "hub")}
            onCreateEvent={() => {
              setCreateEvent(true);
              setSection("events");
            }}
            onOpenOrganization={() => setSection("profile")}
            onOpenSettings={() => {
              setManage(null);
              setManageScreen("hub");
              setOrganizationOpen(false);
              setStatsOpen(false);
              setSettingsOpen(true);
            }}
            onOpenStats={() => setStatsOpen(true)}
            onCheckIn={(event) => openManage(event, "checkin")}
            onShowDrafts={() => {
              setDraftsTick((tick) => tick + 1);
              setSection("events");
            }}
            onOpenPlaces={() => {
              setPlacesTick((tick) => tick + 1);
              setSection("events");
            }}
            onOpenEvent={(event) => openManage(event, "hub")}
            onComposer={onComposer}
            closeComposerTick={closeComposerTick}
            editRequestId={editRequestId}
            onEditHandled={onEditHandled}
            placesTick={placesTick}
            draftsTick={draftsTick}
            onNotices={() => setNoticesOpen(true)}
            noticesOpen={noticesOpen}
          />
        </div>
        {noticesOpen && (
          <div className="app-org-notices">
            <OrganizerVisitorNotices />
          </div>
        )}
        {statsOpen && <OrganizerStats />}
        {manage !== null && (
          <OrganizerEventManage
            event={manage}
            screen={manageScreen}
            onScreen={setManageScreen}
            onPromo={() => openPromotion(manage.id, null)}
            onEdit={() => {
              setEditRequestId(manage.id);
              setManage(null);
              setManageScreen("hub");
              setSection("events");
            }}
            onPublished={setManage}
            onBack={() => {
              setManage(null);
              setManageScreen("hub");
            }}
          />
        )}
        {settingsOpen && !organizationOpen && (
          <OrganizerUserSettings
            onLeave={() => {
              logout();
              onExit();
            }}
            onOrganizer={() => {
              setSettingsOpen(false);
              setOrganizationOpen(true);
            }}
            onReplay={onSettingsReplay}
          />
        )}
        {organizationOpen && (
          <OrganizerOrganization
            organizationId={state.session.organization.id}
            organizationName={state.session.organization.name}
            onLogout={() => {
              logout();
              onExit();
            }}
          />
        )}
      </main>
      {!hideTabs && (
        <OrganizerTabBar
          section={section}
          onSection={(next) => {
            setManage(null);
            setManageScreen("hub");
            setOrganizationOpen(false);
            setSettingsOpen(false);
            setStatsOpen(false);
            setNoticesOpen(false);
            if (next !== "promo") {
              setPromoIntent(null);
              setPromoEventId(null);
            }
            if (next !== "events") setCreateEvent(false);
            setSection(next);
          }}
        />
      )}
    </OrganizerOnboardingGate>
  );
}

export function OrganizerSpace({ onExit }: { onExit: () => void }) {
  return (
    <OrganizerAuthProvider>
      <OrganizerNativeBackRoot>
        <OrganizerSpaceShell onExit={onExit} />
      </OrganizerNativeBackRoot>
    </OrganizerAuthProvider>
  );
}
