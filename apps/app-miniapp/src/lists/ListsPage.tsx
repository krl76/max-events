// START_MODULE_CONTRACT
// PURPOSE: Lists UI: the six presets and the lists a user makes themselves, one list screen with its saved events, sharing and adding for any list, participants on a shared collection.
// SCOPE: Data via apiClient.listLists/getList/createList/renameList/deleteList/addListItem/removeListItem (mock or live); presentational rendering; create, rename and delete a list of one's own (a preset refuses both, the backend recreates it); sharing via bridge.shareResult.
// DEPENDS: ../api/client.js (apiClient, ListItemCard, ListScreen, ListSummary), ../auth/AuthContext.js, ../catalog/CatalogPage.js (formatStartsAt), ../catalog/format.js (pluralRu), ../max/bridge.js (webApp, shareResult, ShareChannel), ../routing/router.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, DF-MAX-IDENTITY
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - participantsLabel - «Имя + Имя» line of a shared collection
// - listShareText - share text: «Совместная коллекция» or «Список», then the event titles
// - ListsState - union of the lists fetch states (loading / error / ready)
// - ListsView - presentational: one card per list with its counter; shared collections carry the badge and participants
// - ListsPage - container (the saved tab of the «Моё» screen): loads the preset lists of the current user
// - ListState - union of the list items fetch states (loading / error / ready)
// - ListScreenState - union of the one-list aggregate fetch states (loading / error / ready)
// - ListView - presentational: saved event cards (with the author line for shared collections), navigation to the event page
// - ListPage - route container: loads one list, wires «Отправить в чат» and the add-row of a shared collection (event options via apiClient.listEvents)
// END_MODULE_MAP

import { useCallback, useEffect, useState } from "react";
import type { Event, Friend, List } from "@max-events/api-contracts";
import { ApiError, apiClient, type ListItemCard, type ListScreen, type ListSummary } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { formatStartsAt } from "../catalog/CatalogPage";
import { pluralRu } from "../catalog/format";
import { shareResult, webApp, type ShareChannel } from "../max/bridge";
import { AppButton, AppState } from "../ui/primitives";
import { ActionIcon } from "../ui/icons";
import { useRoute } from "../routing/router";

/** Mirrors MAX_CUSTOM_LISTS on the backend: the number the 409 is about. */
const MAX_OWN_LISTS = 20;

export function participantsLabel(participants: Friend[]): string {
  return participants.map((participant) => participant.name).join(" + ");
}

/** A personal list is not a «совместная коллекция»; the noun follows who the list belongs to. */
export function listShareText(list: List, cards: ListItemCard[], shared: boolean): string {
  return `${shared ? "Совместная коллекция" : "Список"} «${list.title}»: ${cards.map((card) => card.event?.title ?? card.place?.title ?? "").filter((title) => title !== "").join(", ")}`;
}

export type ListsState = { status: "loading" } | { status: "error" } | { status: "ready"; summaries: ListSummary[] };

interface ListsViewProps {
  state: ListsState;
  onOpen: (listId: string) => void;
  /** Draft of the list being created; the create row is hidden when the caller wires nothing. */
  newTitle?: string;
  onNewTitle?: (value: string) => void;
  onCreate?: () => void;
  renamingId?: string | null;
  renameTitle?: string;
  onRenameTitle?: (value: string) => void;
  onRenameStart?: (listId: string, title: string) => void;
  onRenameSubmit?: () => void;
  onRenameCancel?: () => void;
  /** Set on the list awaiting a second tap: a delete takes its events with it and cannot be undone. */
  confirmingId?: string | null;
  onDelete?: (listId: string) => void;
  busy?: boolean;
  error?: string | null;
}

export function ListsView({ state, onOpen, newTitle = "", onNewTitle, onCreate = () => {}, renamingId = null, renameTitle = "", onRenameTitle = () => {}, onRenameStart = () => {}, onRenameSubmit = () => {}, onRenameCancel = () => {}, confirmingId = null, onDelete = () => {}, busy = false, error = null }: ListsViewProps) {
  if (state.status === "loading") return <AppState>Загрузка…</AppState>;
  if (state.status === "error") return <AppState error>Не удалось загрузить списки.</AppState>;
  return (
    <>
      {onNewTitle !== undefined && (
        <section className="app-event">
          <div className="app-event-body">
            <label className="app-gathering-time">
              Свой список
              <input className="app-gathering-time-input" value={newTitle} placeholder="Например, «Сводить маму»" onChange={(change) => onNewTitle(change.target.value)} />
            </label>
            <AppButton disabled={newTitle.trim() === "" || busy} onClick={onCreate} stretched>
              Создать список
            </AppButton>
            {error !== null && <AppState error>{error}</AppState>}
          </div>
        </section>
      )}
      {state.summaries.map(({ list, itemsCount, participants }) => {
        // Presets are recreated by the backend, so they carry no rename or delete: the change would
        // not stick, and a button that undoes itself is worse than no button.
        const editable = list.preset === null && participants.length === 0;
        return (
          <div key={list.id} className="app-list-row">
            {renamingId === list.id ? (
              <section className="app-event">
                <div className="app-event-body">
                  <label className="app-gathering-time">
                    Новое название
                    <input className="app-gathering-time-input" value={renameTitle} aria-label={`Новое название: ${list.title}`} onChange={(change) => onRenameTitle(change.target.value)} />
                  </label>
                  <AppButton disabled={renameTitle.trim() === "" || busy} onClick={onRenameSubmit} stretched>
                    Сохранить
                  </AppButton>
                  <AppButton tone="secondary" onClick={onRenameCancel} stretched>
                    Отмена
                  </AppButton>
                  {error !== null && <AppState error>{error}</AppState>}
                </div>
              </section>
            ) : (
              <>
                <button type="button" className="app-card app-card--link" onClick={() => onOpen(list.id)}>
                  <div className="app-card-body">
                    <span className="app-card-title">
                      {participants.length > 0 && <span className="app-micro-badge">Совместная</span>} {list.title}
                    </span>
                    {participants.length > 0 && <span className="app-card-subtitle">{participantsLabel(participants)}</span>}
                    <span className="app-card-subtitle">{itemsCount === 0 ? "Пусто" : `${itemsCount} ${pluralRu(itemsCount, "событие", "события", "событий")}`}</span>
                  </div>
                  <span className="app-row-chevron" aria-hidden="true">
                    <ActionIcon name="chevron" size={16} strokeWidth={2} />
                  </span>
                </button>
                {editable && (
                  <div className="app-list-actions">
                    <AppButton size="small" tone="secondary" disabled={busy} onClick={() => onRenameStart(list.id, list.title)} aria-label={`Переименовать: ${list.title}`}>
                      Переименовать
                    </AppButton>
                    <AppButton size="small" tone="danger" disabled={busy} onClick={() => onDelete(list.id)} aria-label={confirmingId === list.id ? `Точно удалить: ${list.title}` : `Удалить: ${list.title}`}>
                      {confirmingId === list.id ? "Точно удалить?" : "Удалить"}
                    </AppButton>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </>
  );
}

export function ListsPage() {
  const auth = useAuth();
  const userId = auth.status === "authenticated" ? auth.user.id : null;
  const { navigate } = useRoute();
  const [state, setState] = useState<ListsState>({ status: "loading" });
  const [newTitle, setNewTitle] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    if (userId === null) return;
    let alive = true;
    // A reload after a mutation keeps the lists on screen: blanking them to «Загрузка…» unmounted the
    // form the user was typing in.
    setState((current) => (current.status === "ready" ? current : { status: "loading" }));
    apiClient.listLists(userId).then(
      (summaries) => {
        if (alive) setState({ status: "ready", summaries });
      },
      () => {
        if (alive) setState({ status: "error" });
      },
    );
    return () => {
      alive = false;
    };
  }, [userId, reloads]);

  // Every mutation reloads the summaries: counters and order come from the server, not from guesswork.
  const mutate = useCallback((run: Promise<unknown>, after: () => void) => {
    setBusy(true);
    setError(null);
    run.then(
      () => {
        after();
        setBusy(false);
        setReloads((value) => value + 1);
      },
      (reason: unknown) => {
        // The ceiling has its own answer: «не удалось» would leave the user tapping a button that
        // cannot ever work.
        setError(reason instanceof ApiError && reason.status === 409 ? `Больше ${MAX_OWN_LISTS} своих списков не получится` : "Не удалось изменить списки.");
        setBusy(false);
      },
    );
  }, []);

  return (
    <ListsView
      state={state}
      onOpen={(listId) => navigate({ name: "list", id: listId })}
      newTitle={newTitle}
      onNewTitle={setNewTitle}
      onCreate={() => mutate(apiClient.createList(newTitle.trim()), () => setNewTitle(""))}
      renamingId={renamingId}
      renameTitle={renameTitle}
      onRenameTitle={setRenameTitle}
      onRenameStart={(listId, title) => {
        setError(null);
        setConfirmingId(null);
        setRenamingId(listId);
        setRenameTitle(title);
      }}
      onRenameSubmit={() => {
        if (renamingId === null) return;
        mutate(apiClient.renameList(renamingId, renameTitle.trim()), () => setRenamingId(null));
      }}
      onRenameCancel={() => {
        setError(null);
        setRenamingId(null);
      }}
      confirmingId={confirmingId}
      onDelete={(listId) => {
        // Two taps: a delete takes every saved event with it and there is no undo.
        if (confirmingId !== listId) {
          setError(null);
          setConfirmingId(listId);
          return;
        }
        mutate(apiClient.deleteList(listId), () => {
          setConfirmingId(null);
          setRenamingId(null);
        });
      }}
      busy={busy}
      error={error}
    />
  );
}

export type ListState = { status: "loading" } | { status: "error" } | { status: "ready"; cards: ListItemCard[] };

export function ListView({ state, onOpenEvent, onOpenPlace, showAuthors = false, onRemove }: { state: ListState; onOpenEvent: (eventId: string) => void; onOpenPlace?: (placeId: string) => void; showAuthors?: boolean; onRemove?: (itemId: string) => void }) {
  if (state.status === "loading") return <AppState>Загрузка…</AppState>;
  if (state.status === "error") return <AppState error>Не удалось загрузить список.</AppState>;
  if (state.cards.length === 0) return <AppState>Пока ничего не сохранено.</AppState>;
  return (
    <>
      {state.cards.map(({ item, event, place, addedBy }) => {
        const title = event?.title ?? place?.title ?? "";
        const subtitle = event ? formatStartsAt(event.startsAt) : (place?.address ?? "");
        return (
          <div key={item.id} className="app-list-row">
            <button
              type="button"
              className="app-card app-card--link"
              onClick={() => {
                if (event) onOpenEvent(event.id);
                else if (place) onOpenPlace?.(place.id);
              }}
            >
              <div className="app-card-body">
                <span className="app-card-title">{title}</span>
                <span className="app-card-subtitle">{subtitle}</span>
                {showAuthors && addedBy !== null && <span className="app-card-subtitle">Добавил: {addedBy.name}</span>}
              </div>
              <span className="app-row-chevron" aria-hidden="true">
                <ActionIcon name="chevron" size={16} strokeWidth={2} />
              </span>
            </button>
            {onRemove !== undefined && (
              <div className="app-list-actions">
                <AppButton size="small" tone="secondary" onClick={() => onRemove(item.id)} aria-label={`Убрать из списка: ${title}`}>
                  Убрать
                </AppButton>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

export type ListScreenState = { status: "loading" } | { status: "error" } | { status: "ready"; screen: ListScreen };

export function ListPage({ id }: { id: string }) {
  const auth = useAuth();
  const userId = auth.status === "authenticated" ? auth.user.id : null;
  const { navigate } = useRoute();
  const [state, setState] = useState<ListScreenState>({ status: "loading" });
  const [shared, setShared] = useState<ShareChannel | null>(null);
  const [adding, setAdding] = useState("");
  const [events, setEvents] = useState<Event[]>([]);

  const load = useCallback(() => {
    setState({ status: "loading" });
    apiClient.getList(id).then(
      (screen) => setState({ status: "ready", screen }),
      () => setState({ status: "error" }),
    );
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  const isShared = state.status === "ready" && state.screen.participants.length > 0;
  const loaded = state.status === "ready";
  useEffect(() => {
    // Every list can take an event now, so the picker is loaded for a personal list too.
    if (!loaded) return;
    let alive = true;
    apiClient.listEvents().then(
      (list) => {
        if (alive) setEvents(list);
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [loaded]);

  const add = useCallback(() => {
    if (userId === null) return;
    const event = events.find((item) => item.title === adding.trim());
    if (!event) return;
    setAdding("");
    apiClient.addListItem(id, { userId, eventId: event.id }).then(load, load);
  }, [adding, events, id, userId, load]);

  if (state.status === "loading") return <AppState>Загрузка…</AppState>;
  if (state.status === "error") return <AppState error>Не удалось загрузить список.</AppState>;
  const { screen } = state;
  const removeItem = (itemId: string) => {
    apiClient.removeListItem(id, itemId).then(load, load);
  };
  const listState: ListState = { status: "ready", cards: screen.items };
  const addReady = events.some((event) => event.title === adding.trim());

  return (
    <>
      <section className="app-event">
        <div className="app-event-body">
          <p className="app-card-title">
            {isShared && <span className="app-micro-badge">Совместная</span>} {screen.list.title}
          </p>
          {isShared && <p className="app-gathering-hint">{participantsLabel(screen.participants)}</p>}
          {/* An empty list would share as «Список «С детьми»: » — a colon with nothing after it. */}
          <AppButton
            disabled={screen.items.length === 0}
            onClick={() => {
              shareResult(webApp, listShareText(screen.list, screen.items, isShared)).then(setShared);
            }}
            stretched
          >
            Отправить в чат
          </AppButton>
          {shared === "bridge" && <p className="app-whereto-share-hint">Выберите чат в MAX — экран отправки открыт.</p>}
          {shared === "clipboard" && <p className="app-whereto-share-hint">Список скопирован — вставьте его в чат.</p>}
          <label className="app-gathering-time">
            Добавить событие
            <input className="app-gathering-time-input" list="list-event-options" value={adding} placeholder="Событие" onChange={(change) => setAdding(change.target.value)} />
            <datalist id="list-event-options">
              {events.map((event) => (
                <option key={event.id} value={event.title} />
              ))}
            </datalist>
          </label>
          <AppButton disabled={!addReady} onClick={add} stretched>
            Добавить
          </AppButton>
        </div>
      </section>
      <ListView state={listState} onOpenEvent={(eventId) => navigate({ name: "event", id: eventId })} onOpenPlace={(placeId) => navigate({ name: "place", id: placeId })} showAuthors={isShared} onRemove={removeItem} />
    </>
  );
}
