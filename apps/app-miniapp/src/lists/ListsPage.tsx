// START_MODULE_CONTRACT
// PURPOSE: Lists UI: preset lists overview with counters, one list screen with saved event cards, profile entry link.
// SCOPE: Data via apiClient.listLists/getListItems (mock or live); presentational rendering; no custom list management (P2 backlog).
// DEPENDS: ../api/client.js (apiClient, ListItemCard, ListSummary), ../auth/AuthContext.js, ../catalog/CatalogPage.js (formatStartsAt), ../event/EventPage.js (DEMO_USER_ID), ../routing/router.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - listItemsLabel - ru counter line for a list row («1 событие», «Пусто»)
// - ListsState - union of the lists fetch states (loading / error / ready)
// - ListsView - presentational: one card per preset list with its counter
// - ListsPage - route container: loads the preset lists of the current user
// - ListState - union of the list items fetch states (loading / error / ready)
// - ListView - presentational: saved event cards, navigation to the event page
// - ListPage - route container: loads the items of one list
// - ListsLink - profile entry button to the lists screen
// END_MODULE_MAP

import { useEffect, useState } from "react";
import { apiClient, type ListItemCard, type ListSummary } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { formatStartsAt } from "../catalog/CatalogPage";
import { DEMO_USER_ID } from "../event/EventPage";
import { useRoute } from "../routing/router";

export function listItemsLabel(count: number): string {
  if (count === 0) return "Пусто";
  const mod10 = count % 10;
  const mod100 = count % 100;
  const word = mod10 === 1 && mod100 !== 11 ? "событие" : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "события" : "событий";
  return `${count} ${word}`;
}

export type ListsState = { status: "loading" } | { status: "error" } | { status: "ready"; summaries: ListSummary[] };

export function ListsView({ state, onOpen }: { state: ListsState; onOpen: (listId: string) => void }) {
  if (state.status === "loading") return <p className="app-state">Загрузка…</p>;
  if (state.status === "error") return <p className="app-state app-state--error">Не удалось загрузить списки.</p>;
  return (
    <>
      {state.summaries.map(({ list, itemsCount }) => (
        <button key={list.id} type="button" className="app-card app-card--link" onClick={() => onOpen(list.id)}>
          <div className="app-card-body">
            <span className="app-card-title">{list.title}</span>
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

export function ListView({ state, onOpenEvent }: { state: ListState; onOpenEvent: (eventId: string) => void }) {
  if (state.status === "loading") return <p className="app-state">Загрузка…</p>;
  if (state.status === "error") return <p className="app-state app-state--error">Не удалось загрузить список.</p>;
  if (state.cards.length === 0) return <p className="app-state">Пока ничего не сохранено.</p>;
  return (
    <>
      {state.cards.map(({ item, event }) => (
        <button key={item.id} type="button" className="app-card app-card--link" onClick={() => onOpenEvent(event.id)}>
          <div className="app-card-body">
            <span className="app-card-title">{event.title}</span>
            <span className="app-card-subtitle">{formatStartsAt(event.startsAt)}</span>
          </div>
        </button>
      ))}
    </>
  );
}

export function ListPage({ id }: { id: string }) {
  const { navigate } = useRoute();
  const [state, setState] = useState<ListState>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    apiClient.getListItems(id).then(
      (cards) => {
        if (alive) setState({ status: "ready", cards });
      },
      () => {
        if (alive) setState({ status: "error" });
      },
    );
    return () => {
      alive = false;
    };
  }, [id]);
  return <ListView state={state} onOpenEvent={(eventId) => navigate({ name: "event", id: eventId })} />;
}

export function ListsLink() {
  const { navigate } = useRoute();
  return (
    <button type="button" className="app-lists-link" onClick={() => navigate({ name: "lists" })}>
      Сохранённое
    </button>
  );
}
