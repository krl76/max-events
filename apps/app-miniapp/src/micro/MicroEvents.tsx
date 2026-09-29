// START_MODULE_CONTRACT
// PURPOSE: Micro-events (UGC): feed section with the participants counter and the ≤30-seconds creation form ("Играем в баскетбол сегодня в 19:00 — 3/6").
// SCOPE: Data via apiClient.listMicroEvents/joinMicroEvent/leaveMicroEvent/createMicroEvent + listPlaces (place titles for cards and the create-form datalist); the section shows open micro events with a join/leave toggle; the form has exactly four fields (title, when, where, limit) and resolves a picked place into placeId, free text into locationText; membership is read from participantIds of the DTO, so it survives a reload, and the same reading feeds the «Микро-события» block of the calendar.
// DEPENDS: ../api/client.js (apiClient), ../catalog/CatalogPage.js (formatStartsAt), ../auth/AuthContext.js, ../routing/router.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - microWhere - locationText or the title of the picked place from the loaded places list
// - MicroCard - presentational: «Микро» badge, title, when/where, «3/6» counter, join/leave button
// - MicroState - union of the section fetch states (loading / error / ready)
// - joinedMicroEvents - open micro-events the viewer joined that have not started yet, soonest first
// - MyMicroEventsSection - «Микро-события» block of the calendar: what the viewer signed up for, with the leave action
// - MicroSection - container: loads open micro events and the places list, wires join/leave, the create CTA and the «Все» link to экран 24
// - MicroDraft - creation form draft (title, when, where, limit)
// - microDraftReady - title, when and where are filled; a limit is optional and, when set, at least 1
// - MicroEventCreateView - presentational chooser: what, when, where, who, and an optional limit
// - MicroEventCreatePage - route container: author id from the auth context, places via apiClient, draft state, publish via createMicroEvent
// END_MODULE_MAP

import { useCallback, useEffect, useState } from "react";
import type { Friend, MicroEvent, Place } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { getWebApp, shareResult } from "../max/bridge";
import { sharePayload } from "../max/links";
import { formatStartsAt } from "../catalog/CatalogPage";
import { useRoute } from "../routing/router";
import { FriendPicker } from "../ui/FriendPicker";
import { ActionIcon } from "../ui/icons";
import { PlaceSheet } from "../ui/PlaceSheet";
import { placePinTitle } from "../ui/pin-label";
import { pictured } from "../ui/photos";
import { AppIconButton, AppButton, AppMedia, AppState, AppSkeleton, AppSection } from "../ui/primitives";
import { WhenField } from "../ui/WhenField";

export function microWhere(item: MicroEvent, places: Place[]): string {
  return item.locationText ?? places.find((place) => place.id === item.placeId)?.title ?? "";
}

interface MicroCardProps {
  item: MicroEvent;
  places: Place[];
  joined: boolean;
  onJoin: () => void;
  onLeave: () => void;
  onOpen?: () => void;
}

export function MicroCard({ item, places, joined, onJoin, onLeave, onOpen }: MicroCardProps) {
  const full = item.participantsLimit !== null && item.participantsCount >= item.participantsLimit;
  const body = (
    <>
      <span className="app-card-title">
        <span className="app-micro-badge">Микро</span> {item.title}
      </span>
      <span className="app-card-subtitle">{formatStartsAt(item.startsAt)}</span>
      <span className="app-card-subtitle">{microWhere(item, places)}</span>
      <span className="app-card-subtitle">{item.participantsLimit === null ? `${item.participantsCount} · без лимита` : `${item.participantsCount}/${item.participantsLimit} участников`}</span>
    </>
  );
  return (
    <article className="app-card app-micro-plan-card">
      <AppMedia src={pictured(item.id)} className="app-micro-plan-photo" />
      {onOpen === undefined ? (
        <div className="app-card-body">{body}</div>
      ) : (
        <button type="button" className="app-card-body app-micro-plan-open" onClick={onOpen}>
          <span className="app-micro-plan-copy">{body}</span>
          <ActionIcon name="chevron" size={16} />
        </button>
      )}
      <div className="app-micro-plan-actions">
        {joined ? (
          <>
            <span className="app-card-subtitle">Вы участвуете</span>
            <AppButton size="small" tone="secondary" onClick={onLeave}>
              Выйти
            </AppButton>
          </>
        ) : (
          <AppButton disabled={full} size="small" onClick={onJoin}>
            {full ? "Мест нет" : "Присоединиться"}
          </AppButton>
        )}
      </div>
    </article>
  );
}

/**
 * What the viewer signed up for and has not attended yet. A micro-event is not a booking, so it never
 * reaches the calendar through GET /calendar; the membership list of the DTO is the whole source here.
 */
export function joinedMicroEvents(events: MicroEvent[], userId: string | null, now: Date): MicroEvent[] {
  if (userId === null) return [];
  return events.filter((item) => item.status === "open" && item.participantIds.includes(userId) && Date.parse(item.startsAt) >= now.getTime()).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

export function MyMicroEventsSection({ now = new Date() }: { now?: Date }) {
  const { navigate } = useRoute();
  const auth = useAuth();
  const userId = auth.status === "authenticated" ? auth.user.id : null;
  const [events, setEvents] = useState<MicroEvent[] | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [failed, setFailed] = useState(false);
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    let alive = true;
    apiClient.listMicroEvents().then(
      (list) => {
        if (!alive) return;
        setEvents(list);
        setFailed(false);
      },
      () => {
        // Silence here would look exactly like the bug this block exists to disprove — an empty calendar.
        if (alive) setFailed(true);
      },
    );
    return () => {
      alive = false;
    };
  }, [reloads]);

  useEffect(() => {
    let alive = true;
    apiClient.listPlaces().then(
      (list) => {
        if (alive) setPlaces(list);
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, []);

  const leave = useCallback(
    (id: string) => {
      if (userId === null) return;
      apiClient.leaveMicroEvent(id, userId).then(
        (next) => setEvents((current) => (current ?? []).map((row) => (row.id === next.id ? next : row))),
        // The backend answers 403 to someone who is not a participant, which means this view is stale:
        // reloading is the honest answer, not a card frozen mid-action.
        () => setReloads((value) => value + 1),
      );
    },
    [userId],
  );

  if (failed && events === null)
    return (
      <AppState error action={{ label: "Повторить", onClick: () => setReloads((value) => value + 1) }}>
        Не удалось загрузить микро-события.
      </AppState>
    );
  const mine = joinedMicroEvents(events ?? [], userId, now);
  // The calendar has its own empty state for bookings; an empty micro block would only add noise.
  if (mine.length === 0) return null;
  return (
    <AppSection title="Микро-события" className="app-cards-flat">
      {mine.map((item) => (
        <MicroCard key={item.id} item={item} places={places} joined onJoin={() => {}} onLeave={() => leave(item.id)} onOpen={() => navigate({ name: "micro-event", id: item.id })} />
      ))}
    </AppSection>
  );
}

export type MicroState = { status: "loading" } | { status: "error" } | { status: "ready"; events: MicroEvent[] };

export function MicroSection({ onCreate, onOpenAll }: { onCreate: () => void; onOpenAll?: () => void }) {
  const { navigate } = useRoute();
  const auth = useAuth();
  const userId = auth.status === "authenticated" ? auth.user.id : null;
  const [state, setState] = useState<MicroState>({ status: "loading" });
  const [places, setPlaces] = useState<Place[]>([]);

  const load = useCallback(() => {
    apiClient.listMicroEvents().then(
      (events) => setState({ status: "ready", events: events.filter((item) => item.status === "open") }),
      () => setState({ status: "error" }),
    );
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let alive = true;
    apiClient.listPlaces().then(
      (list) => {
        if (alive) setPlaces(list);
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, []);

  const update = useCallback((next: MicroEvent) => {
    setState((current) => (current.status === "ready" ? { ...current, events: current.events.map((item) => (item.id === next.id ? next : item)) } : current));
  }, []);

  const join = useCallback(
    (id: string) => {
      if (userId === null) return;
      // The answer carries participantIds, so membership comes back from the server and survives a reload.
      apiClient.joinMicroEvent(id, userId).then(update);
    },
    [userId, update],
  );

  const leave = useCallback(
    (id: string) => {
      if (userId === null) return;
      apiClient.leaveMicroEvent(id, userId).then(update);
    },
    [userId, update],
  );

  return (
    <AppSection
      title="Микро-события"
      className="app-cards-flat"
      action={
        <>
          {/* Секция на главной — витрина; весь список живёт на экране 24, и ссылка ведёт туда. */}
          {onOpenAll !== undefined && (
            <button type="button" className="app-micro-all" onClick={onOpenAll}>
              Все
            </button>
          )}
          <AppIconButton aria-label="Создать микро-событие" onClick={onCreate}>
            +
          </AppIconButton>
        </>
      }
    >
      {state.status === "loading" ? (
        <div className="app-card" aria-hidden="true">
          <div className="app-card-body">
            <AppSkeleton />
            <AppSkeleton variant="line-short" />
          </div>
        </div>
      ) : state.status === "error" ? (
        <AppState error action={{ label: "Повторить", onClick: load }}>
          Не удалось загрузить микро-события.
        </AppState>
      ) : state.events.length === 0 ? (
        <AppState>Пока нет открытых микро-событий. Создай первое!</AppState>
      ) : (
        state.events.map((item) => <MicroCard key={item.id} item={item} places={places} joined={userId !== null && item.participantIds.includes(userId)} onJoin={() => join(item.id)} onLeave={() => leave(item.id)} onOpen={() => navigate({ name: "micro-event", id: item.id })} />)
      )}
    </AppSection>
  );
}

export interface MicroDraft {
  title: string;
  when: string;
  where: string;
  limit: string;
}

export function microDraftReady(draft: MicroDraft): boolean {
  const limit = draft.limit.trim();
  const limitOk = limit === "" || (Number.isInteger(Number(limit)) && Number(limit) >= 1);
  return draft.title.trim() !== "" && draft.when !== "" && draft.where.trim() !== "" && limitOk;
}

interface MicroEventCreateViewProps {
  draft: MicroDraft;
  places: Place[];
  friends?: Friend[];
  inviteeIds?: string[];
  submitting: boolean;
  failed: boolean;
  onChange: (field: keyof MicroDraft, value: string) => void;
  onInvite?: (ids: string[]) => void;
  /** Opens the MAX share sheet with this draft, so people who are not in the app can still be invited. */
  onInviteMax?: () => void;
  onSubmit: () => void;
}

const LIMIT_PRESETS = ["", "6", "12"] as const;

export function MicroEventCreateView({ draft, places, friends = [], inviteeIds = [], submitting, failed, onChange, onInvite, onInviteMax, onSubmit }: MicroEventCreateViewProps) {
  const [pickingPlace, setPickingPlace] = useState(false);
  const [pickingFriends, setPickingFriends] = useState(false);
  const [ownLimit, setOwnLimit] = useState(() => !LIMIT_PRESETS.includes(draft.limit as (typeof LIMIT_PRESETS)[number]));
  const ready = microDraftReady(draft);
  const whereEmpty = draft.where.trim() === "";
  const peopleEmpty = inviteeIds.length === 0;
  const pickLimit = (value: string) => {
    setOwnLimit(false);
    onChange("limit", value);
  };
  return (
    <section className="app-micro-build" aria-label="Своя встреча">
      <p className="app-make-lead">Своя встреча. Лимит — только если он нужен.</p>
      <label className="app-choose app-choose--static">
        <span className="app-choose-k">Что делаем</span>
        <input className="app-choose-input" aria-label="Что делаем" placeholder="Баскетбол, настолки, каток" value={draft.title} onChange={(change) => onChange("title", change.target.value)} />
      </label>
      <div className="app-choose app-choose--static">
        <span className="app-choose-k">Когда</span>
        <WhenField title="Когда" label="Выбрать" value={draft.when} onChange={(value) => onChange("when", value)} />
      </div>
      <button type="button" className="app-choose" onClick={() => setPickingPlace(true)}>
        <span className="app-choose-k">Где</span>
        <span className={whereEmpty ? "app-choose-v app-choose-v--empty" : "app-choose-v"}>{whereEmpty ? "Адрес или карта" : placePinTitle(draft.where)}</span>
      </button>
      <button type="button" className="app-choose" onClick={() => setPickingFriends(true)}>
        <span className="app-choose-k">Кто</span>
        <span className={peopleEmpty ? "app-choose-v app-choose-v--empty" : "app-choose-v"}>{peopleEmpty ? "Пригласить друзей" : `Пригласить друзей · ${inviteeIds.length}`}</span>
      </button>
      <div className="app-choose-group">
        <span className="app-choose-k">Сколько человек</span>
        <div className="app-plan-repeat" role="radiogroup" aria-label="Лимит участников">
          {(
            [
              ["", "Без лимита"],
              ["6", "До 6"],
              ["12", "До 12"],
            ] as const
          ).map(([value, label]) => (
            <button key={label} type="button" role="radio" aria-checked={!ownLimit && draft.limit === value} className={!ownLimit && draft.limit === value ? "app-plan-repeat-option app-plan-repeat-option--on" : "app-plan-repeat-option"} onClick={() => pickLimit(value)}>
              {label}
            </button>
          ))}
          <button
            type="button"
            role="radio"
            aria-checked={ownLimit}
            className={ownLimit ? "app-plan-repeat-option app-plan-repeat-option--on" : "app-plan-repeat-option"}
            onClick={() => {
              setOwnLimit(true);
              if (LIMIT_PRESETS.includes(draft.limit as (typeof LIMIT_PRESETS)[number])) onChange("limit", "");
            }}
          >
            Своё число
          </button>
        </div>
        {ownLimit && <input className="app-choose-input app-choose-input--limit" aria-label="Своё число мест" inputMode="numeric" placeholder="Сколько мест" value={draft.limit} onChange={(change) => onChange("limit", change.target.value.replace(/\D/g, "").slice(0, 3))} />}
      </div>
      {onInviteMax !== undefined && (
        <button type="button" className="app-make-link" onClick={onInviteMax}>
          Пригласить в MAX
        </button>
      )}
      <button type="button" className="app-choose-go" disabled={submitting || !ready} onClick={onSubmit}>
        {submitting ? "Публикуем…" : "Создать микрособытие"}
      </button>
      {failed && <AppState error>Не удалось опубликовать микро-событие.</AppState>}
      {pickingPlace && (
        <PlaceSheet
          title="Где встречаемся"
          places={places}
          onConfirm={(choice) => {
            onChange("where", choice.label);
            setPickingPlace(false);
          }}
          onClose={() => setPickingPlace(false)}
        />
      )}
      {pickingFriends && (
        <FriendPicker
          friends={friends}
          multiple
          title="Кого звать"
          confirmLabel="Пригласить"
          onConfirm={(ids) => {
            onInvite?.(ids);
            setPickingFriends(false);
          }}
          onClose={() => setPickingFriends(false)}
        />
      )}
    </section>
  );
}

export function MicroEventCreatePage() {
  const auth = useAuth();
  const userId = auth.status === "authenticated" ? auth.user.id : null;
  const { navigate } = useRoute();
  const [draft, setDraft] = useState<MicroDraft>({ title: "", when: "", where: "", limit: "" });
  const [places, setPlaces] = useState<Place[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [inviteeIds, setInviteeIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    apiClient.listFriends().then(
      (list) => {
        if (alive) setFriends(list);
      },
      () => {},
    );
    apiClient.listPlaces().then(
      (list) => {
        if (alive) setPlaces(list);
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, []);

  const publish = useCallback(() => {
    if (!microDraftReady(draft) || userId === null) return;
    setSubmitting(true);
    setFailed(false);
    const place = places.find((item) => item.title === draft.where.trim() || item.address === draft.where.trim());
    apiClient
      .createMicroEvent({
        userId,
        title: draft.title.trim(),
        startsAt: new Date(draft.when).toISOString(),
        ...(place ? { placeId: place.id } : { locationText: draft.where.trim() }),
        ...(draft.limit.trim() === "" ? { participantsLimit: null } : { participantsLimit: Number(draft.limit) }),
        inviteeIds,
      })
      .then(
        () => navigate({ name: "home" }),
        () => {
          setSubmitting(false);
          setFailed(true);
        },
      );
  }, [draft, places, userId, navigate, inviteeIds]);

  const inviteInMax = () => {
    const sentence = [draft.title.trim() || "Микро-событие", draft.when, draft.where.trim()].filter((part) => part !== "").join(" · ");
    const payload = sharePayload(sentence, "micro");
    void shareResult(getWebApp(), payload.text, payload.link);
  };

  return <MicroEventCreateView draft={draft} places={places} friends={friends} inviteeIds={inviteeIds} submitting={submitting} failed={failed} onChange={(field, value) => setDraft((current) => ({ ...current, [field]: value }))} onInvite={setInviteeIds} onInviteMax={inviteInMax} onSubmit={publish} />;
}
