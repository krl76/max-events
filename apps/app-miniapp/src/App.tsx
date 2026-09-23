// START_MODULE_CONTRACT
// PURPOSE: Mini-app shell composition: Ionic root, entry mode gate, auth context, routing, Bridge handshake, layout.
// SCOPE: Entry mode selection (user via MAX or staging browser auth / organizer space); MAX-only gate when initData is missing; first-run onboarding gate; pages render through Layout children.
// DEPENDS: @ionic/react (IonApp), ./auth/AuthContext.js, ./auth/EntryPage.js, ./onboarding/onboarding.js, ./onboarding/OnboardingFlow.js, ./organizer/OrganizerSpace.js, ./routing/router.js, ./ui/Layout.js, ./pages/pages.js, ./max/bridge.js
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - App - IonApp > entry gate -> AuthProvider > UserShell > OnboardingGate > RouteProvider > Layout > routed pages, or the organizer space
// - UserShell - blocks the user flow outside MAX unless a browser-auth shim supplied initData
// - OnboardingGate - the onboarding runs once: a device that already passed it goes straight to the feed and never loads the flow chunk
// END_MODULE_MAP

import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { IonApp } from "@ionic/react";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { EntryPage, type EntryMode } from "./auth/EntryPage";
import { getWebApp } from "./max/bridge";
import { isOnboardingDone } from "./onboarding/onboarding";
import { OrganizerSpace } from "./organizer/OrganizerSpace";
import { RoutedPages } from "./pages/pages";
import { RouteProvider } from "./routing/router";
import { Layout } from "./ui/Layout";
import { AppButton, AppState } from "./ui/primitives";

const BROWSER_AUTH = import.meta.env.VITE_BROWSER_AUTH === "1";

const OnboardingFlow = lazy(() => import("./onboarding/OnboardingFlow").then((module) => ({ default: module.OnboardingFlow })));

export function App() {
  const [mode, setMode] = useState<EntryMode | null>(() => (BROWSER_AUTH || getWebApp()?.initData ? "user" : null));

  useEffect(() => {
    getWebApp()?.ready();
  }, []);

  return (
    <IonApp className="app-root">
      {mode === null ? (
        <EntryPage onSelect={setMode} userLabel={BROWSER_AUTH ? "Войти" : "Войти через MAX"} />
      ) : mode === "organizer" ? (
        <OrganizerSpace onExit={() => setMode(null)} />
      ) : (
        <AuthProvider>
          <UserShell onExit={() => setMode(null)}>
            <OnboardingGate>
              <RouteProvider>
                <Layout>
                  <RoutedPages />
                </Layout>
              </RouteProvider>
            </OnboardingGate>
          </UserShell>
        </AuthProvider>
      )}
    </IonApp>
  );
}

export function UserShell({ children, onExit }: { children: ReactNode; onExit: () => void }) {
  const auth = useAuth();
  if (auth.status === "loading") return <AppState>Загрузка…</AppState>;
  if (auth.status === "unavailable" || auth.status === "error") {
    return (
      <section className="app-entry">
        <p className="app-entry-tagline">Откройте MAX Events в мессенджере MAX</p>
        <AppButton onClick={onExit}>Назад</AppButton>
      </section>
    );
  }
  return children;
}

/** Read once into state: the flag is written at the end of the flow, and re-reading storage on every render would fight it. */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const [done, setDone] = useState(isOnboardingDone);
  if (done) return children;
  return (
    <Suspense fallback={<AppState>Загрузка…</AppState>}>
      <OnboardingFlow onDone={() => setDone(true)} />
    </Suspense>
  );
}
