// START_MODULE_CONTRACT
// PURPOSE: Экран 25 «Микро-событие · карточка»: who is going by name, the free-seat line and the four states of a gathering — можно присоединиться, ты в деле, мест нет, отменено.
// SCOPE: Data via apiClient.getMicroEventCard (event + venue + participants by name), join/leave via joinMicroEvent/leaveMicroEvent; the venue row opens экран 34 when the gathering points at a place, free text stays text. Exactly one of locationText/placeId is set — the contract refuses anything else — so the row never has to choose between two sources.
// DEPENDS: ../api/client.js (apiClient, MicroEventCard), ../auth/AuthContext.js, ../friends/avatar.js, ../routing/router.js, ../ui/icons.js, ../ui/primitives.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - microWhenLabel - «Сегодня в 19:00» / «Завтра в 19:00» / «19 сентября в 19:00»
// - microWhereLabel - venue title of the card, or the free-text location the author typed
// - microSeatsHint - «Свободных мест четыре. Когда их не останется, кнопка сменится на «Мест нет».»; null when there are none left
// - MicroEventState - union of the card fetch states (loading / error / ready)
// - MicroEventView - presentational экран 25: topbar, title, when/where, the participant list with «позвал», the hint and the state action
// - MicroEventPage - route container: loads the card, wires join/leave and the venue navigation
// END_MODULE_MAP

import { useCallback, useEffect, useState } from "react";
import { ApiError, apiClient, type MicroEventCard } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { PersonAvatar } from "../friends/avatar";
import { microCtaState, microTime } from "./MicroEventsPage";
import { useRoute } from "../routing/router";
import { ActionIcon } from "../ui/icons";
import { AppSkeletonList, AppState } from "../ui/primitives";

const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function microWhenLabel(startsAt: string, now: Date = new Date()): string {
  const start = new Date(startsAt);
  const time = microTime(startsAt);
  if (dayKey(start) === dayKey(now)) return `Сегодня в ${time}`;
  if (dayKey(start) === dayKey(new Date(now.getTime() + DAY_MS))) return `Завтра в ${time}`;
  return `${start.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })} в ${time}`;
}

export function microWhereLabel(card: MicroEventCard): string {
  return card.place?.title ?? card.event.locationText ?? "";
}

/** The design writes the number out; past ten the word stops helping and the digit is clearer. */
const SPELLED_SEATS: Record<number, string> = { 2: "два", 3: "три", 4: "четыре", 5: "пять", 6: "шесть", 7: "семь", 8: "восемь", 9: "девять", 10: "десять" };

export function microSeatsHint(free: number): string | null {
  if (free <= 0) return null;
  if (free === 1) return "Свободное место одно. Когда его займут, кнопка сменится на «Мест нет».";
  return `Свободных мест ${SPELLED_SEATS[free] ?? free}. Когда их не останется, кнопка сменится на «Мест нет».`;
}

export type MicroEventState = { status: "loading" } | { status: "error"; notFound: boolean } | { status: "ready"; card: MicroEventCard };

/** A venue-backed gathering opens экран 34; an address typed by hand has nothing to open and stays text. */
function PlaceRow({ card, onOpenPlace }: { card: MicroEventCard; onOpenPlace: (placeId: string) => void }) {
  const place = card.place;
  if (place === null)
    return (
      <span className="app-micro-meta-row">
        <ActionIcon name="pin" size={20} strokeWidth={2.2} />
        {microWhereLabel(card)}
      </span>
    );
  return (
    <button type="button" className="app-micro-meta-row app-micro-meta-row--link" onClick={() => onOpenPlace(place.id)}>
      <ActionIcon name="pin" size={20} strokeWidth={2.2} />
      {microWhereLabel(card)}
    </button>
  );
}

interface MicroEventViewProps {
  state: MicroEventState;
  viewerId: string | null;
  busy?: boolean;
  now?: Date;
  onBack: () => void;
  onOpenPlace: (placeId: string) => void;
  onJoin: () => void;
  onLeave: () => void;
  onRetry: () => void;
}

export function MicroEventView({ state, viewerId, busy = false, now = new Date(), onBack, onOpenPlace, onJoin, onLeave, onRetry }: MicroEventViewProps) {
  const card = state.status === "ready" ? state.card : null;
  const joined = card !== null && viewerId !== null && card.event.participantIds.includes(viewerId);
  const cta = card === null ? null : microCtaState(card.event, joined);
  const free = card === null ? 0 : card.event.participantsLimit - card.event.participantsCount;
  const hint = cta === "join" || cta === "joined" ? microSeatsHint(free) : null;
  const filled = card === null || card.event.participantsLimit === 0 ? 0 : Math.round((card.event.participantsCount / card.event.participantsLimit) * 100);

  return (
    <section className="app-micro-card">
      <div className="app-micro-topbar">
        <button type="button" className="app-micro-back" aria-label="Назад" onClick={onBack}>
          <ActionIcon name="chevron" size={20} strokeWidth={2.4} />
        </button>
        <h1 className="app-micro-topbar-title">Микро-событие</h1>
      </div>
      {state.status === "loading" && <AppSkeletonList rows={3} />}
      {state.status === "error" && (
        <AppState error action={state.notFound ? undefined : { label: "Повторить", onClick: onRetry }}>
          {state.notFound ? "Такого сбора больше нет." : "Не удалось загрузить сбор."}
        </AppState>
      )}
      {card !== null && (
        <>
          <h2 className="app-micro-card-title">{card.event.title}</h2>
          <div className="app-micro-meta">
            <span className="app-micro-meta-row">
              <ActionIcon name="clock" size={20} strokeWidth={2.2} />
              {microWhenLabel(card.event.startsAt, now)}
            </span>
            <PlaceRow card={card} onOpenPlace={onOpenPlace} />
          </div>
          <div className="app-micro-who">
            <h3 className="app-micro-who-title">Кто идёт</h3>
            <span className="app-micro-who-count">
              {card.event.participantsCount} из {card.event.participantsLimit}
            </span>
          </div>
          <div className="app-micro-gauge" role="img" aria-label={`Занято ${card.event.participantsCount} из ${card.event.participantsLimit}`}>
            <span className="app-micro-gauge-fill" style={{ width: `${filled}%` }} />
          </div>
          <ul className="app-micro-people">
            {card.participants.map((participant) => (
              <li key={participant.friend.id} className="app-micro-person">
                <PersonAvatar id={participant.friend.id} name={participant.friend.name} size={36} />
                <span className="app-micro-person-name">{participant.friend.name}</span>
                {participant.author && <span className="app-micro-person-role">позвал</span>}
              </li>
            ))}
          </ul>
          {hint !== null && (
            <p className="app-micro-hint">
              <ActionIcon name="alert" size={18} strokeWidth={2.4} />
              {hint}
            </p>
          )}
          <div className="app-micro-actions">
            {cta === "join" && (
              <button type="button" className="app-micro-act app-micro-act--go" disabled={busy} onClick={onJoin}>
                <ActionIcon name="check" size={18} strokeWidth={2.8} />
                Иду
              </button>
            )}
            {cta === "joined" && (
              <>
                {/* «Ты в деле» — это состояние, а не кнопка: действие здесь одно, и это «Выйти». */}
                <span className="app-micro-act app-micro-act--in">
                  <ActionIcon name="check" size={18} strokeWidth={2.8} />
                  Ты в деле
                </span>
                <button type="button" className="app-micro-act app-micro-act--leave" disabled={busy} onClick={onLeave}>
                  Выйти
                </button>
              </>
            )}
            {cta === "full" && <span className="app-micro-act app-micro-act--closed">Мест нет</span>}
            {cta === "cancelled" && <span className="app-micro-act app-micro-act--closed">Сбор отменён автором</span>}
          </div>
        </>
      )}
    </section>
  );
}

export function MicroEventPage({ id }: { id: string }) {
  const auth = useAuth();
  const viewerId = auth.status === "authenticated" ? auth.user.id : null;
  const { navigate, back } = useRoute();
  const [state, setState] = useState<MicroEventState>({ status: "loading" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setState({ status: "loading" });
    apiClient.getMicroEventCard(id).then(
      (card) => setState({ status: "ready", card }),
      (error: unknown) => setState({ status: "error", notFound: error instanceof ApiError && error.status === 404 }),
    );
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  const act = useCallback(
    (run: Promise<unknown>) => {
      setBusy(true);
      // The answer of join/leave is the event alone; the card is reloaded so the participant names come with it.
      run.then(
        () => {
          setBusy(false);
          load();
        },
        () => {
          setBusy(false);
          load();
        },
      );
    },
    [load],
  );

  return <MicroEventView state={state} viewerId={viewerId} busy={busy} onBack={back} onOpenPlace={(placeId) => navigate({ name: "place", id: placeId })} onJoin={() => viewerId !== null && act(apiClient.joinMicroEvent(id, viewerId))} onLeave={() => viewerId !== null && act(apiClient.leaveMicroEvent(id, viewerId))} onRetry={load} />;
}
