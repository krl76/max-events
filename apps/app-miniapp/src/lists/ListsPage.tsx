// START_MODULE_CONTRACT
// PURPOSE: Lists UI: preset lists overview with counters, one list screen with saved event cards, shared-collection screen (participants, both add, «Отправить в чат»), profile entry link.
// SCOPE: Data via apiClient.listLists/getList/addListItem/getListItems (mock or live); presentational rendering; no custom list management (P2 backlog); sharing via bridge.shareResult.
// DEPENDS: ../api/client.js (apiClient, ListItemCard, ListScreen, ListSummary), ../auth/AuthContext.js, ../catalog/CatalogPage.js (formatStartsAt), ../catalog/format.js (pluralRu), ../max/bridge.js (webApp, shareResult, ShareChannel), ../routing/router.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, DF-MAX-IDENTITY
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - participantsLabel - «Имя + Имя» line of a shared collection
// - collectionShareText - share text of a shared collection for the MAX chat
// - shareCollection - sends the collection share text through the given share channel
// - ListsState - union of the lists fetch states (loading / error / ready)
// - ListsView - presentational: one card per list with its counter; shared collections carry the badge and participants
// - ListsPage - route container: loads the preset lists of the current user
// - ListState - union of the list items fetch states (loading / error / ready)
// - ListScreenState - union of the one-list aggregate fetch states (loading / error / ready)
// - ListView - presentational: saved event cards (with the author line for shared collections), navigation to the event page
// - ListPage - route container: loads one list, wires «Отправить в чат» and the add-row of a shared collection (event options via apiClient.listEvents)
// END_MODULE_MAP

import { useCallback, useEffect, useState } from "react";
import type { Event, Friend, List } from "@max-events/api-contracts";
import { apiClient, type ListItemCard, type ListScreen, type ListSummary } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { formatStartsAt } from "../catalog/CatalogPage";
import { pluralRu } from "../catalog/format";
import { shareResult, webApp, type ShareChannel } from "../max/bridge";
import { AppButton, AppState } from "../ui/primitives";
import { ActionIcon } from "../ui/icons";
import { useRoute } from "../routing/router";

export function participantsLabel(participants: Friend[]): string {
  return participants.map((participant) => participant.name).join(" + ");
}

export function collectionShareText(list: List, cards: ListItemCard[]): string {
  return `Совместная коллекция «${list.title}»: ${cards.map((card) => card.event.title).join(", ")}`;
}

export function shareCollection(list: List, cards: ListItemCard[], share: (text: string) => Promise<ShareChannel>): Promise<ShareChannel> {
  return share(collectionShareText(list, cards));
}

export type ListsState = { status: "loading" } | { status: "error" } | { status: "ready"; summaries: ListSummary[] };

export function ListsView({ state, onOpen }: { state: ListsState; onOpen: (listId: string) => void }) {
  if (state.status === "loading") return <AppState>Загрузка…</AppState>;
  if (state.status === "error") return <AppState error>Не удалось загрузить списки.</AppState>;
  return (
    <>
      {state.summaries.map(({ list, itemsCount, participants }) => (
        <button key={list.id} type="button" className="app-card app-card--link" onClick={() => onOpen(list.id)}>
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
      ))}
    </>
  );
}

export function ListsPage() {
  const auth = useAuth();
  const userId = auth.status === "authenticated" ? auth.user.id : null;
  const { navigate } = useRoute();
  const [state, setState] = useState<ListsState>({ status: "loading" });
  useEffect(() => {
    if (userId === null) return;
    let alive = true;
    setState({ status: "loading" });
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
  }, [userId]);
  return <ListsView state={state} onOpen={(listId) => navigate({ name: "list", id: listId })} />;
}

export type ListState = { status: "loading" } | { status: "error" } | { status: "ready"; cards: ListItemCard[] };

export function ListView({ state, onOpenEvent, showAuthors = false }: { state: ListState; onOpenEvent: (eventId: string) => void; showAuthors?: boolean }) {
  if (state.status === "loading") return <AppState>Загрузка…</AppState>;
  if (state.status === "error") return <AppState error>Не удалось загрузить список.</AppState>;
  if (state.cards.length === 0) return <AppState>Пока ничего не сохранено.</AppState>;
  return (
    <>
      {state.cards.map(({ item, event, addedBy }) => (
        <button key={item.id} type="button" className="app-card app-card--link" onClick={() => onOpenEvent(event.id)}>
          <div className="app-card-body">
            <span className="app-card-title">{event.title}</span>
            <span className="app-card-subtitle">{formatStartsAt(event.startsAt)}</span>
            {showAuthors && addedBy !== null && <span className="app-card-subtitle">Добавил: {addedBy.name}</span>}
          </div>
          <span className="app-row-chevron" aria-hidden="true">
            <ActionIcon name="chevron" size={16} strokeWidth={2} />
          </span>
        </button>
      ))}
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
  useEffect(() => {
    if (!isShared) return;
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
  }, [isShared]);

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
  const listState: ListState = { status: "ready", cards: screen.items };
  const addReady = events.some((event) => event.title === adding.trim());

  return (
    <>
      {isShared && (
        <section className="app-event">
          <div className="app-event-body">
            <p className="app-card-title">
              <span className="app-micro-badge">Совместная</span> {screen.list.title}
            </p>
            <p className="app-gathering-hint">{participantsLabel(screen.participants)}</p>
            <AppButton
              onClick={() => {
                shareCollection(screen.list, screen.items, (text) => shareResult(webApp, text)).then(setShared);
              }}
              stretched
            >
              Отправить в чат
            </AppButton>
            {shared === "bridge" && <p className="app-whereto-share-hint">Выберите чат в MAX — экран отправки открыт.</p>}
            {shared === "clipboard" && <p className="app-whereto-share-hint">Коллекция скопирована — вставьте её в чат.</p>}
            <label className="app-gathering-time">
              Добавить событие
              <input className="app-gathering-time-input" list="shared-event-options" value={adding} placeholder="Событие" onChange={(change) => setAdding(change.target.value)} />
              <datalist id="shared-event-options">
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
      )}
      <ListView state={listState} onOpenEvent={(eventId) => navigate({ name: "event", id: eventId })} showAuthors={isShared} />
    </>
  );
}
