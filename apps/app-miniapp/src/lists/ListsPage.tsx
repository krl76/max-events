// START_MODULE_CONTRACT
// PURPOSE: Экран 37 «Списки» and экран 39 «Один список»: the six preset shelves, the lists of one's own up to twenty, and one list with its saved events, the author of every addition and its participants.
// SCOPE: Data via apiClient.listLists/getList/createList/renameList/deleteList/addListItem/removeListItem (mock or live); presentational rendering; create from экран 37, rename and delete from экран 39 (only a preset refuses both, the backend recreates it); sharing via bridge.shareResult.
// DEPENDS: ../api/client.js (apiClient, ListItemCard, ListScreen, ListSummary), ../auth/AuthContext.js, ../catalog/format.js (pluralRu), ../max/bridge.js (webApp, shareResult, ShareChannel), ../routing/router.js, ../ui/primitives.js, ../ui/icons.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, DF-MAX-IDENTITY
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - participantsLabel - «Имя + Имя» line of a shared collection, and the alt text of its avatar stack
// - listShareText - share text: «Совместная коллекция» or «Список», then the titles of the saved events and places
// - listCardTitle - the title a card shows: its event's or its place's, whichever the item references
// - listCountLabel - «24 события» under a tile, «Пусто» for a list with nothing in it
// - ownListsCounter - «3 из 20»: how many lists of one's own are used out of the ceiling
// - listEventMeta - «Сб 12:00 · 700 ₽» under an item title; a free event says so in words
// - listAuthorLabel - «добавила: Ты» / «добавил: Анна»; null when the item carries no author
// - ListFaces - overlapping participant avatars (initials); labelled for assistive tech
// - ListsState - union of the lists fetch states (loading / error / ready)
// - ListsView - экран 37 presentational: «Создать» topbar, the preset shelves, and the own-list tiles with one dashed «Новый список»
// - ListsPage - экран 37 container (also the «Сохранённое» tab, which embeds the grid without the topbar)
// - ListState - union of the list items fetch states (loading / error / ready)
// - ListView - экран 39 presentational: saved event and place cards with their meta, author line and the «убрать» control
// - ListScreenState - union of the one-list aggregate fetch states (loading / error / ready)
// - ListPage - экран 39 container: one list with its participants, adding, sharing, renaming and the confirmed delete
// END_MODULE_MAP

import { useCallback, useEffect, useState } from "react";
import type { Event, Friend, List, ListVisibility } from "@max-events/api-contracts";
import { ApiError, apiClient, type ListItemCard, type ListScreen, type ListSummary } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { pluralRu } from "../catalog/format";
import { shareResult, webApp, type ShareChannel } from "../max/bridge";
import { sharePayload } from "../max/links";
import { AppButton, AppState } from "../ui/primitives";
import { ActionIcon } from "../ui/icons";
import { pictured } from "../ui/photos";
import { useRoute } from "../routing/router";

/** Mirrors MAX_CUSTOM_LISTS on the backend: the number the 409 is about and the number «3 из 20» counts up to. */
const MAX_OWN_LISTS = 20;

/** The design draws two faces per stack; a third would not fit the 36px corner of a tile. */
const MAX_FACES = 2;

export function participantsLabel(participants: Friend[]): string {
  return participants.map((participant) => participant.name).join(" + ");
}

/** A personal list is not a «совместная коллекция»; the noun follows who the list belongs to. */
export function listShareText(list: List, cards: ListItemCard[], shared: boolean): string {
  return `${shared ? "Совместная коллекция" : "Список"} «${list.title}»: ${cards.map((card) => listCardTitle(card)).join(", ")}`;
}

/** A card names an event, a place or a post; the contract promises exactly one of them. */
export function listCardTitle(card: ListItemCard): string {
  if (card.event !== null) return card.event.title;
  if (card.place !== null) return card.place.title;
  if (card.post !== null) return card.post.text.trim() === "" ? card.post.eventTitle || "Пост" : card.post.text;
  return "";
}

export function listCountLabel(count: number): string {
  return count === 0 ? "Пусто" : `${count} ${pluralRu(count, "событие", "события", "событий")}`;
}

/** The counter counts the tiles below it: every list without a preset, shared collections included. */
export function ownListsCounter(summaries: ListSummary[]): string {
  return `${summaries.filter((summary) => summary.list.preset === null).length} из ${MAX_OWN_LISTS}`;
}

/** «Сб 12:00 · 700 ₽» — the weekday and time of the event, then the entry condition. */
export function listEventMeta(event: Pick<Event, "startsAt" | "isPaid" | "priceRub">): string {
  const date = new Date(event.startsAt);
  const weekday = date.toLocaleDateString("ru-RU", { weekday: "short" });
  const when = `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
  return `${when} · ${event.isPaid && event.priceRub !== null ? `${event.priceRub.toLocaleString("ru-RU")} ₽` : "бесплатно"}`;
}

/**
 * «добавила: Ты» for the viewer, «добавил: Анна» for anyone else — the two forms of the design, kept
 * verbatim. The backend carries no gender, so the wording cannot agree with every name; the design
 * spells the viewer's line out, and inventing a third form would put this screen out of step with it.
 */
export function listAuthorLabel(addedBy: Friend | null, viewerId: string | null): string | null {
  if (addedBy === null) return null;
  if (viewerId !== null && addedBy.id === viewerId) return "добавила: Ты";
  return `добавил: ${addedBy.name.split(" ")[0]}`;
}

/** Faces are decoration; the names live in the label, so the stack is one image to assistive tech. */
export function ListFaces({ participants, className }: { participants: Friend[]; className?: string }) {
  return (
    <span className={className ? `app-lists-faces ${className}` : "app-lists-faces"} role="img" aria-label={participantsLabel(participants)}>
      {participants.slice(0, MAX_FACES).map((participant, index) => (
        <span key={participant.id} className={index === 0 ? "app-lists-face" : "app-lists-face app-lists-face--alt"}>
          {participant.name.charAt(0)}
        </span>
      ))}
    </span>
  );
}

export type ListsState = { status: "loading" } | { status: "error" } | { status: "ready"; summaries: ListSummary[] };

function ListTile({ summary, onOpen, onToggleVisibility }: { summary: ListSummary; onOpen: (listId: string) => void; onToggleVisibility?: (listId: string, visibility: ListVisibility) => void }) {
  const { list, itemsCount, participants } = summary;
  const markClass = list.preset === null ? "app-lists-tile-mark app-lists-tile-mark--own" : "app-lists-tile-mark";
  const open = (
    <button type="button" className="app-lists-tile" onClick={() => onOpen(list.id)}>
      <span className="app-lists-tile-top">
        <span className={markClass} aria-hidden="true">
          <ActionIcon name="bookmark" size={18} strokeWidth={2.2} />
        </span>
        {participants.length > 0 && <ListFaces participants={participants} />}
      </span>
      <span className="app-lists-tile-title">{list.title}</span>
      <span className="app-lists-tile-count">{listCountLabel(itemsCount)}</span>
    </button>
  );
  if (onToggleVisibility === undefined || list.preset !== null) return open;
  const next: ListVisibility = list.visibility === "public" ? "private" : "public";
  return (
    <div className="app-lists-tile-wrap">
      {open}
      <button type="button" className="app-lists-visibility" aria-pressed={list.visibility === "public"} onClick={() => onToggleVisibility(list.id, next)}>
        {list.visibility === "public" ? "Открытый" : "Закрытый"}
      </button>
    </div>
  );
}

interface ListsViewProps {
  state: ListsState;
  onOpen: (listId: string) => void;
  /** Экран 37 draws its own topbar; the «Сохранённое» tab embeds the same grid under the tab chips. */
  topbar?: boolean;
  /** Draft of the list being created; the create row is hidden until «Создать» or «Новый список» is pressed. */
  creating?: boolean;
  newTitle?: string;
  onNewTitle?: (value: string) => void;
  onCreateStart?: () => void;
  onCreateSubmit?: () => void;
  onCreateCancel?: () => void;
  busy?: boolean;
  error?: string | null;
  onToggleVisibility?: (listId: string, visibility: ListVisibility) => void;
}

export function ListsView({ state, onOpen, topbar = false, creating = false, newTitle = "", onNewTitle = () => {}, onCreateStart = () => {}, onCreateSubmit = () => {}, onCreateCancel = () => {}, busy = false, error = null, onToggleVisibility }: ListsViewProps) {
  const presets = state.status === "ready" ? state.summaries.filter((summary) => summary.list.preset !== null) : [];
  const own = state.status === "ready" ? state.summaries.filter((summary) => summary.list.preset === null) : [];
  return (
    <section className="app-lists-screen" aria-label="Списки">
      {topbar && (
        <div className="app-lists-bar">
          <h1 className="app-lists-bar-title">Списки</h1>
          <button type="button" className="app-lists-create" onClick={onCreateStart} disabled={busy}>
            <ActionIcon name="plus" size={16} strokeWidth={2.8} />
            Создать
          </button>
        </div>
      )}
      {state.status === "loading" && <AppState>Загрузка…</AppState>}
      {state.status === "error" && <AppState error>Не удалось загрузить списки.</AppState>}
      {state.status === "ready" && (
        <>
          {creating && (
            <div className="app-lists-form">
              <label className="app-lists-form-label" htmlFor="lists-new-title">
                Название списка
              </label>
              <input id="lists-new-title" className="app-lists-form-input" value={newTitle} placeholder="Например, «Сводить маму»" onChange={(change) => onNewTitle(change.target.value)} />
              <div className="app-lists-form-actions">
                <AppButton disabled={newTitle.trim() === "" || busy} onClick={onCreateSubmit}>
                  Создать список
                </AppButton>
                <AppButton tone="secondary" onClick={onCreateCancel}>
                  Отмена
                </AppButton>
              </div>
            </div>
          )}
          {error !== null && <AppState error>{error}</AppState>}
          <div className="app-lists-head">
            <span className="app-lists-head-label">ГОТОВЫЕ ПОЛКИ</span>
          </div>
          <div className="app-lists-grid">
            {presets.map((summary) => (
              <ListTile key={summary.list.id} summary={summary} onOpen={onOpen} />
            ))}
          </div>
          <div className="app-lists-head">
            <span className="app-lists-head-label">МОИ СПИСКИ</span>
            <span className="app-lists-head-count">{ownListsCounter(state.summaries)}</span>
          </div>
          <div className="app-lists-grid">
            {own.map((summary) => (
              <ListTile key={summary.list.id} summary={summary} onOpen={onOpen} onToggleVisibility={onToggleVisibility} />
            ))}
            <button type="button" className="app-lists-new" onClick={onCreateStart} disabled={busy}>
              <ActionIcon name="plus" size={20} strokeWidth={2.8} />
              <span>Новый список</span>
            </button>
          </div>
        </>
      )}
    </section>
  );
}

export function ListsPage({ topbar = false, userId: subjectId }: { topbar?: boolean; userId?: string } = {}) {
  const auth = useAuth();
  const viewerId = auth.status === "authenticated" ? auth.user.id : null;
  const userId = viewerId === null ? null : (subjectId ?? viewerId);
  const editable = viewerId !== null && userId === viewerId;
  const { navigate } = useRoute();
  const [state, setState] = useState<ListsState>({ status: "loading" });
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
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

  const create = useCallback(() => {
    setBusy(true);
    setError(null);
    apiClient.createList(newTitle.trim()).then(
      () => {
        setNewTitle("");
        setCreating(false);
        setBusy(false);
        // The counters and the order come from the server, not from guesswork.
        setReloads((value) => value + 1);
      },
      (reason: unknown) => {
        // The ceiling has its own answer: «не удалось» would leave the user tapping a button that
        // cannot ever work.
        setError(reason instanceof ApiError && reason.status === 409 ? `Больше ${MAX_OWN_LISTS} своих списков не получится` : "Не удалось создать список.");
        setBusy(false);
      },
    );
  }, [newTitle]);

  const toggleVisibility = useCallback(
    (listId: string, visibility: ListVisibility) => {
      if (!editable) return;
      setBusy(true);
      setError(null);
      apiClient.setListVisibility(listId, visibility).then(
        () => {
          setBusy(false);
          setReloads((value) => value + 1);
        },
        () => {
          setError("Не удалось изменить видимость.");
          setBusy(false);
        },
      );
    },
    [editable],
  );

  return (
    <ListsView
      state={state}
      topbar={topbar}
      onOpen={(listId) => navigate({ name: "list", id: listId })}
      creating={creating}
      newTitle={newTitle}
      onNewTitle={setNewTitle}
      onCreateStart={() => {
        setError(null);
        setCreating(true);
      }}
      onCreateSubmit={create}
      onCreateCancel={() => {
        setError(null);
        setCreating(false);
      }}
      busy={busy}
      error={error}
      onToggleVisibility={editable ? toggleVisibility : undefined}
    />
  );
}

export type ListState = { status: "loading" } | { status: "error" } | { status: "ready"; cards: ListItemCard[] };

interface ListViewProps {
  state: ListState;
  onOpenEvent: (eventId: string) => void;
  /** A list may hold places as well as events; without a handler a saved place is shown but not opened. */
  onOpenPlace?: (placeId: string) => void;
  onOpenPost?: (postId: string) => void;
  /** Who added what only means something where more than one person adds: a shared collection. */
  showAuthors?: boolean;
  viewerId?: string | null;
  onRemove?: (itemId: string) => void;
}

export function ListView({ state, onOpenEvent, onOpenPlace, onOpenPost, showAuthors = false, viewerId = null, onRemove }: ListViewProps) {
  if (state.status === "loading") return <AppState>Загрузка…</AppState>;
  if (state.status === "error") return <AppState error>Не удалось загрузить список.</AppState>;
  if (state.cards.length === 0) return <AppState>Пока ничего не сохранено.</AppState>;
  return (
    <div className="app-list-items">
      {state.cards.map((card) => {
        const { item, event, place, post, addedBy } = card;
        const author = showAuthors ? listAuthorLabel(addedBy, viewerId) : null;
        const title = listCardTitle(card);
        const open = () => {
          if (event !== null) onOpenEvent(event.id);
          else if (place !== null) onOpenPlace?.(place.id);
          else if (post !== null) onOpenPost?.(post.id);
        };
        const mediaClass = event !== null ? `app-list-item-media app-media--${event.category}` : "app-list-item-media";
        const photo = post?.photoUrl ?? (event !== null ? pictured(event.id, event.coverUrl) : place !== null ? pictured(place.id) : null);
        const meta = event !== null ? listEventMeta(event) : (place?.address ?? (post !== null ? [post.author.name, post.eventTitle].filter((part) => part !== "").join(" · ") : ""));
        return (
          // The remove control sits beside the card, not inside it: a button inside a button is invalid.
          <div key={item.id} className="app-list-item">
            <button type="button" className="app-list-item-open" onClick={open}>
              {photo !== null ? <img className={mediaClass} src={photo} alt="" /> : <span className={mediaClass} aria-hidden="true" />}
              <span className="app-list-item-body">
                <span className="app-list-item-title">{title}</span>
                <span className="app-list-item-meta">{meta}</span>
                {author !== null && <span className="app-list-item-author">{author}</span>}
              </span>
            </button>
            {onRemove !== undefined && (
              <button type="button" className="app-list-item-drop" aria-label={`Убрать из списка: ${title}`} onClick={() => onRemove(item.id)}>
                <ActionIcon name="close" size={16} strokeWidth={2.2} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export type ListScreenState = { status: "loading" } | { status: "error" } | { status: "ready"; screen: ListScreen };

export function ListPage({ id }: { id: string }) {
  const auth = useAuth();
  const userId = auth.status === "authenticated" ? auth.user.id : null;
  const { navigate } = useRoute();
  const [state, setState] = useState<ListScreenState>({ status: "loading" });
  const [channel, setChannel] = useState<ShareChannel | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [events, setEvents] = useState<Event[]>([]);
  const [renaming, setRenaming] = useState(false);
  const [renameTitle, setRenameTitle] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setState((current) => (current.status === "ready" ? current : { status: "loading" }));
    apiClient.getList(id).then(
      (screen) => setState({ status: "ready", screen }),
      () => setState((current) => (current.status === "ready" ? current : { status: "error" })),
    );
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  // Every list can take an event now, so the picker is loaded for a personal list too.
  useEffect(() => {
    if (!adding) return;
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
  }, [adding]);

  const add = useCallback(() => {
    if (userId === null) return;
    const event = events.find((item) => item.title === draft.trim());
    if (!event) return;
    setDraft("");
    setAdding(false);
    apiClient.addListItem(id, { userId, eventId: event.id }).then(load, load);
  }, [draft, events, id, userId, load]);

  if (state.status === "loading") return <AppState>Загрузка…</AppState>;
  if (state.status === "error") return <AppState error>Не удалось загрузить список.</AppState>;

  const { screen } = state;
  const shared = screen.participants.length > 0;
  // Only a preset refuses the rename and the delete — the backend recreates it, so the button would
  // undo itself. A shared collection keeps both: sharing is a mock-side fiction the server does not
  // model, and макет, экран 39 draws the pair of actions on exactly such a list.
  const editable = screen.list.preset === null;
  const addReady = events.some((event) => event.title === draft.trim());
  const meta = [shared ? "Общий список" : null, listCountLabel(screen.items.length)].filter((part): part is string => part !== null).join(" · ");

  const removeItem = (itemId: string) => {
    apiClient.removeListItem(id, itemId).then(load, load);
  };

  const rename = () => {
    setBusy(true);
    setError(null);
    apiClient.renameList(id, renameTitle.trim()).then(
      () => {
        setRenaming(false);
        setBusy(false);
        load();
      },
      () => {
        setError("Не удалось переименовать список.");
        setBusy(false);
      },
    );
  };

  const remove = () => {
    // Two taps: a delete takes every saved event with it and there is no undo.
    if (!confirmingDelete) {
      setError(null);
      setConfirmingDelete(true);
      return;
    }
    setBusy(true);
    apiClient.deleteList(id).then(
      () => navigate({ name: "lists" }),
      () => {
        setError("Не удалось удалить список.");
        setConfirmingDelete(false);
        setBusy(false);
      },
    );
  };

  return (
    <section className="app-list-screen" aria-label={screen.list.title}>
      <div className="app-list-bar">
        <h1 className="app-list-bar-title">{screen.list.title}</h1>
        {/* An empty list would share as «Список «С детьми»: » — a colon with nothing after it. */}
        <button
          type="button"
          className="app-list-bar-round"
          aria-label="Отправить в чат"
          disabled={screen.items.length === 0}
          onClick={() => {
            const payload = sharePayload(listShareText(screen.list, screen.items, shared), `list-${screen.list.id}`);
            shareResult(webApp, payload.text, payload.link).then(setChannel);
          }}
        >
          <ActionIcon name="share" size={18} strokeWidth={2.2} />
        </button>
      </div>
      <div className="app-list-meta">
        {shared && <ListFaces participants={screen.participants} className="app-lists-faces--l" />}
        <span className="app-list-meta-text">{meta}</span>
        <button type="button" className="app-list-add" aria-expanded={adding} onClick={() => setAdding((value) => !value)}>
          Добавить
        </button>
      </div>
      {channel === "bridge" && <p className="app-whereto-share-hint">Выберите чат в MAX — экран отправки открыт.</p>}
      {channel === "clipboard" && <p className="app-whereto-share-hint">Список скопирован — вставьте его в чат.</p>}
      {adding && (
        <div className="app-lists-form">
          <label className="app-lists-form-label" htmlFor="list-add-event">
            Добавить событие
          </label>
          <input id="list-add-event" className="app-lists-form-input" list="list-event-options" value={draft} placeholder="Событие" onChange={(change) => setDraft(change.target.value)} />
          <datalist id="list-event-options">
            {events.map((event) => (
              <option key={event.id} value={event.title} />
            ))}
          </datalist>
          <div className="app-lists-form-actions">
            <AppButton disabled={!addReady} onClick={add}>
              Добавить
            </AppButton>
            <AppButton tone="secondary" onClick={() => setAdding(false)}>
              Отмена
            </AppButton>
          </div>
        </div>
      )}
      {renaming && (
        <div className="app-lists-form">
          <label className="app-lists-form-label" htmlFor="list-rename-title">
            Новое название
          </label>
          <input id="list-rename-title" className="app-lists-form-input" value={renameTitle} aria-label={`Новое название: ${screen.list.title}`} onChange={(change) => setRenameTitle(change.target.value)} />
          <div className="app-lists-form-actions">
            <AppButton disabled={renameTitle.trim() === "" || busy} onClick={rename}>
              Сохранить
            </AppButton>
            <AppButton tone="secondary" onClick={() => setRenaming(false)}>
              Отмена
            </AppButton>
          </div>
        </div>
      )}
      {error !== null && <AppState error>{error}</AppState>}
      <ListView state={{ status: "ready", cards: screen.items }} onOpenEvent={(eventId) => navigate({ name: "event", id: eventId })} onOpenPlace={(placeId) => navigate({ name: "place", id: placeId })} onOpenPost={(postId) => navigate({ name: "post", id: postId })} showAuthors={shared} viewerId={userId} onRemove={removeItem} />
      {editable && (
        <div className="app-list-footer">
          <button
            type="button"
            className="app-list-foot-btn"
            disabled={busy}
            onClick={() => {
              setError(null);
              setConfirmingDelete(false);
              setRenameTitle(screen.list.title);
              setRenaming(true);
            }}
          >
            Переименовать
          </button>
          {/* Native, not AppButton: ion-button with a colour paints its fill inside the shadow DOM, and
              tone="danger" comes out as the filled purple pill the system keeps for badges. Outline first,
              dark fill on the second tap — the two forms an irreversible action is allowed to wear. */}
          <button type="button" className={confirmingDelete ? "app-list-foot-btn app-list-foot-btn--confirm" : "app-list-foot-btn app-list-foot-btn--danger"} disabled={busy} aria-label={confirmingDelete ? `Точно удалить: ${screen.list.title}` : `Удалить список: ${screen.list.title}`} onClick={remove}>
            {confirmingDelete ? "Точно удалить?" : "Удалить список"}
          </button>
        </div>
      )}
    </section>
  );
}
