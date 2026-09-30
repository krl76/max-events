// START_MODULE_CONTRACT
// PURPOSE: Mini-app shell composition: Ionic root, entry mode gate, auth context, routing, Bridge handshake, layout.
// SCOPE: Entry mode selection (first open is the chooser; a remembered choice resumes the user or organizer space); MAX-only gate when initData is missing; first-run onboarding gate; pages render through Layout children.
// DEPENDS: @ionic/react (IonApp), ./auth/AuthContext.js, ./auth/EntryPage.js, ./auth/entry-mode.js, ./auth/auth.js (waitForInitData), ./onboarding/onboarding.js, ./onboarding/OnboardingFlow.js, ./organizer/OrganizerSpace.js, ./routing/router.js, ./ui/Layout.js, ./pages/pages.js, ./max/bridge.js
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - readInitialEntryMode - cold start: the chooser until this device has chosen user or organizer
// - App - IonApp > entry gate -> AuthProvider > UserShell > OnboardingGate > RouteProvider > Layout > routed pages, or the organizer space
// - UserShell - blocks the user flow outside MAX unless a browser-auth shim supplied initData
// - OnboardingGate - the onboarding runs once: a device that already passed it goes straight to the feed and never loads the flow chunk
// END_MODULE_MAP

import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { IonApp } from "@ionic/react";
import { waitForInitData } from "./auth/auth";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { EntryPage, type EntryMode } from "./auth/EntryPage";
import { readStoredEntryMode, writeStoredEntryMode } from "./auth/entry-mode";
import { LeaveEntryProvider } from "./auth/leave-entry";
import { apiClient } from "./api/client";
import { getWebApp } from "./max/bridge";
import { isOnboardingDone, markOnboardingDone, profileSkipsOnboarding } from "./onboarding/onboarding";
import { OrganizerSpace } from "./organizer/OrganizerSpace";
import { RoutedPages } from "./pages/pages";
import { RouteProvider } from "./routing/router";
import { loadLazyModule } from "./ui/chunk-load";
import { ScreenErrorBoundary } from "./ui/ErrorBoundary";
import { Layout } from "./ui/Layout";
import { AppButton, AppState } from "./ui/primitives";

const BROWSER_AUTH = import.meta.env.VITE_BROWSER_AUTH === "1";

const OnboardingFlow = lazy(() => loadLazyModule(() => import("./onboarding/OnboardingFlow"), "OnboardingFlow") as Promise<{ default: typeof import("./onboarding/OnboardingFlow").OnboardingFlow }>);

/** First open has no stored choice, so the chooser stays up even when MAX initData is already present. */
export function readInitialEntryMode(input: { canEnterUser: boolean; storedMode: EntryMode | null }): EntryMode | null {
  if (input.storedMode === "organizer") return "organizer";
  if (input.storedMode === "user" && input.canEnterUser) return "user";
  return null;
}

function persistEntryMode(mode: EntryMode | null): void {
  if (typeof window === "undefined") return;
  writeStoredEntryMode(window.localStorage, mode);
}

export function App() {
  const [mode, setMode] = useState<EntryMode | null>(() =>
    readInitialEntryMode({
      canEnterUser: BROWSER_AUTH || Boolean(getWebApp()?.initData) || import.meta.env.VITE_USE_MOCK === "1",
      storedMode: typeof window === "undefined" ? null : readStoredEntryMode(window.localStorage),
    }),
  );

  useEffect(() => {
    getWebApp()?.ready();
  }, []);

  // A MAX chat link can mount the bridge before initData is filled. The choice is already stored,
  // so the return visit continues into the user app once that payload arrives.
  useEffect(() => {
    if (mode !== null) return;
    if (typeof window === "undefined" || readStoredEntryMode(window.localStorage) !== "user") return;
    let alive = true;
    void waitForInitData(
      () => getWebApp()?.initData,
      () => getWebApp() !== null,
    ).then((initData) => {
      if (alive && initData) setMode("user");
    });
    return () => {
      alive = false;
    };
  }, [mode]);

  function enter(next: EntryMode) {
    persistEntryMode(next);
    setMode(next);
  }

  function leave() {
    persistEntryMode(null);
    setMode(null);
  }

  return (
    <IonApp className="app-root">
      {mode === null ? (
        <EntryPage onSelect={enter} userLabel="Вход пользователя" />
      ) : mode === "organizer" ? (
        <OrganizerSpace onExit={leave} />
      ) : (
        <LeaveEntryProvider onLeave={leave}>
          <AuthProvider>
            <UserShell onExit={leave}>
              <OnboardingGate>
                <ScreenErrorBoundary label="app shell crashed">
                  <RouteProvider>
                    <Layout>
                      <RoutedPages />
                    </Layout>
                  </RouteProvider>
                </ScreenErrorBoundary>
              </OnboardingGate>
            </UserShell>
          </AuthProvider>
        </LeaveEntryProvider>
      )}
    </IonApp>
  );
}

export function UserShell({ children, onExit }: { children: ReactNode; onExit: () => void }) {
  const auth = useAuth();
  if (auth.status === "loading") return <AppState>Загрузка…</AppState>;
  if (auth.status === "error") {
    return (
      <section className="app-entry">
        <p className="app-entry-tagline">Не удалось войти. Проверьте соединение и попробуйте снова.</p>
        <AppButton onClick={auth.retry}>Повторить</AppButton>
        <AppButton tone="ghost" onClick={onExit}>
          Назад
        </AppButton>
      </section>
    );
  }
  if (auth.status === "unavailable") {
    return (
      <section className="app-entry">
        <p className="app-entry-tagline">Откройте MAX Events в мессенджере MAX</p>
        <AppButton onClick={onExit}>Назад</AppButton>
      </section>
    );
  }
  return children;
}

/** Read once into state: the flag is written at the end of the flow, and re-reading storage on every render would fight it. A new MAX tab does not see that flag, so an account that already picked interests skips the flow. */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const [done, setDone] = useState(isOnboardingDone);
  const [checking, setChecking] = useState(() => !isOnboardingDone());
  useEffect(() => {
    if (done) return;
    let alive = true;
    apiClient.getProfile().then(
      (profile) => {
        if (!alive) return;
        if (profileSkipsOnboarding(profile.interests)) {
          markOnboardingDone();
          setDone(true);
        }
        setChecking(false);
      },
      () => {
        if (alive) setChecking(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [done]);
  if (done) return children;
  if (checking) return <AppState>Загрузка…</AppState>;
  return (
    <ScreenErrorBoundary label="onboarding crashed">
      <Suspense fallback={<AppState>Загрузка…</AppState>}>
        <OnboardingFlow onDone={() => setDone(true)} />
      </Suspense>
    </ScreenErrorBoundary>
  );
}
