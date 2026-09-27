// START_MODULE_CONTRACT
// PURPOSE: Save-to-list picker of the event page: the bookmark control of экран 17 opens it, and each row toggles this event in one list against the lists API.
// SCOPE: Data via apiClient.listLists/addListItem/removeListItem (mock or live). Open, the picker is a popup portaled to the document body: the feed card animates with a transform, and a fixed sheet inside that card stays trapped in the post. Open/closed belongs to the caller when the control lives in the hero or the feed bookmark.
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
import { createPortal } from "react-dom";
import { apiClient, type ListSummary } from "../api/client";
import { AppButton, AppState } from "../ui/primitives";

export type SaveToListState = { status: "loading" } | { status: "error" } | { status: "ready"; summaries: ListSummary[] };

export function SaveToListView({ state, onToggle, onDone, creating = false, newTitle = "", onNewTitle = () => {}, onCreateStart = () => {}, onCreateSubmit = () => {}, createError = null }: { state: SaveToListState; onToggle: (summary: ListSummary) => void; onDone: () => void; creating?: boolean; newTitle?: string; onNewTitle?: (value: string) => void; onCreateStart?: () => void; onCreateSubmit?: () => void; createError?: string | null }) {
  return (
    <div className="app-save-sheet" role="dialog" aria-modal="true" aria-label="Сохранить в список">
      <button type="button" className="app-save-sheet-backdrop" aria-label="Закрыть" onClick={onDone} />
      <section className="app-save-sheet-card">
        <header className="app-save-sheet-head">
          <h2 className="app-save-sheet-title">Сохранить</h2>
          <button type="button" className="app-save-sheet-close" aria-label="Закрыть окно" onClick={onDone}>
            Закрыть
          </button>
        </header>
        <div className="app-save-sheet-scroll">
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
          {state.status === "ready" && !creating && (
            <button type="button" className="app-lists-new app-lists-new--sheet" onClick={onCreateStart}>
              Новый список
            </button>
          )}
          {creating && (
            <div className="app-lists-form">
              <label className="app-lists-form-label" htmlFor="save-new-title">
                Название списка
              </label>
              <input id="save-new-title" className="app-lists-form-input" value={newTitle} placeholder="Например, «С друзьями»" onChange={(change) => onNewTitle(change.target.value)} />
              {createError !== null && <AppState error>{createError}</AppState>}
              <AppButton disabled={newTitle.trim() === ""} onClick={onCreateSubmit}>
                Создать список
              </AppButton>
            </div>
          )}
        </div>
        <div className="app-save-sheet-foot">
          <AppButton onClick={onDone} stretched>
            Готово
          </AppButton>
        </div>
      </section>
    </div>
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
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(
    (quiet = false) => {
      if (!quiet) setState({ status: "loading" });
      apiClient.listLists(userId, eventId, feedPostId).then(
        (summaries) => setState({ status: "ready", summaries }),
        () => {
          if (!quiet) setState({ status: "error" });
        },
      );
    },
    [userId, eventId, feedPostId],
  );
  useEffect(() => {
    if (isOpen) load();
  }, [isOpen, load]);
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") controlled ? onClose?.() : setSelfOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, controlled, onClose]);

  const toggle = useCallback(
    (summary: ListSummary) => {
      if (pending.has(summary.list.id)) return;
      const payload = eventId !== undefined ? { userId, eventId } : { userId, feedPostId: feedPostId! };
      const adding = summary.savedItemId === null;
      setPending((current) => new Set(current).add(summary.list.id));
      setState((current) => (current.status === "ready" ? { status: "ready", summaries: current.summaries.map((row) => (row.list.id === summary.list.id ? { ...row, savedItemId: adding ? row.list.id : null, itemsCount: adding ? row.itemsCount + 1 : Math.max(0, row.itemsCount - 1) } : row)) } : current));
      const call = adding ? apiClient.addListItem(summary.list.id, payload) : apiClient.removeListItem(summary.list.id, summary.savedItemId!);
      call.then(
        () => {
          setPending((current) => {
            const next = new Set(current);
            next.delete(summary.list.id);
            return next;
          });
          load(true);
        },
        () => {
          setPending((current) => {
            const next = new Set(current);
            next.delete(summary.list.id);
            return next;
          });
          load();
        },
      );
    },
    [userId, eventId, feedPostId, load, pending],
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
  const close = () => (controlled ? onClose?.() : setSelfOpen(false));
  const view = (
    <SaveToListView
      state={state}
      onToggle={toggle}
      creating={creating}
      newTitle={newTitle}
      createError={createError}
      onNewTitle={setNewTitle}
      onCreateStart={() => {
        setCreateError(null);
        setCreating(true);
      }}
      onCreateSubmit={() => {
        const title = newTitle.trim();
        if (title === "") return;
        apiClient.createList(title).then(
          () => {
            setNewTitle("");
            setCreating(false);
            setCreateError(null);
            load(true);
          },
          () => setCreateError("Не удалось создать список."),
        );
      }}
      onDone={close}
    />
  );
  // The feed card keeps a transform from its entrance animation, so a fixed sheet inside the post
  // is pinned to that card and the close button falls below the fold.
  const host = typeof document === "undefined" ? null : (document.querySelector(".app-root") ?? document.body);
  return host === null ? view : createPortal(view, host);
}
