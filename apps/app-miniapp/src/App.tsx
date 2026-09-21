// START_MODULE_CONTRACT
// PURPOSE: Mini-app shell composition: Ionic root, entry mode gate, auth context, routing, Bridge handshake, layout.
// SCOPE: Entry mode selection (user via MAX / organizer space), then provider wiring; pages render through Layout children.
// DEPENDS: @ionic/react (IonApp), ./auth/AuthContext.js, ./auth/EntryPage.js, ./organizer/OrganizerSpace.js, ./routing/router.js, ./ui/Layout.js, ./pages/pages.js, ./max/bridge.js
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - App - IonApp > entry gate -> AuthProvider > RouteProvider > Layout > routed pages, or the organizer space
// END_MODULE_MAP

import { useEffect, useState } from "react";
import { IonApp } from "@ionic/react";
import { AuthProvider } from "./auth/AuthContext";
import { EntryPage, type EntryMode } from "./auth/EntryPage";
import { webApp } from "./max/bridge";
import { OrganizerSpace } from "./organizer/OrganizerSpace";
import { RoutedPages } from "./pages/pages";
import { RouteProvider } from "./routing/router";
import { Layout } from "./ui/Layout";

export function App() {
  const [mode, setMode] = useState<EntryMode | null>(null);

  useEffect(() => {
    webApp?.ready();
  }, []);

  return (
    <IonApp className="app-root">
      {mode === null ? (
        <EntryPage onSelect={setMode} />
      ) : mode === "organizer" ? (
        <OrganizerSpace onExit={() => setMode(null)} />
      ) : (
        <AuthProvider>
          <RouteProvider>
            <Layout>
              <RoutedPages />
            </Layout>
          </RouteProvider>
        </AuthProvider>
      )}
    </IonApp>
  );
}
