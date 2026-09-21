// START_MODULE_CONTRACT
// PURPOSE: Entry choice screen — the app start always offers "Войти через MAX" (user flow) or "Вход организатора" (organizer space).
// SCOPE: Presentational two-option screen with the hero block; the chosen mode is handed to the caller.
// DEPENDS: ../ui/primitives.js, ../ui/icons.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - EntryMode - user | organizer
// - EntryPage - hero + two-option entry screen
// END_MODULE_MAP

import { ActionIcon } from "../ui/icons";
import { AppButton } from "../ui/primitives";

export type EntryMode = "user" | "organizer";

export function EntryPage({ onSelect }: { onSelect: (mode: EntryMode) => void }) {
  return (
    <section className="app-entry">
      <div className="app-entry-hero">
        <span className="app-entry-logo">
          <ActionIcon name="ticket" size={40} strokeWidth={1.6} />
        </span>
        <h1 className="app-entry-title">MAX Events</h1>
        <p className="app-entry-tagline">Афиша событий, волонтерства, туризма и спорта — рядом с тобой</p>
      </div>
      <div className="app-entry-actions">
        <AppButton stretched onClick={() => onSelect("user")}>
          Войти через MAX
        </AppButton>
        <AppButton tone="secondary" stretched onClick={() => onSelect("organizer")}>
          Вход организатора
        </AppButton>
      </div>
    </section>
  );
}
