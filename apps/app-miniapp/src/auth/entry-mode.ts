// START_MODULE_CONTRACT
// PURPOSE: Remember which entry the device already chose, so the branded chooser is only the first open.
// SCOPE: localStorage flag for user | organizer. The screen is ./EntryPage.js; the cold-start decision stays in ../App.js.
// DEPENDS: window.localStorage, ./EntryPage.js (EntryMode)
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ENTRY_MODE_STORAGE_KEY - localStorage key of the chosen entry (neighbour of max-events:onboarding)
// - readStoredEntryMode - the remembered choice, or null when this device has not chosen yet
// - writeStoredEntryMode - persist a choice, or clear it when the viewer leaves back to the chooser
// END_MODULE_MAP

import type { EntryMode } from "./EntryPage";

export const ENTRY_MODE_STORAGE_KEY = "max-events:entry-mode";

export function readStoredEntryMode(storage: Pick<Storage, "getItem">): EntryMode | null {
  try {
    const value = storage.getItem(ENTRY_MODE_STORAGE_KEY);
    return value === "user" || value === "organizer" ? value : null;
  } catch {
    return null;
  }
}

export function writeStoredEntryMode(storage: Pick<Storage, "setItem" | "removeItem">, mode: EntryMode | null): void {
  try {
    if (mode === null) storage.removeItem(ENTRY_MODE_STORAGE_KEY);
    else storage.setItem(ENTRY_MODE_STORAGE_KEY, mode);
  } catch {
    // Private mode: the next launch shows the chooser again.
  }
}
