// START_MODULE_CONTRACT
// PURPOSE: Экран 29 «Люди рядом»: two counters, the privacy line and cards that say what the overlap is — «вам по пути», not «знакомства».
// SCOPE: Data via apiClient.getPeople at the viewer origin (mock or live); the match context and the shared interests come from the API as they are, only the first letter is raised to sentence case; «Позвать на событие» opens the gathering flow on a shared event and the search when the overlap is an interest; the × hides a card for this session only. No messaging, no profiles, no likes.
// DEPENDS: ../api/client.js (apiClient), @max-events/api-contracts (PeopleCandidate, PeopleResponse), ../friends/avatar.js, ../geo/profile-city.js, ../catalog/format.js (pluralRu), ../routing/router.js, ../ui/icons.js, ../ui/primitives.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - peopleDistance - «1,2 км» of a candidate distance, ru decimal comma
// - personMetaLine - «1,2 км · сегодня ищет компанию»; empty when neither is known
// - lookingLabel - «сегодня ищут компанию» agreed with the counter above it
// - sentenceCase - raises the first letter of an API explanation, which comes lowercase
// - PeopleState - people fetch union (loading / error / ready)
// - PeopleView - presentational экран 29: counters, privacy line, candidate cards
// - PeoplePage - route container: loads candidates at the viewer origin, wires the invite and the hide
// END_MODULE_MAP

import { useCallback, useEffect, useState } from "react";
import type { PeopleCandidate, PeopleResponse } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { PersonAvatar } from "../friends/avatar";
import { useProfileCityPoint } from "../geo/profile-city";
import { useHeaderTitle } from "../ui/Layout";
import { pluralRu } from "../catalog/format";
import { useRoute } from "../routing/router";
import { ActionIcon } from "../ui/icons";
import { AppSkeletonList, AppState } from "../ui/primitives";

/** The design writes «1,2 км»: a Russian decimal separator, not the dot of the nearby timeline. */
export function peopleDistance(distanceKm: number): string {
  return `${distanceKm.toFixed(1).replace(".", ",")} км`;
}

export function personMetaLine(candidate: PeopleCandidate): string {
  return [candidate.distanceKm === null ? null : peopleDistance(candidate.distanceKm), candidate.lookingForCompanyToday ? "сегодня ищет компанию" : null].filter((part): part is string => part !== null).join(" · ");
}

export function lookingLabel(count: number): string {
  return `сегодня ${pluralRu(count, "ищет", "ищут", "ищут")} компанию`;
}

/** «3 человека рядом» while the viewer is in the city, «3 человека в городе» when the point is its center. */
export function peopleNearLabel(count: number, inCity: boolean): string {
  const noun = pluralRu(count, "человек", "человека", "человек");
  return inCity ? `${noun} рядом` : `${noun} в городе`;
}

export function peopleEmptyTitle(inCity: boolean): string {
  return inCity ? "Рядом пока никого с общими интересами." : "В городе пока никого с общими интересами.";
}

export function peopleErrorTitle(inCity: boolean): string {
  return inCity ? "Не удалось найти людей рядом." : "Не удалось найти людей в городе.";
}

export function peopleScreenTitle(inCity: boolean): string {
  return inCity ? "Люди рядом" : "Люди в городе";
}

/** Explanations arrive as «общий интерес: джаз» — the card opens a sentence, so the first letter rises. */
export function sentenceCase(text: string): string {
  return text.length === 0 ? text : `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

export type PeopleState = { status: "loading" } | { status: "error" } | { status: "ready"; data: PeopleResponse };

function PersonCard({ candidate, onInvite, onHide }: { candidate: PeopleCandidate; onInvite: () => void; onHide: () => void }) {
  const meta = personMetaLine(candidate);
  const name = candidate.person.name.split(" ")[0];
  return (
    <article className="app-people-card">
      <div className="app-people-head">
        <PersonAvatar id={candidate.person.id} name={candidate.person.name} size={44} />
        <div className="app-people-person">
          <span className="app-people-name">
            {name}
            {/* Голубая точка — «живой» индикатор: тот, кто сегодня ищет компанию. Текстом голубой не бывает. */}
            {candidate.lookingForCompanyToday && <span className="app-people-live" aria-hidden="true" />}
          </span>
          {meta !== "" && <span className="app-people-meta">{meta}</span>}
        </div>
      </div>
      <p className="app-people-why">{sentenceCase(candidate.context.explanation)}</p>
      {candidate.sharedInterests.length > 0 && (
        <div className="app-people-tags">
          {candidate.sharedInterests.map((interest) => (
            <span key={interest} className="app-people-tag">
              {sentenceCase(interest)}
            </span>
          ))}
        </div>
      )}
      <div className="app-people-actions">
        <button type="button" className="app-people-invite" onClick={onInvite}>
          Позвать на событие
        </button>
        <button type="button" className="app-people-hide" aria-label={`Скрыть ${name}`} onClick={onHide}>
          <ActionIcon name="close" size={18} strokeWidth={2.2} />
        </button>
      </div>
    </article>
  );
}

interface PeopleViewProps {
  state: PeopleState;
  hidden: ReadonlySet<string>;
  onInvite: (candidate: PeopleCandidate) => void;
  onHide: (userId: string) => void;
  onRetry: () => void;
  /** False when distances are measured from the profile city's center. */
  inCity?: boolean;
}

export function PeopleView({ state, hidden, onInvite, onHide, onRetry, inCity = true }: PeopleViewProps) {
  const people = state.status === "ready" ? state.data.people.filter((candidate) => !hidden.has(candidate.person.id)) : [];
  return (
    <section className="app-people">
      {state.status === "loading" && <AppSkeletonList rows={3} />}
      {state.status === "error" && (
        <AppState error action={{ label: "Повторить", onClick: onRetry }}>
          {peopleErrorTitle(inCity)}
        </AppState>
      )}
      {state.status === "ready" && (
        <>
          {(state.data.nearbyCount > 0 || state.data.lookingForCompanyTodayCount > 0) && (
            <div className="app-people-stats">
              {state.data.nearbyCount > 0 && (
                <div className="app-people-stat">
                  <span className="app-people-stat-count">{state.data.nearbyCount}</span>
                  <span className="app-people-stat-label">{peopleNearLabel(state.data.nearbyCount, inCity)}</span>
                </div>
              )}
              {state.data.lookingForCompanyTodayCount > 0 && (
                <div className="app-people-stat app-people-stat--live">
                  <span className="app-people-stat-count">{state.data.lookingForCompanyTodayCount}</span>
                  <span className="app-people-stat-label">{lookingLabel(state.data.lookingForCompanyTodayCount)}</span>
                </div>
              )}
            </div>
          )}
          <p className="app-people-note">Показываем только тех, кто сам согласился быть видимым. Точное местоположение не передаётся — только расстояние.</p>
          {people.length === 0 && <AppState>{peopleEmptyTitle(inCity)}</AppState>}
          {people.map((candidate) => (
            <PersonCard key={candidate.person.id} candidate={candidate} onInvite={() => onInvite(candidate)} onHide={() => onHide(candidate.person.id)} />
          ))}
        </>
      )}
    </section>
  );
}

export function PeoplePage() {
  const { navigate } = useRoute();
  const point = useProfileCityPoint();
  const inCity = point.settled && point.fromViewer;
  useHeaderTitle(peopleScreenTitle(inCity));
  const [state, setState] = useState<PeopleState>({ status: "loading" });
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());

  const load = useCallback(() => {
    if (!point.settled) return;
    setState({ status: "loading" });
    apiClient.getPeople({ latitude: point.latitude, longitude: point.longitude }).then(
      (data) => setState({ status: "ready", data }),
      () => setState({ status: "error" }),
    );
  }, [point.settled, point.latitude, point.longitude]);
  useEffect(() => {
    load();
  }, [load]);

  const invite = (candidate: PeopleCandidate) => {
    // Общее событие есть — зовём прямо на него; общий интерес — сначала надо выбрать, куда звать.
    if (candidate.context.kind === "shared_event") navigate({ name: "gathering-new", eventId: candidate.context.event.id });
    else navigate({ name: "search" });
  };

  return (
    <PeopleView
      state={state}
      hidden={hidden}
      onInvite={invite}
      onHide={(userId) =>
        setHidden((current) => {
          const next = new Set(current);
          next.add(userId);
          return next;
        })
      }
      onRetry={load}
      inCity={inCity}
    />
  );
}
