import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { setupIonicReact } from "@ionic/react";
import { App } from "./App";
import { apiClient } from "./api/client";
import { webApp } from "./max/bridge";
import "@ionic/react/css/core.css";
import "@ionic/react/css/normalize.css";
import "@ionic/react/css/structure.css";
import "@ionic/react/css/typography.css";
import "./ui/theme.css";

setupIonicReact({ mode: "ios" });

// Attach the MAX auth header synchronously before the first render: child
// effects (the initial request wave) run before the AuthProvider effect.
apiClient.setInitData(webApp?.initData ?? null);

// Mock mode loads the interceptor lazily (the mock module stays out of the
// real-mode runtime); render waits for the install so no request can slip past.
async function bootstrap(): Promise<void> {
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
