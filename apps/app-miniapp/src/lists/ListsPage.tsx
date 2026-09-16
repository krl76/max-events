// START_MODULE_CONTRACT
// PURPOSE: Lists UI: preset lists overview with counters, one list screen with saved event cards, shared-collection screen (participants, both add, «Отправить в чат»), profile entry link.
// SCOPE: Data via apiClient.listLists/getList/addListItem/getListItems (mock or live); presentational rendering; no custom list management (P2 backlog); sharing via bridge.shareResult.
// DEPENDS: ../api/client.js (apiClient, ListItemCard, ListScreen, ListSummary), ../api/mock.js (mockEvents for the add datalist), ../auth/AuthContext.js, ../catalog/CatalogPage.js (formatStartsAt), ../event/EventPage.js (DEMO_USER_ID), ../max/bridge.js (webApp, shareResult, ShareChannel), ../routing/router.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, DF-MAX-IDENTITY
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - listItemsLabel - ru counter line for a list row («1 событие», «Пусто»)
// - participantsLabel - «Имя + Имя» line of a shared collection
// - collectionShareText - share text of a shared collection for the MAX chat
// - shareCollection - sends the collection share text through the given share channel
// - ListsState - union of the lists fetch states (loading / error / ready)
// - ListsView - presentational: one card per list with its counter; shared collections carry the badge and participants
// - ListsPage - route container: loads the preset lists of the current user
// - ListState - union of the list items fetch states (loading / error / ready)
// - ListScreenState - union of the one-list aggregate fetch states (loading / error / ready)
// - ListView - presentational: saved event cards (with the author line for shared collections), navigation to the event page
// - ListPage - route container: loads one list, wires «Отправить в чат» and the add-row of a shared collection
// - ListsLink - profile entry button to the lists screen
// END_MODULE_MAP

import { useCallback, useEffect, useState } from "react";
import type { Friend, List } from "@max-events/api-contracts";
import { apiClient, type ListItemCard, type ListScreen, type ListSummary } from "../api/client";
import { mockEvents } from "../api/mock";
import { useAuth } from "../auth/AuthContext";
import { formatStartsAt } from "../catalog/CatalogPage";
import { DEMO_USER_ID } from "../event/EventPage";
import { shareResult, webApp, type ShareChannel } from "../max/bridge";
import { useRoute } from "../routing/router";

export function listItemsLabel(count: number): string {
  if (count === 0) return "Пусто";
  const mod10 = count % 10;
  const mod100 = count % 100;
  const word = mod10 === 1 && mod100 !== 11 ? "событие" : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "события" : "событий";
  return `${count} ${word}`;
}

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
  if (state.status === "loading") return <p className="app-state">Загрузка…</p>;
  if (state.status === "error") return <p className="app-state app-state--error">Не удалось загрузить списки.</p>;
  return (
    <>
      {state.summaries.map(({ list, itemsCount, participants }) => (
        <button key={list.id} type="button" className="app-card app-card--link" onClick={() => onOpen(list.id)}>
          <div className="app-card-body">
            <span className="app-card-title">
              {participants.length > 0 && <span className="app-micro-badge">Совместная</span>} {list.title}
            </span>
            {participants.length > 0 && <span className="app-card-subtitle">{participantsLabel(participants)}</span>}
            <span className="app-card-subtitle">{listItemsLabel(itemsCount)}</span>
          </div>
        </button>
      ))}
    </>
  );
}

export function ListsPage() {
  const auth = useAuth();
  const userId = auth.status === "authenticated" ? auth.user.id : DEMO_USER_ID;
  const { navigate } = useRoute();
  const [state, setState] = useState<ListsState>({ status: "loading" });
  useEffect(() => {
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
  if (state.status === "loading") return <p className="app-state">Загрузка…</p>;
  if (state.status === "error") return <p className="app-state app-state--error">Не удалось загрузить список.</p>;
  if (state.cards.length === 0) return <p className="app-state">Пока ничего не сохранено.</p>;
  return (
    <>
      {state.cards.map(({ item, event, addedBy }) => (
        <button key={item.id} type="button" className="app-card app-card--link" onClick={() => onOpenEvent(event.id)}>
          <div className="app-card-body">
            <span className="app-card-title">{event.title}</span>
            <span className="app-card-subtitle">{formatStartsAt(event.startsAt)}</span>
            {showAuthors && addedBy !== null && <span className="app-card-subtitle">Добавил: {addedBy.name}</span>}
          </div>
        </button>
      ))}
    </>
  );
}

export type ListScreenState = { status: "loading" } | { status: "error" } | { status: "ready"; screen: ListScreen };

export function ListPage({ id }: { id: string }) {
  const auth = useAuth();
  const userId = auth.status === "authenticated" ? auth.user.id : DEMO_USER_ID;
  const { navigate } = useRoute();
  const [state, setState] = useState<ListScreenState>({ status: "loading" });
  const [shared, setShared] = useState<ShareChannel | null>(null);
  const [adding, setAdding] = useState("");

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

  const add = useCallback(() => {
    const event = mockEvents.find((item) => item.title === adding.trim());
    if (!event) return;
    setAdding("");
    apiClient.addListItem(id, { userId, eventId: event.id }).then(load, load);
  }, [adding, id, userId, load]);

  if (state.status === "loading") return <p className="app-state">Загрузка…</p>;
  if (state.status === "error") return <p className="app-state app-state--error">Не удалось загрузить список.</p>;
  const { screen } = state;
  const isShared = screen.participants.length > 0;
  const listState: ListState = { status: "ready", cards: screen.items };
  const addReady = mockEvents.some((event) => event.title === adding.trim());

  return (
    <>
      {isShared && (
        <section className="app-event">
          <div className="app-event-body">
            <p className="app-card-title">
              <span className="app-micro-badge">Совместная</span> {screen.list.title}
            </p>
            <p className="app-gathering-hint">{participantsLabel(screen.participants)}</p>
            <button
              type="button"
              className="app-event-cta"
              onClick={() => {
                shareCollection(screen.list, screen.items, (text) => shareResult(webApp, text)).then(setShared);
              }}
            >
              Отправить в чат
            </button>
            {shared === "bridge" && <p className="app-whereto-share-hint">Выберите чат в MAX — экран отправки открыт.</p>}
            {shared === "clipboard" && <p className="app-whereto-share-hint">Коллекция скопирована — вставьте её в чат.</p>}
            <label className="app-gathering-time">
              Добавить событие
              <input className="app-gathering-time-input" list="shared-event-options" value={adding} placeholder="Событие" onChange={(change) => setAdding(change.target.value)} />
              <datalist id="shared-event-options">
                {mockEvents.map((event) => (
                  <option key={event.id} value={event.title} />
                ))}
              </datalist>
            </label>
            <button type="button" className="app-gathering-launch" disabled={!addReady} onClick={add}>
              Добавить
            </button>
          </div>
        </section>
      )}
      <ListView state={listState} onOpenEvent={(eventId) => navigate({ name: "event", id: eventId })} showAuthors={isShared} />
    </>
  );
}

export function ListsLink() {
  const { navigate } = useRoute();
  return (
    <button type="button" className="app-lists-link" onClick={() => navigate({ name: "lists" })}>
      Сохранённое
    </button>
  );
}
