import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "@maxhub/max-ui/dist/styles.css";
import "./ui/theme.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
