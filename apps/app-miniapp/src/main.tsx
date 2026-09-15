import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { webApp } from "./max/bridge";

webApp?.ready();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
