// START_MODULE_CONTRACT
// PURPOSE: Micro-events (UGC): feed section with the participants counter and the ≤30-seconds creation form ("Играем в баскетбол сегодня в 19:00 — 3/6").
// SCOPE: Data via apiClient.listMicroEvents/joinMicroEvent/leaveMicroEvent/createMicroEvent; the section shows open micro events with a join/leave toggle; the form has exactly four fields (title, when, where, limit) and resolves a picked mock place into placeId, free text into locationText; membership is client-session state until the backend owns it.
// DEPENDS: ../api/client.js (apiClient), ../api/mock.js (mockPlaces for the place datalist), ../catalog/CatalogPage.js (formatStartsAt), ../auth/AuthContext.js, ../event/EventPage.js (DEMO_USER_ID), ../routing/router.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - microWhere - locationText or the title of the picked mock place
// - MicroCard - presentational: «Микро» badge, title, when/where, «3/6» counter, join/leave button
// - MicroState - union of the section fetch states (loading / error / ready)
// - MicroSection - container: loads open micro events, wires join/leave and the create CTA
// - MicroDraft - creation form draft (title, when, where, limit)
// - microDraftReady - the four fields are filled with a positive limit
// - MicroEventCreateView - presentational four-field form with the mock-place datalist
// - MicroEventCreatePage - route container: author id, draft state, publish via createMicroEvent
// END_MODULE_MAP

import { useCallback, useEffect, useState } from "react";
import type { MicroEvent, Place } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { mockPlaces } from "../api/mock";
import { useAuth } from "../auth/AuthContext";
import { formatStartsAt } from "../catalog/CatalogPage";
import { DEMO_USER_ID } from "../event/EventPage";
import { useRoute } from "../routing/router";
import { AppButton, AppTitle } from "../ui/primitives";
import { IconButton } from "@maxhub/max-ui";

export function microWhere(item: MicroEvent): string {
  return item.locationText ?? mockPlaces.find((place) => place.id === item.placeId)?.title ?? "";
}

interface MicroCardProps {
  item: MicroEvent;
  joined: boolean;
  onJoin: () => void;
  onLeave: () => void;
}

export function MicroCard({ item, joined, onJoin, onLeave }: MicroCardProps) {
  const full = item.participantsCount >= item.participantsLimit;
  return (
    <article className="app-card">
      <div className="app-card-body">
        <span className="app-card-title">
          <span className="app-micro-badge">Микро</span> {item.title}
        </span>
        <span className="app-card-subtitle">{formatStartsAt(item.startsAt)}</span>
        <span className="app-card-subtitle">{microWhere(item)}</span>
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
  const userId = auth.status === "authenticated" ? auth.user.id : DEMO_USER_ID;
  const [state, setState] = useState<MicroState>({ status: "loading" });
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

  const update = useCallback((next: MicroEvent) => {
    setState((current) => (current.status === "ready" ? { ...current, events: current.events.map((item) => (item.id === next.id ? next : item)) } : current));
  }, []);

  const join = useCallback(
    (id: string) => {
      apiClient.joinMicroEvent(id, userId).then((next) => {
        setJoined((current) => (current.includes(id) ? current : [...current, id]));
        update(next);
      });
    },
    [userId, update],
  );

  const leave = useCallback(
    (id: string) => {
      apiClient.leaveMicroEvent(id, userId).then((next) => {
        setJoined((current) => current.filter((item) => item !== id));
        update(next);
      });
    },
    [userId, update],
  );

  return (
    <section aria-label="Микро-события">
      <div className="app-micro-head">
        <AppTitle asChild>
          <h2 className="app-today-heading">Микро-события</h2>
        </AppTitle>
        <IconButton aria-label="Создать микро-событие" size="small" variant="primary" onClick={onCreate}>
          +
        </IconButton>
      </div>
      {state.status === "loading" ? null : state.status === "error" ? <p className="app-state app-state--error">Не удалось загрузить микро-события.</p> : state.events.length === 0 ? <p className="app-state">Пока нет открытых микро-событий. Создай первое!</p> : state.events.map((item) => <MicroCard key={item.id} item={item} joined={joined.includes(item.id)} onJoin={() => join(item.id)} onLeave={() => leave(item.id)} />)}
    </section>
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
      <AppTitle asChild>
        <h2 className="app-gathering-title">Новое микро-событие</h2>
      </AppTitle>
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
      {failed && <p className="app-state app-state--error">Не удалось опубликовать микро-событие.</p>}
    </section>
  );
}

export function MicroEventCreatePage() {
  const auth = useAuth();
  const userId = auth.status === "authenticated" ? auth.user.id : DEMO_USER_ID;
  const { navigate } = useRoute();
  const [draft, setDraft] = useState<MicroDraft>({ title: "", when: "", where: "", limit: "6" });
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  const publish = useCallback(() => {
    if (!microDraftReady(draft)) return;
    setSubmitting(true);
    setFailed(false);
    const place = mockPlaces.find((item) => item.title === draft.where.trim());
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
  }, [draft, userId, navigate]);

  return <MicroEventCreateView draft={draft} places={mockPlaces} submitting={submitting} failed={failed} onChange={(field, value) => setDraft((current) => ({ ...current, [field]: value }))} onSubmit={publish} />;
}
