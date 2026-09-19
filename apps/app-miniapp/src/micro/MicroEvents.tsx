// START_MODULE_CONTRACT
// PURPOSE: Micro-events (UGC): feed section with the participants counter and the ≤30-seconds creation form ("Играем в баскетбол сегодня в 19:00 — 3/6").
// SCOPE: Data via apiClient.listMicroEvents/joinMicroEvent/leaveMicroEvent/createMicroEvent + listPlaces (place titles for cards and the create-form datalist); the section shows open micro events with a join/leave toggle; the form has exactly four fields (title, when, where, limit) and resolves a picked place into placeId, free text into locationText; membership is client-session state until the backend owns it.
// DEPENDS: ../api/client.js (apiClient), ../catalog/CatalogPage.js (formatStartsAt), ../auth/AuthContext.js, ../routing/router.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - microWhere - locationText or the title of the picked place from the loaded places list
// - MicroCard - presentational: «Микро» badge, title, when/where, «3/6» counter, join/leave button
// - MicroState - union of the section fetch states (loading / error / ready)
// - MicroSection - container: loads open micro events and the places list, wires join/leave and the create CTA
// - MicroDraft - creation form draft (title, when, where, limit)
// - microDraftReady - the four fields are filled with a positive limit
// - MicroEventCreateView - presentational four-field form with the place datalist
// - MicroEventCreatePage - route container: author id from the auth context, places via apiClient, draft state, publish via createMicroEvent
// END_MODULE_MAP

import { useCallback, useEffect, useState } from "react";
import type { MicroEvent, Place } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { formatStartsAt } from "../catalog/CatalogPage";
import { useRoute } from "../routing/router";
import { AppButton, AppState, AppSkeleton, AppSection } from "../ui/primitives";
import { IconButton } from "@maxhub/max-ui";

export function microWhere(item: MicroEvent, places: Place[]): string {
  return item.locationText ?? places.find((place) => place.id === item.placeId)?.title ?? "";
}

interface MicroCardProps {
  item: MicroEvent;
  places: Place[];
  joined: boolean;
  onJoin: () => void;
  onLeave: () => void;
}

export function MicroCard({ item, places, joined, onJoin, onLeave }: MicroCardProps) {
  const full = item.participantsCount >= item.participantsLimit;
  return (
    <article className="app-card">
      <div className="app-card-body">
        <span className="app-card-title">
          <span className="app-micro-badge">Микро</span> {item.title}
        </span>
        <span className="app-card-subtitle">{formatStartsAt(item.startsAt)}</span>
        <span className="app-card-subtitle">{microWhere(item, places)}</span>
        <span className="app-card-subtitle">
          {item.participantsCount}/{item.participantsLimit} участников
        </span>
        {joined ? (
          <AppButton size="small" tone="secondary" onClick={onLeave}>
            Вы участвуете
          </AppButton>
        ) : (
          <AppButton disabled={full} size="small" onClick={onJoin}>
            {full ? "Мест нет" : "Присоединиться"}
          </AppButton>
        )}
      </div>
    </article>
  );
}

export type MicroState = { status: "loading" } | { status: "error" } | { status: "ready"; events: MicroEvent[] };

export function MicroSection({ onCreate }: { onCreate: () => void }) {
  const auth = useAuth();
  const userId = auth.status === "authenticated" ? auth.user.id : null;
  const [state, setState] = useState<MicroState>({ status: "loading" });
  const [places, setPlaces] = useState<Place[]>([]);
  const [joined, setJoined] = useState<string[]>([]);

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
      apiClient.joinMicroEvent(id, userId).then((next) => {
        setJoined((current) => (current.includes(id) ? current : [...current, id]));
        update(next);
      });
    },
    [userId, update],
  );

  const leave = useCallback(
    (id: string) => {
      if (userId === null) return;
      apiClient.leaveMicroEvent(id, userId).then((next) => {
        setJoined((current) => current.filter((item) => item !== id));
        update(next);
      });
    },
    [userId, update],
  );

  return (
    <AppSection
      title="Микро-события"
      className="app-cards-flat"
      action={
        <IconButton aria-label="Создать микро-событие" size="small" variant="primary" onClick={onCreate}>
          +
        </IconButton>
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
        state.events.map((item) => <MicroCard key={item.id} item={item} places={places} joined={joined.includes(item.id)} onJoin={() => join(item.id)} onLeave={() => leave(item.id)} />)
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
  return draft.title.trim() !== "" && draft.when !== "" && draft.where.trim() !== "" && Number(draft.limit) >= 1;
}

interface MicroEventCreateViewProps {
  draft: MicroDraft;
  places: Place[];
  submitting: boolean;
  failed: boolean;
  onChange: (field: keyof MicroDraft, value: string) => void;
  onSubmit: () => void;
}

export function MicroEventCreateView({ draft, places, submitting, failed, onChange, onSubmit }: MicroEventCreateViewProps) {
  return (
    <section className="app-gathering">
      <p className="app-gathering-hint">Четыре поля — и событие в ленте</p>
      <label className="app-gathering-time">
        Что делаем
        <input className="app-gathering-time-input" value={draft.title} placeholder="Играем в баскетбол" onChange={(change) => onChange("title", change.target.value)} />
      </label>
      <label className="app-gathering-time">
        Когда
        <input className="app-gathering-time-input" type="datetime-local" value={draft.when} onChange={(change) => onChange("when", change.target.value)} />
      </label>
      <label className="app-gathering-time">
        Где
        <input className="app-gathering-time-input" list="micro-place-options" value={draft.where} placeholder="Площадка или место" onChange={(change) => onChange("where", change.target.value)} />
        <datalist id="micro-place-options">
          {places.map((place) => (
            <option key={place.id} value={place.title} />
          ))}
        </datalist>
      </label>
      <label className="app-gathering-time">
        Лимит участников
        <input className="app-gathering-time-input" type="number" min={1} value={draft.limit} onChange={(change) => onChange("limit", change.target.value)} />
      </label>
      <AppButton disabled={!microDraftReady(draft) || submitting} onClick={onSubmit} stretched>
        {submitting ? "Публикуем…" : "Опубликовать"}
      </AppButton>
      {failed && <AppState error>Не удалось опубликовать микро-событие.</AppState>}
    </section>
  );
}

export function MicroEventCreatePage() {
  const auth = useAuth();
  const userId = auth.status === "authenticated" ? auth.user.id : null;
  const { navigate } = useRoute();
  const [draft, setDraft] = useState<MicroDraft>({ title: "", when: "", where: "", limit: "6" });
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
    const place = places.find((item) => item.title === draft.where.trim());
    apiClient
      .createMicroEvent({
        userId,
        title: draft.title.trim(),
        startsAt: new Date(draft.when).toISOString(),
        ...(place ? { placeId: place.id } : { locationText: draft.where.trim() }),
        participantsLimit: Number(draft.limit),
      })
      .then(
        () => navigate({ name: "home" }),
        () => {
          setSubmitting(false);
          setFailed(true);
        },
      );
  }, [draft, places, userId, navigate]);

  return <MicroEventCreateView draft={draft} places={places} submitting={submitting} failed={failed} onChange={(field, value) => setDraft((current) => ({ ...current, [field]: value }))} onSubmit={publish} />;
}
