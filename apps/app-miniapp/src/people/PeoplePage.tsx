// START_MODULE_CONTRACT
// PURPOSE: People matching screen (#191) «Хочу найти людей с похожими интересами»: counters «N человек рядом, M ищут компанию сегодня», interest chip filter and candidate cards with the match context — no dating mechanics (view plus event CTAs only).
// SCOPE: Data via apiClient.getPeople (mock or live) at the fixed Moscow center; chips from the viewer profile interests (candidate sharedInterests fallback); client-side interest filtering; CTA to the event route on shared_event contexts; loading/error/empty states.
// DEPENDS: ../api/client.js (apiClient), @max-events/api-contracts (PeopleCandidate, PeopleResponse), ../catalog/MapScreen.js (MOSCOW_CENTER), ../friends/FriendsPage.js (initials), ../nearby/NearbyPage.js (formatDistanceKm), ../place/PlacePage.js (peopleLabel), ../routing/router.js, ../ui/primitives.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - lookingLabel - ru plural of «ищет/ищут компанию сегодня» for the summary counter
// - candidateInterests - sorted union of the candidates' sharedInterests (chip fallback)
// - filterCandidates - client-side chip filter (empty selection -> all)
// - PeopleState - people fetch union (loading / error / ready)
// - PeopleView - presentational: summary counters, chips, candidate cards with context and badge
// - PeoplePage - route container: loads people + profile chips, wires the filter and event navigation
// END_MODULE_MAP

import { useEffect, useState } from "react";
import type { PeopleCandidate, PeopleResponse } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { MOSCOW_CENTER } from "../catalog/MapScreen";
import { initials } from "../friends/FriendsPage";
import { formatDistanceKm } from "../nearby/NearbyPage";
import { peopleLabel } from "../place/PlacePage";
import { useRoute } from "../routing/router";
import { AppAvatar, AppButton, AppChip, AppTitle, AppState } from "../ui/primitives";

// ponytail: fixed Moscow center; user geolocation when the bridge exposes it
const [PEOPLE_LAT, PEOPLE_LNG] = MOSCOW_CENTER;

export function lookingLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  return `${count} ${mod10 === 1 && mod100 !== 11 ? "ищет" : "ищут"} компанию сегодня`;
}

export function candidateInterests(people: PeopleCandidate[]): string[] {
  const all = new Set<string>();
  for (const candidate of people) for (const interest of candidate.sharedInterests) all.add(interest);
  return [...all].sort((a, b) => a.localeCompare(b));
}

export function filterCandidates(people: PeopleCandidate[], selected: ReadonlySet<string>): PeopleCandidate[] {
  if (selected.size === 0) return people;
  return people.filter((candidate) => candidate.sharedInterests.some((interest) => selected.has(interest)));
}

export type PeopleState = { status: "loading" } | { status: "error" } | { status: "ready"; data: PeopleResponse };

interface PeopleViewProps {
  state: PeopleState;
  chips: string[];
  selected: ReadonlySet<string>;
  onToggle: (interest: string) => void;
  onOpenEvent: (eventId: string) => void;
}

function PersonCard({ candidate, onOpenEvent }: { candidate: PeopleCandidate; onOpenEvent: (eventId: string) => void }) {
  const sharedEvent = candidate.context.kind === "shared_event" ? candidate.context.event : null;
  const openEvent = sharedEvent === null ? null : () => onOpenEvent(sharedEvent.id);
  return (
    <article className="app-card">
      <div className="app-card-body">
        <div className="app-friends-person">
          <AppAvatar size={44}>{initials(candidate.person.name)}</AppAvatar>
          <span className="app-friends-name">{candidate.person.name}</span>
        </div>
        <span className="app-card-subtitle">{candidate.distanceKm === null ? "Из твоего города" : formatDistanceKm(candidate.distanceKm)}</span>
        <span className="app-today-labels">
          {candidate.sharedInterests.map((interest) => (
            <span key={interest} className="app-today-chip">
              {interest}
            </span>
          ))}
          {candidate.lookingForCompanyToday && <span className="app-today-chip">Ищет компанию сегодня</span>}
        </span>
        <span className="app-card-subtitle">{candidate.context.explanation}</span>
        {openEvent !== null && (
          <AppButton size="small" onClick={openEvent}>
            Открыть событие
          </AppButton>
        )}
      </div>
    </article>
  );
}

export function PeopleView({ state, chips, selected, onToggle, onOpenEvent }: PeopleViewProps) {
  const people = state.status === "ready" ? filterCandidates(state.data.people, selected) : [];
  return (
    <>
      <AppTitle asChild>
        <h2 className="app-section-title">Люди с похожими интересами</h2>
      </AppTitle>
      {state.status === "loading" && <AppState>Ищем людей рядом…</AppState>}
      {state.status === "error" && <AppState error>Не удалось найти людей рядом.</AppState>}
      {state.status === "ready" && (
        <>
          <p className="app-today-summary">
            {peopleLabel(state.data.nearbyCount)} рядом с похожими интересами
            {state.data.lookingForCompanyTodayCount > 0 ? `, ${lookingLabel(state.data.lookingForCompanyTodayCount)}` : ""}
          </p>
          {chips.length > 0 && (
            <div className="app-whereto-chips" role="group" aria-label="Интересы">
              {chips.map((interest) => (
                <AppChip key={interest} pressed={selected.has(interest)} onClick={() => onToggle(interest)}>
                  {interest}
                </AppChip>
              ))}
            </div>
          )}
          {people.length === 0 && <AppState>Никого рядом с такими интересами не нашлось.</AppState>}
          {people.map((candidate) => (
            <PersonCard key={candidate.person.id} candidate={candidate} onOpenEvent={onOpenEvent} />
          ))}
        </>
      )}
    </>
  );
}

export function PeoplePage() {
  const { navigate } = useRoute();
  const [state, setState] = useState<PeopleState>({ status: "loading" });
  const [profileInterests, setProfileInterests] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    apiClient.getPeople({ latitude: PEOPLE_LAT, longitude: PEOPLE_LNG }).then(
      (data) => {
        if (alive) setState({ status: "ready", data });
      },
      () => {
        if (alive) setState({ status: "error" });
      },
    );
    apiClient.getProfile().then(
      (profile) => {
        if (alive) setProfileInterests(profile.interests);
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, []);

  const toggle = (interest: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(interest)) next.delete(interest);
      else next.add(interest);
      return next;
    });
  };

  const chips = profileInterests !== null && profileInterests.length > 0 ? profileInterests : state.status === "ready" ? candidateInterests(state.data.people) : [];

  return <PeopleView state={state} chips={chips} selected={selected} onToggle={toggle} onOpenEvent={(id) => navigate({ name: "event", id })} />;
}
