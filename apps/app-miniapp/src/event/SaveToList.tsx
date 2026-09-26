// START_MODULE_CONTRACT
// PURPOSE: Save-to-list picker of the event page: the bookmark control of экран 17 opens it, and each row toggles this event in one list against the lists API.
// SCOPE: Data via apiClient.listLists/addListItem/removeListItem (mock or live); an inline panel, never a modal; open/closed belongs to the caller, because the control that opens it lives in the hero and in the sticky bar.
// DEPENDS: ../api/client.js (apiClient, ListSummary), ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - SaveToListState - union of the picker fetch states (loading / error / ready)
// - SaveToListView - presentational: picker rows with the «В списке» state and the «Готово» button
// - SaveToList - the picker: loads the lists while open and wires the per-row toggle; with an `open` flag the caller owns the control (экран 17 keeps it in the hero), without one it draws its own «Сохранить» button
// END_MODULE_MAP

import { useCallback, useEffect, useState } from "react";
import { apiClient, type ListSummary } from "../api/client";
import { AppButton, AppState } from "../ui/primitives";

export type SaveToListState = { status: "loading" } | { status: "error" } | { status: "ready"; summaries: ListSummary[] };

export function SaveToListView({ state, onToggle, onDone }: { state: SaveToListState; onToggle: (summary: ListSummary) => void; onDone: () => void }) {
  return (
    <section className="app-ev-save" aria-label="Сохранить в список">
      <div className="app-ev-save-body">
        {state.status === "loading" && <AppState>Загрузка…</AppState>}
        {state.status === "error" && <AppState error>Не удалось загрузить списки.</AppState>}
        {state.status === "ready" && (
          <ul className="app-lists-picker">
            {state.summaries.map((summary) => (
              <li key={summary.list.id}>
                <button type="button" className="app-lists-row" aria-pressed={summary.savedItemId !== null} onClick={() => onToggle(summary)}>
                  <span className="app-lists-row-title">{summary.list.title}</span>
                  <span className="app-lists-row-state">{summary.savedItemId === null ? "Добавить" : "В списке"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <AppButton onClick={onDone} stretched>
          Готово
        </AppButton>
      </div>
    </section>
  );
}

/**
 * Open/closed is optional on purpose. On экран 17 the control that opens the picker is the bookmark
 * in the hero, so the page owns the flag; anywhere the picker is on its own it still carries its own
 * «Сохранить» button rather than forcing every caller to invent one.
 */
export function SaveToList({ eventId, feedPostId, userId, open, onClose }: { eventId?: string; feedPostId?: string; userId: string; open?: boolean; onClose?: () => void }) {
  const [selfOpen, setSelfOpen] = useState(false);
  const controlled = open !== undefined;
  const isOpen = controlled ? open : selfOpen;
  const [state, setState] = useState<SaveToListState>({ status: "loading" });

  const load = useCallback(() => {
    setState({ status: "loading" });
    apiClient.listLists(userId, eventId, feedPostId).then(
      (summaries) => setState({ status: "ready", summaries }),
      () => setState({ status: "error" }),
    );
  }, [userId, eventId, feedPostId]);
  useEffect(() => {
    if (isOpen) load();
  }, [isOpen, load]);

  const toggle = useCallback(
    (summary: ListSummary) => {
      const payload = eventId !== undefined ? { userId, eventId } : { userId, feedPostId: feedPostId! };
      const call = summary.savedItemId === null ? apiClient.addListItem(summary.list.id, payload) : apiClient.removeListItem(summary.list.id, summary.savedItemId);
      call.then(load, load);
    },
    [userId, eventId, feedPostId, load],
  );

  if (!isOpen) {
    if (controlled) return null;
    const savedCount = state.status === "ready" ? state.summaries.filter((summary) => summary.savedItemId !== null).length : 0;
    return (
      <section className="app-ev-save">
        <div className="app-ev-save-body">
          <AppButton onClick={() => setSelfOpen(true)} stretched tone="secondary">
            {savedCount > 0 ? "Сохранено" : "Сохранить"}
          </AppButton>
        </div>
      </section>
    );
  }
  return <SaveToListView state={state} onToggle={toggle} onDone={() => (controlled ? onClose?.() : setSelfOpen(false))} />;
}
