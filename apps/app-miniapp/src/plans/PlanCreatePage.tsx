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
import type { Event, Friend, PlanRecurringRule } from "@max-events/api-contracts";
import { moscowIsoWeekday } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { useRoute } from "../routing/router";
import { AppButton, AppChip, AppState, AppTitle } from "../ui/primitives";

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
  meetingPoint: string;
  meetingAt: string;
  participantIds: string[];
  repeat: PlanRepeatMode;
  weekday: number;
  nth: number;
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
  // Not just "non-empty": where datetime-local degrades to a text field, «19.09 вечером» would reach
  // toISOString and throw before the request was made, leaving the button stuck on «Создаём…».
  return events.some((event) => event.title === draft.event.trim()) && draft.meetingPoint.trim() !== "" && draft.meetingAt !== "" && !Number.isNaN(new Date(draft.meetingAt).getTime());
}

interface PlanCreateViewProps {
  draft: PlanDraft;
  events: Event[];
  friends: Friend[];
  submitting?: boolean;
  failed?: boolean;
  onDraft: (patch: Partial<PlanDraft>) => void;
  onToggleFriend: (friendId: string) => void;
  onSubmit: () => void;
}

export function PlanCreateView({ draft, events, friends, submitting = false, failed = false, onDraft, onToggleFriend, onSubmit }: PlanCreateViewProps) {
  const rule = planRecurringRule(draft);
  return (
    <section className="app-gathering">
      <AppTitle asChild>
        <h2 className="app-section-title">Свой план</h2>
      </AppTitle>
      <label className="app-gathering-time">
        Событие
        <input className="app-gathering-time-input" list="plan-event-options" value={draft.event} placeholder="Событие" onChange={(change) => onDraft({ event: change.target.value })} />
        <datalist id="plan-event-options">
          {events.map((event) => (
            <option key={event.id} value={event.title} />
          ))}
        </datalist>
      </label>
      <label className="app-gathering-time">
        Где встречаемся
        <input className="app-gathering-time-input" value={draft.meetingPoint} placeholder="Например, у метро" onChange={(change) => onDraft({ meetingPoint: change.target.value })} />
      </label>
      <label className="app-gathering-time">
        Когда встречаемся
        <input className="app-gathering-time-input" type="datetime-local" value={draft.meetingAt} onChange={(change) => onDraft({ meetingAt: change.target.value })} />
      </label>
      {friends.length > 0 && (
        <div className="app-gathering-friends" role="group" aria-label="Кого зовём">
          {friends.map((friend) => (
            <button key={friend.id} type="button" className="app-gathering-friend" aria-pressed={draft.participantIds.includes(friend.id)} onClick={() => onToggleFriend(friend.id)}>
              <span className="app-gathering-friend-name">{friend.name}</span>
            </button>
          ))}
        </div>
      )}
      <div className="app-filters-chips" role="group" aria-label="Повторение">
        <AppChip pressed={draft.repeat === "none"} onClick={() => onDraft({ repeat: "none" })}>
          Один раз
        </AppChip>
        <AppChip pressed={draft.repeat === "weekly"} onClick={() => onDraft({ repeat: "weekly" })}>
          Каждую неделю
        </AppChip>
        <AppChip pressed={draft.repeat === "monthly"} onClick={() => onDraft({ repeat: "monthly" })}>
          Раз в месяц
        </AppChip>
      </div>
      {draft.repeat !== "none" && (
        <>
          {draft.repeat === "monthly" && (
            <div className="app-filters-chips" role="group" aria-label="Какая неделя месяца">
              {nthLabels(draft.weekday).map((label, index) => (
                <AppChip key={label} pressed={draft.nth === index + 1} onClick={() => onDraft({ nth: index + 1 })}>
                  {label}
                </AppChip>
              ))}
            </div>
          )}
          <div className="app-filters-chips" role="group" aria-label="День недели">
            {WEEKDAY_LABELS.map((label, index) => (
              <AppChip key={label} pressed={draft.weekday === index + 1} onClick={() => onDraft({ weekday: index + 1 })}>
                {label}
              </AppChip>
            ))}
          </div>
          {/* The rule only sets the day; the time of day comes from the meeting above. */}
          <p className="app-gathering-hint">Повторяется {planRepeatLabel(rule ?? null)}, в то же время</p>
        </>
      )}
      <AppButton disabled={!planDraftReady(draft, events) || submitting} onClick={onSubmit} stretched>
        {submitting ? "Создаём…" : "Создать план"}
      </AppButton>
      {failed && <AppState error>Не удалось создать план.</AppState>}
    </section>
  );
}

export function PlanCreatePage() {
  const { navigate } = useRoute();
  const [draft, setDraft] = useState<PlanDraft>({ event: "", meetingPoint: "", meetingAt: "", participantIds: [], repeat: "none", weekday: 4, nth: 1 });
  const [events, setEvents] = useState<Event[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    apiClient.listEvents().then(
      (list) => {
        if (alive) setEvents(list);
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
  }, []);

  const submit = useCallback(() => {
    const event = events.find((item) => item.title === draft.event.trim());
    if (!event || !planDraftReady(draft, events)) return;
    setSubmitting(true);
    setFailed(false);
    apiClient
      .createPlan({
        eventId: event.id,
        participantIds: draft.participantIds,
        meetingPoint: draft.meetingPoint.trim(),
        // The input gives a local wall-clock string; the contract wants an instant.
        meetingAt: new Date(draft.meetingAt).toISOString(),
        ...(planRecurringRule(draft) === undefined ? {} : { recurringRule: planRecurringRule(draft)! }),
      })
      .then(
        (card) => navigate({ name: "plan", id: card.plan.id }),
        () => {
          setSubmitting(false);
          setFailed(true);
        },
      );
  }, [draft, events, navigate]);

  return (
    <PlanCreateView
      draft={draft}
      events={events}
      friends={friends}
      submitting={submitting}
      failed={failed}
      onDraft={(patch) =>
        setDraft((current) => {
          const next = { ...current, ...patch };
          // The repeat follows the meeting: choosing Saturday and pressing «каждую неделю» must not
          // quietly repeat on the default Thursday.
          if (patch.meetingAt !== undefined && !Number.isNaN(new Date(patch.meetingAt).getTime())) next.weekday = moscowIsoWeekday(new Date(patch.meetingAt));
          return next;
        })
      }
      onToggleFriend={(friendId) => setDraft((current) => ({ ...current, participantIds: current.participantIds.includes(friendId) ? current.participantIds.filter((id) => id !== friendId) : [...current.participantIds, friendId] }))}
      onSubmit={submit}
    />
  );
}
