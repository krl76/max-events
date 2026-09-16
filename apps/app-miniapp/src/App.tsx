// START_MODULE_CONTRACT
// PURPOSE: Mini-app shell composition: auth context, routing, Bridge handshake, layout.
// SCOPE: Provider wiring only; pages render through Layout children.
// DEPENDS: ./auth/AuthContext.js, ./routing/router.js, ./ui/Layout.js, ./pages/pages.js, ./max/bridge.js
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - App - AuthProvider > RouteProvider > Layout > routed pages
// END_MODULE_MAP

import { useEffect, useRef } from "react";
import { AuthProvider } from "./auth/AuthContext";
import { bridgeHandshake, webApp } from "./max/bridge";
import { RoutedPages } from "./pages/pages";
import { RouteProvider } from "./routing/router";
import { Layout } from "./ui/Layout";

function BridgeHandshake() {
  const sentRef = useRef(false);

  useEffect(() => {
    sentRef.current = bridgeHandshake(webApp, sentRef.current);
  }, []);

  return null;
}

export function App() {
  return (
    <AuthProvider>
      <RouteProvider>
        <BridgeHandshake />
        <Layout>
          <RoutedPages />
        </Layout>
      </RouteProvider>
    </AuthProvider>
  );
}
