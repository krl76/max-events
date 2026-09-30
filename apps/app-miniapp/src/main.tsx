// Dev-only window.WebApp shim: must run first, before ./max/bridge reads window.WebApp.
import "./max/dev-init-data";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { setupIonicReact } from "@ionic/react";
import { App } from "./App";
import { apiClient } from "./api/client";
import { getWebApp } from "./max/bridge";
import { installChunkLoadRecovery } from "./ui/chunk-load";
import { installErrorLogging } from "./ui/log-error";
import { initTheme } from "./ui/theme";
import "@ionic/react/css/core.css";
import "@ionic/react/css/normalize.css";
import "@ionic/react/css/structure.css";
import "@ionic/react/css/typography.css";
import "./ui/theme.css";

setupIonicReact({ mode: "ios" });
installChunkLoadRecovery();
installErrorLogging();

// Colour scheme before the first paint and above the entry gate. Layout only mounts on the
// signed-in branch, so driving it from there left EntryPage and OrganizerSpace ignoring an
// explicit light/dark choice. Synchronous and outside React on purpose: it must beat the
// awaits in bootstrap() so no frame renders in the wrong scheme, and StrictMode must not
// double-invoke it. The subscription lives as long as the app, so its unsubscribe is moot.
initTheme();

// Attach the MAX auth header synchronously before the first render: child
// effects (the initial request wave) run before the AuthProvider effect.
// Mock mode loads the interceptor lazily (the mock module stays out of the
// real-mode runtime); render waits for the install so no request can slip past.
async function bootstrap(): Promise<void> {
  if (import.meta.env.VITE_BROWSER_AUTH === "1") {
    const { installBrowserWebAppShim } = await import("./max/browser-init-data");
    await installBrowserWebAppShim();
  }
  apiClient.setInitData(getWebApp()?.initData ?? null);
  if (import.meta.env.VITE_USE_MOCK === "1") {
    const { installMockApi } = await import("./api/mock");
    installMockApi();
  }
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
