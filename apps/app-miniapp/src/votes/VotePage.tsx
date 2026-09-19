// START_MODULE_CONTRACT
// PURPOSE: Shared event vote («Куда идем в пятницу?»): screen opened from a MAX chat card via the vote-<id> deep link, one-tap ballot, winner highlight; plus the minimal create form launched from the whereto wizard result.
// SCOPE: VotePage container (getVote) + presentational VoteView + VoteCreateSection form (title + event/friend pickers over the wizard result and the friends list); the winner comes from the API (no client-side tally); a repeated tap replaces the previous ballot (backend semantics); no share UI (the backend sends the chat card).
// DEPENDS: ../api/client.js (apiClient, ApiError), @max-events/api-contracts (Vote, Event, Friend), ../catalog/CatalogPage.js (formatStartsAt), ../ui/primitives.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - VoteState - union of the vote fetch states (loading / notfound 404 / forbidden 403 / error / ready)
// - voteCountLabel - ru plural of the ballot counter
// - VoteView - presentational: title, participants, «Отправлено в чат» hint when chatLink, option cards with counters, winner badge, «Твой голос» mark (vote.myBallotEventId wins over the session myChoice)
// - VotePage - route container: loads the vote by id, casts ballots (403 -> «Голосование недоступно»)
// - voteCreateReady - create form validity: non-empty title, 2..10 events, >=1 friend
// - VoteCreateView - presentational create form (event chips from the wizard result, friend chips)
// - VoteCreateSection - container: loads friends, creates the vote, reports the created vote up
// END_MODULE_MAP

import { useEffect, useState } from "react";
import type { Event, Friend, Vote } from "@max-events/api-contracts";
import { ApiError, apiClient } from "../api/client";
import { formatStartsAt } from "../catalog/CatalogPage";
import { AppButton, AppChip, AppTitle } from "../ui/primitives";

export type VoteState = { status: "loading" } | { status: "notfound" } | { status: "forbidden" } | { status: "error" } | { status: "ready"; vote: Vote };

export function voteCountLabel(votes: number): string {
  const mod100 = votes % 100;
  const mod10 = mod100 % 10;
  if (mod100 >= 11 && mod100 <= 14) return `${votes} голосов`;
  if (mod10 === 1) return `${votes} голос`;
  if (mod10 >= 2 && mod10 <= 4) return `${votes} голоса`;
  return `${votes} голосов`;
}

interface VoteViewProps {
  state: VoteState;
  myChoice: string | null;
  voting: boolean;
  failed: boolean;
  onVote: (eventId: string) => void;
}

export function VoteView({ state, myChoice, voting, failed, onVote }: VoteViewProps) {
  if (state.status === "loading") return <p className="app-state">Загрузка…</p>;
  if (state.status === "notfound") return <p className="app-state">Голосование не найдено.</p>;
  if (state.status === "forbidden") return <p className="app-state app-state--error">Голосование недоступно.</p>;
  if (state.status === "error") return <p className="app-state app-state--error">Не удалось загрузить голосование.</p>;
  const { vote } = state;
  const myBallotEventId = vote.myBallotEventId ?? myChoice;
  return (
    <section className="app-vote">
      <AppTitle asChild>
        <h2 className="app-vote-title">{vote.title}</h2>
      </AppTitle>
      <p className="app-vote-hint">Участники: {vote.participants.map((friend) => friend.name).join(", ")}</p>
      {vote.chatLink !== null && <p className="app-vote-hint">Отправлено в чат</p>}
      <div className="app-vote-options">
        {vote.options.map((option) => {
          const winner = vote.winnerEventId === option.event.id;
          const mine = myBallotEventId === option.event.id;
          return (
            <button type="button" key={option.event.id} disabled={voting} className={winner ? "app-card app-card--link app-vote-option app-vote-option--winner" : "app-card app-card--link app-vote-option"} onClick={() => onVote(option.event.id)}>
              <div className="app-card-body">
                <span className="app-card-title">{option.event.title}</span>
                <span className="app-card-subtitle">{formatStartsAt(option.event.startsAt)}</span>
                <span className="app-card-subtitle">{voteCountLabel(option.votes)}</span>
                {winner && <span className="app-vote-badge">Лучший вариант</span>}
                {mine && <span className="app-vote-badge">Твой голос</span>}
              </div>
            </button>
          );
        })}
      </div>
      {failed && <p className="app-state app-state--error">Не удалось отправить голос.</p>}
    </section>
  );
}

export function VotePage({ id }: { id: string }) {
  const [state, setState] = useState<VoteState>({ status: "loading" });
  const [myChoice, setMyChoice] = useState<string | null>(null);
  const [voting, setVoting] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    apiClient.getVote(id).then(
      (vote) => {
        if (alive) setState({ status: "ready", vote });
      },
      (error: unknown) => {
        if (!alive) return;
        if (error instanceof ApiError && error.status === 404) {
          setState({ status: "notfound" });
        } else if (error instanceof ApiError && error.status === 403) {
          setState({ status: "forbidden" });
        } else {
          setState({ status: "error" });
        }
      },
    );
    return () => {
      alive = false;
    };
  }, [id]);

  const vote = (eventId: string) => {
    if (state.status !== "ready" || voting) return;
    setVoting(true);
    setFailed(false);
    apiClient.castBallot(state.vote.id, eventId).then(
      (next) => {
        setState({ status: "ready", vote: next });
        setMyChoice(eventId);
        setVoting(false);
      },
      () => {
        setFailed(true);
        setVoting(false);
      },
    );
  };

  return <VoteView state={state} myChoice={myChoice} voting={voting} failed={failed} onVote={vote} />;
}

export function voteCreateReady(title: string, eventIds: string[], friendIds: string[]): boolean {
  return title.trim() !== "" && eventIds.length >= 2 && eventIds.length <= 10 && friendIds.length >= 1;
}

interface VoteCreateViewProps {
  events: Event[];
  friends: Friend[];
  title: string;
  selectedEvents: string[];
  selectedFriends: string[];
  submitting: boolean;
  failed: boolean;
  onTitle: (title: string) => void;
  onToggleEvent: (id: string) => void;
  onToggleFriend: (id: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function VoteCreateView({ events, friends, title, selectedEvents, selectedFriends, submitting, failed, onTitle, onToggleEvent, onToggleFriend, onSubmit, onCancel }: VoteCreateViewProps) {
  return (
    <section className="app-gathering">
      <AppTitle asChild>
        <h2 className="app-gathering-title">Голосование с друзьями</h2>
      </AppTitle>
      <p className="app-gathering-hint">Друзья проголосуют за один из вариантов — лучший подсветится здесь и в чате</p>
      <label className="app-gathering-time">
        Вопрос
        <input className="app-gathering-time-input" value={title} onChange={(change) => onTitle(change.target.value)} />
      </label>
      <div className="app-whereto-chips" role="group" aria-label="Варианты">
        <span className="app-whereto-chips-label">Варианты (от двух)</span>
        {events.map((event) => (
          <AppChip key={event.id} pressed={selectedEvents.includes(event.id)} onClick={() => onToggleEvent(event.id)}>
            {event.title}
          </AppChip>
        ))}
      </div>
      <div className="app-whereto-chips" role="group" aria-label="Участники">
        <span className="app-whereto-chips-label">Участники</span>
        {friends.map((friend) => (
          <AppChip key={friend.id} pressed={selectedFriends.includes(friend.id)} onClick={() => onToggleFriend(friend.id)}>
            {friend.name}
          </AppChip>
        ))}
      </div>
      <AppButton disabled={!voteCreateReady(title, selectedEvents, selectedFriends) || submitting} onClick={onSubmit} stretched>
        {submitting ? "Создаём…" : "Создать голосование"}
      </AppButton>
      <AppButton tone="ghost" onClick={onCancel} stretched>
        Назад к подборке
      </AppButton>
      {failed && <p className="app-state app-state--error">Не удалось создать голосование.</p>}
    </section>
  );
}

function toggle(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}

export function VoteCreateSection({ events, onCreated, onCancel }: { events: Event[]; onCreated: (vote: Vote) => void; onCancel: () => void }) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [title, setTitle] = useState("Куда идем в пятницу?");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(events.map((event) => event.id));
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
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
    return () => {
      alive = false;
    };
  }, []);

  const submit = () => {
    if (!voteCreateReady(title, selectedEvents, selectedFriends) || submitting) return;
    setSubmitting(true);
    setFailed(false);
    apiClient.createVote({ title: title.trim(), eventIds: selectedEvents, participantIds: selectedFriends }).then(
      (created) => onCreated(created),
      () => {
        setFailed(true);
        setSubmitting(false);
      },
    );
  };

  return <VoteCreateView events={events} friends={friends} title={title} selectedEvents={selectedEvents} selectedFriends={selectedFriends} submitting={submitting} failed={failed} onTitle={setTitle} onToggleEvent={(eventId) => setSelectedEvents((current) => toggle(current, eventId))} onToggleFriend={(friendId) => setSelectedFriends((current) => toggle(current, friendId))} onSubmit={submit} onCancel={onCancel} />;
}
