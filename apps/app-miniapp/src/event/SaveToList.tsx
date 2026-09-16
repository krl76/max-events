// START_MODULE_CONTRACT
// PURPOSE: Save-to-list control on the event page: «Сохранить» opens the preset list picker, per-list membership toggles against the lists API.
// SCOPE: Data via apiClient.listLists/addListItem/removeListItem (mock or live); inline sheet, no modal; the user id is resolved by the caller.
// DEPENDS: ../api/client.js (apiClient, ListSummary), ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - SaveToListState - union of the picker fetch states (loading / error / ready)
// - SaveToListView - presentational: picker rows with the «В списке» state and the «Готово» button
// - SaveToList - collapsed «Сохранить»/«Сохранено» button expanding the picker, toggle wiring
// END_MODULE_MAP

import { useCallback, useEffect, useState } from "react";
import { apiClient, type ListSummary } from "../api/client";

export type SaveToListState = { status: "loading" } | { status: "error" } | { status: "ready"; summaries: ListSummary[] };

export function SaveToListView({ state, onToggle, onDone }: { state: SaveToListState; onToggle: (summary: ListSummary) => void; onDone: () => void }) {
  return (
    <section className="app-event">
      <div className="app-event-body">
        {state.status === "loading" && <p className="app-state">Загрузка…</p>}
        {state.status === "error" && <p className="app-state app-state--error">Не удалось загрузить списки.</p>}
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
        <button type="button" className="app-event-cta" onClick={onDone}>
          Готово
        </button>
      </div>
    </section>
  );
}

export function SaveToList({ eventId, userId }: { eventId: string; userId: string }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<SaveToListState>({ status: "loading" });

  const load = useCallback(() => {
    setState({ status: "loading" });
    apiClient.listLists(userId, eventId).then(
      (summaries) => setState({ status: "ready", summaries }),
      () => setState({ status: "error" }),
    );
  }, [userId, eventId]);
  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const toggle = useCallback(
    (summary: ListSummary) => {
      const call = summary.savedItemId === null ? apiClient.addListItem(summary.list.id, { userId, eventId }) : apiClient.removeListItem(summary.list.id, summary.savedItemId);
      call.then(load, load);
    },
    [userId, eventId, load],
  );

  if (!open) {
    const savedCount = state.status === "ready" ? state.summaries.filter((summary) => summary.savedItemId !== null).length : 0;
    return (
      <section className="app-event">
        <div className="app-event-body">
          <button type="button" className="app-event-cta" onClick={() => setOpen(true)}>
            {savedCount > 0 ? "Сохранено" : "Сохранить"}
          </button>
        </div>
      </section>
    );
  }
  return <SaveToListView state={state} onToggle={toggle} onDone={() => setOpen(false)} />;
}
