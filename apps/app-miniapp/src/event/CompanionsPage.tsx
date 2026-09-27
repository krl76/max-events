// START_MODULE_CONTRACT
// PURPOSE: Экран 23 «С кем пойти»: the event topbar, «Собрать своих», the Идут/Хотят/Ищут tabs, the viewer status card with its six-status picker, the people looking for company with their interest matches, and the «Собирается компания» teaser.
// SCOPE: Data via apiClient.getEventCompanions/getEvent/setParticipationStatus/deleteParticipation (mock or live); tab and picker state live here, navigation is handed to the router. The invite action opens the gathering flow — there is no invite-one-person endpoint.
// DEPENDS: ../api/client.js (apiClient, EventCompanion, EventCompanions), @max-events/api-contracts (Event, ParticipationStatus), ../auth/AuthContext.js, ../catalog/format.js (pluralRu), ../routing/router.js, ../ui/icons.js, ../ui/primitives.js (AppMedia, AppState, AppSkeletonList), ./EventPage.js (PARTICIPATION_STATUS_LABELS), ../ui/theme.css
// LINKS: M-APP-MINIAPP, DF-MAX-IDENTITY
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - CompanionTab - which counter the list is filtered by: going / wants / looking
// - COMPANION_TABS - the three tabs in design order with their labels
// - tabOfStatus - participation status -> the tab that counts it
// - tabCount - counter printed in a tab head
// - companionMeta - «Из чата «Двор» · 5 общих планов» (expanded) or «Не в твоих чатах · 2 совпадения» (compact)
// - matchesBadge - «3 СОВПАДЕНИЯ» of the expanded card; null below one match
// - gatheringLine - «Катя, Сергей и ещё 2 договариваются встретиться у входа в 19:30»
// - myStatusLine - «Мой статус: ищу компанию» / «Мой статус: не выбран»
// - CompanionCard - one person: expanded with their note, interests and «Позвать в план», compact without
// - CompanionsView - presentational экран 23: topbar, actions, tabs, status card, the list and the teaser
// - CompanionsPage - route container: loads the event and the companions, wires the tabs, the status switch and the picker
// END_MODULE_MAP

import { useCallback, useEffect, useState } from "react";
import type { Event, ParticipationStatus } from "@max-events/api-contracts";
import { ParticipationStatusSchema } from "@max-events/api-contracts";
import { apiClient, type EventCompanion, type EventCompanions } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { pluralRu } from "../catalog/format";
import { useRoute } from "../routing/router";
import { ActionIcon } from "../ui/icons";
import { AppMedia, AppSkeletonList, AppState } from "../ui/primitives";
import { PARTICIPATION_STATUS_LABELS } from "./EventPage";

export type CompanionTab = "going" | "wants" | "looking";

/** The design opens on «Ищут»: this screen exists for the people who still need company. */
export const COMPANION_TABS: ReadonlyArray<{ tab: CompanionTab; label: string }> = [
  { tab: "going", label: "Идут" },
  { tab: "wants", label: "Хотят" },
  { tab: "looking", label: "Ищут" },
];

export function tabOfStatus(status: ParticipationStatus): CompanionTab {
  if (status === "going") return "going";
  if (status === "wants_to_go" || status === "probably_going") return "wants";
  return "looking";
}

export function tabCount(companions: EventCompanions, tab: CompanionTab): number {
  return companions.counts[tab];
}

/**
 * The line under a name answers «откуда я его знаю» first, because that is what decides whether you
 * write to them. The expanded card spends its second slot on shared plans and hands the matches to
 * the badge; the compact row has no badge, so the matches ride the line instead.
 */
export function companionMeta(companion: EventCompanion, expanded: boolean): string {
  const parts = [companion.chatTitle === null ? "Не в твоих чатах" : `Из чата «${companion.chatTitle}»`];
  if (expanded && companion.sharedPlansCount > 0) parts.push(`${companion.sharedPlansCount} ${pluralRu(companion.sharedPlansCount, "общий план", "общих плана", "общих планов")}`);
  if (!expanded && companion.matchesCount > 0) parts.push(`${companion.matchesCount} ${pluralRu(companion.matchesCount, "совпадение", "совпадения", "совпадений")}`);
  return parts.join(" · ");
}

export function matchesBadge(matchesCount: number): string | null {
  return matchesCount === 0 ? null : `${matchesCount} ${pluralRu(matchesCount, "СОВПАДЕНИЕ", "СОВПАДЕНИЯ", "СОВПАДЕНИЙ")}`;
}

export function gatheringLine(names: string, extraCount: number, meetingNote: string): string {
  const who = extraCount === 0 ? names : `${names} и ещё ${extraCount}`;
  return `${who} ${pluralRu(extraCount === 0 ? 2 : extraCount + 2, "договаривается", "договариваются", "договариваются")} встретиться ${meetingNote}`;
}

export function myStatusLine(status: ParticipationStatus | null): string {
  return `Мой статус: ${status === null ? "не выбран" : PARTICIPATION_STATUS_LABELS[status].toLowerCase()}`;
}

interface CompanionCardProps {
  companion: EventCompanion;
  onInvite: () => void;
  onChat: () => void;
}

export function CompanionCard({ companion, onInvite, onChat }: CompanionCardProps) {
  const expanded = companion.note !== null;
  const badge = matchesBadge(companion.matchesCount);
  if (!expanded) {
    return (
      <li className="app-evc-row">
        <span className="app-evc-avatar" aria-hidden="true">
          {companion.friend.name.charAt(0)}
        </span>
        <span className="app-evc-id">
          <span className="app-evc-name">{companion.friend.name}</span>
          <span className="app-evc-meta">{companionMeta(companion, false)}</span>
        </span>
        <button type="button" className="app-evc-invite-link" onClick={onInvite}>
          Позвать
        </button>
      </li>
    );
  }
  return (
    <li className="app-evc-card">
      <div className="app-evc-card-head">
        {/* Точка на аватаре: человек не просто отметил статус, а написал строку — именно её макет выделяет */}
        <span className="app-evc-avatar app-evc-avatar--active" aria-hidden="true">
          {companion.friend.name.charAt(0)}
        </span>
        <span className="app-evc-id">
          <span className="app-evc-name">{companion.friend.name}</span>
          <span className="app-evc-meta">{companionMeta(companion, true)}</span>
        </span>
        {badge !== null && <span className="app-evc-badge">{badge}</span>}
      </div>
      <p className="app-evc-note">{companion.note}</p>
      {companion.interests.length > 0 && (
        <ul className="app-evc-tags">
          {companion.interests.map((interest) => (
            <li key={interest} className="app-evc-tag">
              {interest}
            </li>
          ))}
        </ul>
      )}
      <div className="app-evc-actions">
        <button type="button" className="app-evc-invite" onClick={onInvite}>
          Позвать в план
        </button>
        <button type="button" className="app-evc-chat" aria-label={`Написать: ${companion.friend.name}`} onClick={onChat}>
          <ActionIcon name="comment" size={20} />
        </button>
      </div>
    </li>
  );
}

interface CompanionsViewProps {
  event: Event | null;
  companions: EventCompanions | null;
  failed: boolean;
  tab: CompanionTab;
  pickerOpen: boolean;
  onTab: (tab: CompanionTab) => void;
  onBack: () => void;
  onGather: () => void;
  onToggleLooking: () => void;
  onTogglePicker: () => void;
  onStatus: (status: ParticipationStatus | null) => void;
  onInvite: () => void;
  onChat: () => void;
  onRetry: () => void;
}

const PARTICIPATION_STATUSES = ParticipationStatusSchema.options;

export function CompanionsView({ event, companions, failed, tab, pickerOpen, onTab, onBack, onGather, onToggleLooking, onTogglePicker, onStatus, onInvite, onChat, onRetry }: CompanionsViewProps) {
  const listed = companions === null ? [] : companions.companions.filter((companion) => tabOfStatus(companion.status) === tab);
  const looking = companions?.myStatus === "looking_for_company";
  return (
    <div className="app-evc">
      <header className="app-evc-bar">
        <button type="button" className="app-evc-back" aria-label="Назад" onClick={onBack}>
          <ActionIcon name="chevron" size={18} strokeWidth={2.4} />
          Назад
        </button>
        <span className="app-evc-bar-text">
          <span className="app-evc-bar-label">С кем пойти</span>
          <span className="app-evc-bar-title">{event?.title ?? "Событие"}</span>
        </span>
        {event !== null && <AppMedia category={event.category} className="app-evc-bar-media" />}
      </header>
      <div className="app-evc-lead">
        <button type="button" className="app-evc-gather" onClick={onGather}>
          <ActionIcon name="friends" size={18} />
          Собрать своих
        </button>
      </div>
      <div className="app-evc-tabs" role="tablist" aria-label="Кто идёт">
        {COMPANION_TABS.map((entry) => (
          <button key={entry.tab} type="button" role="tab" aria-selected={entry.tab === tab} className={entry.tab === tab ? "app-evc-tab app-evc-tab--on" : "app-evc-tab"} onClick={() => onTab(entry.tab)}>
            {entry.label} · {companions === null ? 0 : tabCount(companions, entry.tab)}
          </button>
        ))}
      </div>
      {failed && (
        <AppState error action={{ label: "Повторить", onClick: onRetry }}>
          Не удалось загрузить участников.
        </AppState>
      )}
      {companions === null && !failed && <AppSkeletonList rows={3} />}
      {companions !== null && (
        <>
          <section className="app-evc-status" aria-label="Мой статус">
            <div className="app-evc-status-head">
              <button type="button" className="app-evc-status-text" aria-expanded={pickerOpen} onClick={onTogglePicker}>
                <span className="app-evc-status-line">{myStatusLine(companions.myStatus)}</span>
                <span className="app-evc-status-hint">Видят только участники события</span>
              </button>
              <button type="button" role="switch" aria-checked={looking} aria-label="Ищу компанию" className={looking ? "app-evc-switch app-evc-switch--on" : "app-evc-switch"} onClick={onToggleLooking}>
                <span className="app-evc-switch-knob" aria-hidden="true" />
              </button>
            </div>
            {/* Переключатель отвечает за «ищу компанию» — остальные пять статусов живут здесь, в один тап */}
            {pickerOpen && (
              <ul className="app-evc-picker">
                {PARTICIPATION_STATUSES.map((status) => (
                  <li key={status}>
                    <button type="button" className={companions.myStatus === status ? "app-evc-pick app-evc-pick--on" : "app-evc-pick"} aria-pressed={companions.myStatus === status} onClick={() => onStatus(companions.myStatus === status ? null : status)}>
                      {PARTICIPATION_STATUS_LABELS[status]}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <p className="app-evc-list-label">{tab === "looking" ? "Тоже ищут компанию" : tab === "going" ? "Уже идут" : "Хотят пойти"}</p>
          {listed.length === 0 ? (
            <AppState>Здесь пока никого — позови своих.</AppState>
          ) : (
            <ul className="app-evc-list">
              {listed.map((companion) => (
                <CompanionCard key={companion.friend.id} companion={companion} onInvite={onInvite} onChat={onChat} />
              ))}
            </ul>
          )}
          {companions.gathering !== null && (
            <section className="app-evc-gathering" aria-label="Собирается компания">
              <h2 className="app-evc-gathering-title">Собирается компания</h2>
              <p className="app-evc-gathering-text">{gatheringLine(companions.gathering.members.map((member) => member.name.split(" ")[0]).join(", "), companions.gathering.extraCount, companions.gathering.meetingNote)}</p>
              <div className="app-evc-gathering-foot">
                <span className="app-evc-faces" role="img" aria-label={companions.gathering.members.map((member) => member.name).join(", ")}>
                  {companions.gathering.members.map((member) => (
                    <span key={member.id} className="app-evc-face">
                      {member.name.charAt(0)}
                    </span>
                  ))}
                  {companions.gathering.extraCount > 0 && <span className="app-evc-face app-evc-face--rest">+{companions.gathering.extraCount}</span>}
                </span>
                <button type="button" className="app-evc-join" onClick={onGather}>
                  Присоединиться
                </button>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

export function CompanionsPage({ eventId }: { eventId: string }) {
  const auth = useAuth();
  const userId = auth.status === "authenticated" ? auth.user.id : null;
  const { navigate, back } = useRoute();
  const [event, setEvent] = useState<Event | null>(null);
  const [companions, setCompanions] = useState<EventCompanions | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [tab, setTab] = useState<CompanionTab>("looking");
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (userId === null) return;
    let alive = true;
    setFailed(false);
    Promise.all([apiClient.getEvent(eventId), apiClient.getEventCompanions(eventId, userId)]).then(
      ([loadedEvent, loadedCompanions]) => {
        if (!alive) return;
        setEvent(loadedEvent);
        setCompanions(loadedCompanions);
      },
      () => {
        if (alive) setFailed(true);
      },
    );
    return () => {
      alive = false;
    };
  }, [eventId, userId, attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  const setStatus = useCallback(
    (status: ParticipationStatus | null) => {
      if (userId === null) return;
      const call = status === null ? apiClient.deleteParticipation(eventId, userId) : apiClient.setParticipationStatus(eventId, userId, status);
      call.then(reload, reload);
    },
    [eventId, userId, reload],
  );

  const toggleLooking = useCallback(() => {
    setStatus(companions?.myStatus === "looking_for_company" ? null : "looking_for_company");
  }, [companions, setStatus]);

  // Позвать одного человека API не умеет: приглашение — это сбор компании с выбранными друзьями.
  const gather = useCallback(() => navigate({ name: "gathering-new", eventId }), [navigate, eventId]);

  return <CompanionsView event={event} companions={companions} failed={failed} tab={tab} pickerOpen={pickerOpen} onTab={setTab} onBack={back} onGather={gather} onToggleLooking={toggleLooking} onTogglePicker={() => setPickerOpen((open) => !open)} onStatus={setStatus} onInvite={gather} onChat={gather} onRetry={reload} />;
}
