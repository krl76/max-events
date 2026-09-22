// START_MODULE_CONTRACT
// PURPOSE: Mini-app shell composition: Ionic root, entry mode gate, auth context, routing, Bridge handshake, layout.
// SCOPE: Entry mode selection (user via MAX or staging browser auth / organizer space); MAX-only gate when initData is missing; pages render through Layout children.
// DEPENDS: @ionic/react (IonApp), ./auth/AuthContext.js, ./auth/EntryPage.js, ./organizer/OrganizerSpace.js, ./routing/router.js, ./ui/Layout.js, ./pages/pages.js, ./max/bridge.js
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - App - IonApp > entry gate -> AuthProvider > UserShell > RouteProvider > Layout > routed pages, or the organizer space
// - UserShell - blocks the user flow outside MAX unless a browser-auth shim supplied initData
// END_MODULE_MAP

import { useEffect, useState, type ReactNode } from "react";
import { IonApp } from "@ionic/react";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { EntryPage, type EntryMode } from "./auth/EntryPage";
import { getWebApp } from "./max/bridge";
import { OrganizerSpace } from "./organizer/OrganizerSpace";
import { RoutedPages } from "./pages/pages";
import { RouteProvider } from "./routing/router";
import { Layout } from "./ui/Layout";
import { AppButton, AppState } from "./ui/primitives";

const BROWSER_AUTH = import.meta.env.VITE_BROWSER_AUTH === "1";

export function App() {
  const [mode, setMode] = useState<EntryMode | null>(() => (getWebApp()?.initData ? "user" : null));

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
            <RouteProvider>
              <Layout>
                <RoutedPages />
              </Layout>
            </RouteProvider>
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
