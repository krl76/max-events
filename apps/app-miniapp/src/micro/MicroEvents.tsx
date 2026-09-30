// START_MODULE_CONTRACT
// PURPOSE: Micro-events (UGC): feed section with the participants counter and the ≤30-seconds creation form ("Играем в баскетбол сегодня в 19:00 — 3/6").
// SCOPE: Data via apiClient.listMicroEvents/joinMicroEvent/leaveMicroEvent/createMicroEvent + listPlaces (place titles for cards and the create-form datalist); the section shows open micro events with a join/leave toggle; the form collects title, when, where, an optional note, an optional limit and whether the gathering is listed, and resolves a picked place into placeId, free text into locationText; membership is read from participantIds of the DTO, so it survives a reload, and the same reading feeds the «Микро-события» block of the calendar.
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
// - MicroDraft - creation form draft (title, when, where, note, limit, listed)
// - microDraftReady - title, when and where are filled; a limit is optional and, when set, at least 1
// - MicroEventCreateView - presentational form: name, when, where, note, optional limit, public listing
// - MicroEventCreatePage - route container: author id from the auth context, places via apiClient, draft state, publish via createMicroEvent
// END_MODULE_MAP

import { useCallback, useEffect, useState } from "react";
import type { MicroEvent, Place } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { formatStartsAt } from "../catalog/CatalogPage";
import { useRoute } from "../routing/router";
import { ActionIcon } from "../ui/icons";
import { PlaceModeButtons, PlaceSheet } from "../ui/PlaceSheet";
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
  description: string;
  listed: boolean;
}

const LIMIT_PRESETS = [6, 12] as const;

function limitCount(limit: string): number {
  const parsed = Number(limit);
  return Number.isInteger(parsed) && parsed >= 1 ? Math.min(999, parsed) : 10;
}

export function microDraftReady(draft: MicroDraft): boolean {
  const limit = draft.limit.trim();
  const limitOk = limit === "" || (Number.isInteger(Number(limit)) && Number(limit) >= 1);
  return draft.title.trim() !== "" && draft.when !== "" && draft.where.trim() !== "" && limitOk;
}

interface MicroEventCreateViewProps {
  draft: MicroDraft;
  places: Place[];
  submitting: boolean;
  failed: boolean;
  onChange: (field: keyof MicroDraft, value: string | boolean) => void;
  onSubmit: () => void;
}

export function MicroEventCreateView({ draft, places, submitting, failed, onChange, onSubmit }: MicroEventCreateViewProps) {
  const [placeMode, setPlaceMode] = useState<"address" | "map" | null>(null);
  const ready = microDraftReady(draft);
  const whereEmpty = draft.where.trim() === "";
  const limited = draft.limit.trim() !== "";
  const count = limitCount(draft.limit);
  return (
    <section className="app-micro-build" aria-label="Новое событие">
      <p className="app-make-lead">Запланируйте встречу. Лимит — по желанию.</p>
      <label className="app-field">
        <span className="app-field-copy">
          <span className="app-field-k">
            <ActionIcon name="pen" size={16} strokeWidth={2.2} />
            Название события
          </span>
          <input className="app-field-input" aria-label="Название события" placeholder="Баскетбол в парке" value={draft.title} onChange={(change) => onChange("title", change.target.value)} />
        </span>
      </label>
      <div className="app-field">
        <span className="app-field-copy">
          <span className="app-field-k">
            <ActionIcon name="calendar" size={16} strokeWidth={2.2} />
            Дата и время
          </span>
          <WhenField title="Дата и время" label="Выбрать" value={draft.when} onChange={(value) => onChange("when", value)} />
        </span>
      </div>
      <div className="app-field">
        <span className="app-field-copy">
          <span className="app-field-k">
            <ActionIcon name="pin" size={16} strokeWidth={2.2} />
            Место проведения
          </span>
          <span className={whereEmpty ? "app-field-v app-field-v--empty" : "app-field-v"}>{whereEmpty ? "Выбрать" : placePinTitle(draft.where)}</span>
        </span>
        <PlaceModeButtons onPick={setPlaceMode} />
      </div>
      <label className="app-field app-field--tall">
        <span className="app-field-copy">
          <span className="app-field-k">
            <ActionIcon name="lines" size={16} strokeWidth={2.2} />
            Описание
          </span>
          <textarea className="app-field-text" aria-label="Описание" placeholder="Дополнительная информация" rows={3} maxLength={2000} value={draft.description} onChange={(change) => onChange("description", change.target.value)} />
        </span>
      </label>
      <div className="app-switch-row">
        <span className="app-switch-name">Ограничить участников</span>
        <button type="button" role="switch" aria-checked={limited} aria-label="Ограничить участников" className={limited ? "app-switch app-switch--on" : "app-switch"} onClick={() => onChange("limit", limited ? "" : String(count))}>
          <span className="app-switch-knob" />
        </button>
      </div>
      {limited && (
        <div className="app-limit">
          <div className="app-stepper">
            <button type="button" className="app-stepper-btn" aria-label="Меньше" onClick={() => onChange("limit", String(Math.max(1, count - 1)))}>
              <ActionIcon name="minus" size={18} strokeWidth={2.4} />
            </button>
            <span className="app-stepper-n">{count}</span>
            <button type="button" className="app-stepper-btn" aria-label="Больше" onClick={() => onChange("limit", String(Math.min(999, count + 1)))}>
              <ActionIcon name="plus" size={18} strokeWidth={2.4} />
            </button>
          </div>
          {LIMIT_PRESETS.map((preset) => (
            <button key={preset} type="button" className={count === preset ? "app-limit-chip app-limit-chip--on" : "app-limit-chip"} aria-pressed={count === preset} onClick={() => onChange("limit", String(preset))}>
              {preset}
            </button>
          ))}
        </div>
      )}
      <div className="app-switch-row">
        <span className="app-switch-copy">
          <span className="app-switch-name">Сделать публичным в MAX</span>
          <span className="app-switch-sub">Видно всем в ленте</span>
        </span>
        <button type="button" role="switch" aria-checked={draft.listed} aria-label="Сделать публичным в MAX" className={draft.listed ? "app-switch app-switch--on" : "app-switch"} onClick={() => onChange("listed", !draft.listed)}>
          <span className="app-switch-knob" />
        </button>
      </div>
      <button type="button" className="app-choose-go" disabled={submitting || !ready} onClick={onSubmit}>
        {submitting ? "Создаём…" : "Создать событие"}
      </button>
      {failed && <AppState error>Не удалось опубликовать микро-событие.</AppState>}
      {placeMode !== null && (
        <PlaceSheet
          title="Место проведения"
          mode={placeMode}
          places={places}
          onConfirm={(choice) => {
            onChange("where", choice.label);
            setPlaceMode(null);
          }}
          onClose={() => setPlaceMode(null)}
        />
      )}
    </section>
  );
}

export function MicroEventCreatePage() {
  const auth = useAuth();
  const userId = auth.status === "authenticated" ? auth.user.id : null;
  const { navigate } = useRoute();
  const [draft, setDraft] = useState<MicroDraft>({ title: "", when: "", where: "", limit: "", description: "", listed: false });
  const [places, setPlaces] = useState<Place[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

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
        ...(draft.description.trim() === "" ? {} : { description: draft.description.trim() }),
        listed: draft.listed,
        ...(draft.limit.trim() === "" ? { participantsLimit: null } : { participantsLimit: Number(draft.limit) }),
      })
      .then(
        (created) => navigate({ name: "micro-event", id: created.id }),
        () => {
          setSubmitting(false);
          setFailed(true);
        },
      );
  }, [draft, places, userId, navigate]);

  return (
    <MicroEventCreateView
      draft={draft}
      places={places}
      submitting={submitting}
      failed={failed}
      onChange={(field, value) =>
        setDraft((current) => {
          if (field === "listed") return { ...current, listed: value === true };
          return { ...current, [field]: String(value) };
        })
      }
      onSubmit={publish}
    />
  );
}
