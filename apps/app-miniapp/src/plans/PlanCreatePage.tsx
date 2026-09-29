// START_MODULE_CONTRACT
// PURPOSE: «Свой план» form: the event, where and when you meet, who is invited, and how it repeats.
// SCOPE: PlanCreateView is presentational; planRecurringRule turns the two form fields into the contract rule and planRepeatLabel reads one back. PlanCreatePage loads events and friends, posts the plan and opens it. Repeating is optional: a plan without a rule is one meeting.
// DEPENDS: ../api/client.js (apiClient), @max-events/api-contracts (CreatePlanWrite, PlanRecurringRule, Event, Friend), ../routing/router.js, ../ui/primitives.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - WEEKDAY_LABELS - ru weekday names, ISO order (1=Mon)
// - nthLabels - ordinals in the gender of the chosen weekday
// - PlanRepeatMode - none | weekly | monthly
// - planRecurringRule - form fields to the contract rule, or undefined for a one-off
// - planRepeatLabel - «каждый четверг» / «первая суббота месяца» from a rule
// - PlanDraft - what the form holds
// - planDraftReady - whether the draft can be sent
// - PlanCreateView - presentational form
// - PlanCreatePage - container: loads events and friends, creates the plan, opens it
// END_MODULE_MAP

import { useCallback, useEffect, useState } from "react";
import type { Event, Friend, Place, PlanRecurringRule } from "@max-events/api-contracts";
import { moscowIsoWeekday } from "@max-events/api-contracts";
import { ApiError, apiClient } from "../api/client";
import { useRoute } from "../routing/router";
import { EventPicker } from "../ui/EventPicker";
import { FriendPicker } from "../ui/FriendPicker";
import { pictured } from "../ui/photos";
import { PlaceSheet } from "../ui/PlaceSheet";
import { placePinTitle } from "../ui/pin-label";
import { AppState } from "../ui/primitives";
import { WhenField, whenValue } from "../ui/WhenField";

/**
 * Russian needs both cases and the gender of the day: «каждую субботу» but «каждый четверг», and
 * «первая суббота» but «первый четверг». One table, so neither reading can go wrong.
 */
const WEEKDAYS = [
  { nominative: "понедельник", accusative: "понедельник", every: "каждый", nth: ["первый", "второй", "третий", "четвёртый", "последний"], nthAccusative: ["первый", "второй", "третий", "четвёртый", "последний"] },
  { nominative: "вторник", accusative: "вторник", every: "каждый", nth: ["первый", "второй", "третий", "четвёртый", "последний"], nthAccusative: ["первый", "второй", "третий", "четвёртый", "последний"] },
  { nominative: "среда", accusative: "среду", every: "каждую", nth: ["первая", "вторая", "третья", "четвёртая", "последняя"], nthAccusative: ["первую", "вторую", "третью", "четвёртую", "последнюю"] },
  { nominative: "четверг", accusative: "четверг", every: "каждый", nth: ["первый", "второй", "третий", "четвёртый", "последний"], nthAccusative: ["первый", "второй", "третий", "четвёртый", "последний"] },
  { nominative: "пятница", accusative: "пятницу", every: "каждую", nth: ["первая", "вторая", "третья", "четвёртая", "последняя"], nthAccusative: ["первую", "вторую", "третью", "четвёртую", "последнюю"] },
  { nominative: "суббота", accusative: "субботу", every: "каждую", nth: ["первая", "вторая", "третья", "четвёртая", "последняя"], nthAccusative: ["первую", "вторую", "третью", "четвёртую", "последнюю"] },
  { nominative: "воскресенье", accusative: "воскресенье", every: "каждое", nth: ["первое", "второе", "третье", "четвёртое", "последнее"], nthAccusative: ["первое", "второе", "третье", "четвёртое", "последнее"] },
] as const;

/** Chip labels: the plain name of the day. */
export const WEEKDAY_LABELS = WEEKDAYS.map((day) => day.nominative);

/** Ordinals for the monthly rule, in the gender of the chosen day. */
export function nthLabels(weekday: number): readonly string[] {
  return (WEEKDAYS[weekday - 1] ?? WEEKDAYS[0]).nth;
}

export type PlanRepeatMode = "none" | "weekly" | "monthly";

export interface PlanDraft {
  event: string;
  /** Set by the event sheet. The title alone is what a typed draft still matches. */
  eventId?: string;
  meetingPoint: string;
  meetingAt: string;
  participantIds: string[];
  repeat: PlanRepeatMode;
  weekday: number;
  nth: number;
}

/** `YYYY-MM-DDTHH:mm` from the calendar, turned into an instant the plan contract accepts. */
export function wallClockToIso(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  const date = match === null ? new Date(value) : new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6] ?? "0"));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** undefined, not null: CreatePlanWrite leaves the field out for a plan that happens once. */
export function planRecurringRule(draft: Pick<PlanDraft, "repeat" | "weekday" | "nth">): PlanRecurringRule | undefined {
  if (draft.repeat === "weekly") return { type: "weekly_weekday", weekday: draft.weekday };
  if (draft.repeat === "monthly") return { type: "monthly_nth_weekday", nth: draft.nth, weekday: draft.weekday };
  return undefined;
}

export function planRepeatLabel(rule: PlanRecurringRule | null): string | null {
  if (rule === null) return null;
  const day = WEEKDAYS[rule.weekday - 1] ?? WEEKDAYS[0];
  if (rule.type === "weekly_weekday") return `${day.every} ${day.accusative}`;
  // Accusative here too, so «Повторяется в первую субботу месяца» reads as a sentence.
  return `в ${day.nthAccusative[rule.nth - 1] ?? day.nthAccusative[0]} ${day.accusative} месяца`;
}

export function planDraftReady(draft: PlanDraft, events: Event[]): boolean {
  return missingPlanFields(draft, events).length === 0;
}

function invitedLine(ids: string[], friends: Friend[]): string {
  if (ids.length === 0) return "Пригласить друзей";
  const names = ids.flatMap((id) => {
    const friend = friends.find((item) => item.id === id);
    return friend ? [friend.name] : [];
  });
  if (names.length === 0) return `Пригласить друзей · ${ids.length}`;
  const head = names.slice(0, 2).join(", ");
  return names.length > 2 ? `${head} · ${names.length}` : head;
}

export function missingPlanFields(draft: PlanDraft, events: Event[]): string[] {
  const missing: string[] = [];
  const chosen = draft.eventId !== undefined ? events.some((event) => event.id === draft.eventId) : events.some((event) => event.title === draft.event.trim());
  if (!chosen) missing.push("Выберите событие из списка");
  if (draft.meetingPoint.trim() === "") missing.push("Укажите, где встречаемся");
  if (draft.meetingAt === "" || Number.isNaN(new Date(draft.meetingAt).getTime())) missing.push("Укажите, когда встречаемся");
  return missing;
}

interface PlanCreateViewProps {
  draft: PlanDraft;
  events: Event[];
  places: Place[];
  friends: Friend[];
  submitting?: boolean;
  failed?: boolean;
  failText?: string;
  eventsFailed?: boolean;
  onRetryEvents?: () => void;
  onDraft: (patch: Partial<PlanDraft>) => void;
  onToggleFriend: (friendId: string) => void;
  onSubmit: () => void;
}

export function PlanCreateView({ draft, events, places, friends, submitting = false, failed = false, failText, eventsFailed = false, onRetryEvents, onDraft, onToggleFriend, onSubmit }: PlanCreateViewProps) {
  const rule = planRecurringRule(draft);
  const [pickingFriends, setPickingFriends] = useState(false);
  const [pickingPlace, setPickingPlace] = useState(false);
  const [pickingEvent, setPickingEvent] = useState(false);
  const chosen = draft.eventId === undefined ? events.find((event) => event.title === draft.event.trim()) : events.find((event) => event.id === draft.eventId);
  const placeEmpty = draft.meetingPoint.trim() === "";
  const peopleEmpty = draft.participantIds.length === 0;
  return (
    <section className="app-plan-build" aria-label="Свой план">
      <p className="app-make-lead">Событие из афиши. Время и место встречи.</p>
      <button type="button" className={chosen ? "app-choose app-choose--cover" : "app-choose"} style={chosen ? { backgroundImage: `url("${pictured(chosen.id, chosen.coverUrl)}")` } : undefined} onClick={() => setPickingEvent(true)}>
        {chosen ? (
          <span className="app-choose-veil">
            <span className="app-choose-k">Событие</span>
            <span className="app-choose-v">{draft.event}</span>
          </span>
        ) : (
          <>
            <span className="app-choose-k">Событие</span>
            <span className={draft.event.trim() === "" ? "app-choose-v app-choose-v--empty" : "app-choose-v"}>{draft.event.trim() === "" ? "Выбрать из афиши" : draft.event}</span>
          </>
        )}
      </button>
      {eventsFailed && (
        <button type="button" className="app-field-hint" onClick={onRetryEvents}>
          Афиша не загрузилась. Нажмите, чтобы повторить.
        </button>
      )}
      <div className="app-choose app-choose--static">
        <span className="app-choose-k">Когда встречаемся</span>
        <WhenField title="Когда встречаемся" label="Выбрать" value={draft.meetingAt} onChange={(meetingAt) => onDraft({ meetingAt })} />
      </div>
      <button type="button" className="app-choose" onClick={() => setPickingPlace(true)}>
        <span className="app-choose-k">Где встречаемся</span>
        <span className={placeEmpty ? "app-choose-v app-choose-v--empty" : "app-choose-v"}>{placeEmpty ? "Адрес или карта" : placePinTitle(draft.meetingPoint)}</span>
      </button>
      <button type="button" className="app-choose" onClick={() => setPickingFriends(true)}>
        <span className="app-choose-k">Кто</span>
        <span className={peopleEmpty ? "app-choose-v app-choose-v--empty" : "app-choose-v"}>{invitedLine(draft.participantIds, friends)}</span>
      </button>
      {pickingFriends && (
        <FriendPicker
          friends={friends}
          multiple
          title="Кого зовём"
          confirmLabel="Пригласить"
          onConfirm={(ids) => {
            const next = new Set(ids);
            for (const id of draft.participantIds) if (!next.has(id)) onToggleFriend(id);
            for (const id of ids) if (!draft.participantIds.includes(id)) onToggleFriend(id);
            setPickingFriends(false);
          }}
          onClose={() => setPickingFriends(false)}
        />
      )}
      {pickingEvent && (
        <EventPicker
          title="Событие плана"
          events={events}
          selectedId={draft.eventId ?? null}
          onPick={(event) => {
            onDraft({ event: event.title, eventId: event.id, ...(draft.meetingAt === "" ? { meetingAt: whenValue(new Date(event.startsAt)) } : {}) });
            setPickingEvent(false);
          }}
          onClose={() => setPickingEvent(false)}
        />
      )}
      {pickingPlace && (
        <PlaceSheet
          title="Где встречаемся"
          places={places}
          onConfirm={(choice) => {
            onDraft({ meetingPoint: choice.label });
            setPickingPlace(false);
          }}
          onClose={() => setPickingPlace(false)}
        />
      )}
      <div className="app-choose-group">
        <span className="app-choose-k">Как часто</span>
        <div className="app-plan-repeat" role="radiogroup" aria-label="Повторение">
          {(
            [
              ["none", "Один раз"],
              ["weekly", "Каждую неделю"],
              ["monthly", "Раз в месяц"],
            ] as const
          ).map(([mode, label]) => (
            <button key={mode} type="button" role="radio" aria-checked={draft.repeat === mode} className={draft.repeat === mode ? "app-plan-repeat-option app-plan-repeat-option--on" : "app-plan-repeat-option"} onClick={() => onDraft({ repeat: mode })}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {draft.repeat !== "none" && rule !== undefined && <p className="app-plan-repeat-line">Повторяется {planRepeatLabel(rule)}, в то же время</p>}
      <button type="button" className="app-choose-go" disabled={submitting} onClick={onSubmit}>
        {submitting ? "Создаём…" : "Создать план"}
      </button>
      {failed && <AppState error>{failText ?? "Не удалось создать план."}</AppState>}
    </section>
  );
}

export function PlanCreatePage() {
  const { navigate } = useRoute();
  const [draft, setDraft] = useState<PlanDraft>({ event: "", meetingPoint: "", meetingAt: "", participantIds: [], repeat: "none", weekday: 4, nth: 1 });
  const [events, setEvents] = useState<Event[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [failText, setFailText] = useState<string | undefined>(undefined);
  const [eventsFailed, setEventsFailed] = useState(false);
  const [eventReload, setEventReload] = useState(0);

  useEffect(() => {
    let alive = true;
    apiClient.listEvents().then(
      (list) => {
        if (!alive) return;
        setEvents(list);
        setEventsFailed(false);
      },
      () => {
        if (alive) setEventsFailed(true);
      },
    );
    apiClient.listPlaces().then(
      (list) => {
        if (alive) setPlaces(list);
      },
      () => {},
    );
    apiClient.listFriends().then(
      (list) => {
        if (alive) setFriends(list);
      },
      // An empty friend graph is the normal case in production, not an error worth a red line here.
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [eventReload]);

  const submit = useCallback(() => {
    const event = (draft.eventId === undefined ? undefined : events.find((item) => item.id === draft.eventId)) ?? events.find((item) => item.title === draft.event.trim());
    const meetingAt = wallClockToIso(draft.meetingAt);
    if (!event || meetingAt === null || !planDraftReady(draft, events)) {
      setFailed(true);
      setFailText("Проверьте событие, место и время.");
      return;
    }
    setSubmitting(true);
    setFailed(false);
    setFailText(undefined);
    apiClient
      .createPlan({
        eventId: event.id,
        participantIds: draft.participantIds,
        meetingPoint: draft.meetingPoint.trim(),
        meetingAt,
        ...(planRecurringRule(draft) === undefined ? {} : { recurringRule: planRecurringRule(draft)! }),
      })
      .then(
        (card) => navigate({ name: "plan", id: card.plan.id }),
        (error: unknown) => {
          setSubmitting(false);
          setFailed(true);
          setFailText(error instanceof ApiError && error.status === 404 ? "Этого события уже нет в афише." : "Не удалось создать план.");
        },
      );
  }, [draft, events, navigate]);

  return (
    <PlanCreateView
      draft={draft}
      events={events}
      places={places}
      friends={friends}
      submitting={submitting}
      failed={failed}
      failText={failText}
      eventsFailed={eventsFailed}
      onRetryEvents={() => setEventReload((value) => value + 1)}
      onDraft={(patch) =>
        setDraft((current) => {
          const next = { ...current, ...patch };
          // The repeat follows the meeting: choosing Saturday and pressing «каждую неделю» must not
          // quietly repeat on the default Thursday.
          if (patch.meetingAt !== undefined && !Number.isNaN(new Date(patch.meetingAt).getTime())) {
            const at = new Date(patch.meetingAt);
            next.weekday = moscowIsoWeekday(at);
            next.nth = Math.min(5, Math.ceil(at.getDate() / 7));
          }
          return next;
        })
      }
      onToggleFriend={(friendId) => setDraft((current) => ({ ...current, participantIds: current.participantIds.includes(friendId) ? current.participantIds.filter((id) => id !== friendId) : [...current.participantIds, friendId] }))}
      onSubmit={submit}
    />
  );
}
