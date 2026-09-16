import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { installMockApi } from "./api/mock";
import "@maxhub/max-ui/dist/styles.css";
import "./ui/theme.css";

if (import.meta.env.VITE_USE_MOCK === "1") installMockApi();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
