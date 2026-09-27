// START_MODULE_CONTRACT
// PURPOSE: Экран 33 «Голосование · ход»: шапка вопроса, стек проголосовавших, тёмная карточка лидера с «Завершить», раскладка по вариантам с процентами и отметкой своего голоса, строка «кто ещё не голосовал».
// SCOPE: VotePage container (getVote/castBallot/closeVote) + presentational VoteView; the winner and the tallies come from the API, никакого подсчёта на клиенте; a finished vote stops taking ballots; экран 32 lives in ./VoteCreatePage.js and is re-exported here for the whereto wizard.
// DEPENDS: ../api/client.js (apiClient, ApiError, VoteScreen), ../auth/AuthContext.js (useAuth), ./VoteCreatePage.js, ./format.js (voteOptionMeta), ../catalog/format.js (pluralRu), ../max/bridge.js (openExternalLink), ../routing/router.js, ../ui/icons.js, ../ui/primitives.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - VoteState - union of the vote fetch states (loading / notfound 404 / forbidden 403 / error / ready)
// - votePercent - share of one option in the cast ballots, rounded; 0 while nobody voted
// - voteBallotsCast - how many ballots the tallies add up to
// - voteProgressLabel - «Проголосовали 4 из 5»
// - voteMineNote - «Ты проголосовал за «Кино на крыше»»; null until the viewer has a ballot
// - votePendingNote - «Ещё не проголосовали: Пётр. Напомнить можно в чате MAX.»; null when everyone but the viewer voted
// - VoteFaces - overlapping initials of everyone who already voted
// - VoteView - presentational: question topbar, voter stack, leader card, per-option breakdown, own-ballot strip
// - VotePage - route container: loads the vote, casts and changes ballots, closes the vote as its host
// - VoteCreateSection - экран 32 re-exported, because the whereto wizard has imported it from this module since T-021
// - voteCreateReady - экран 32 validity re-exported next to the section it belongs to
// END_MODULE_MAP

import { useEffect, useState } from "react";
import { ApiError, apiClient, type VoteScreen } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { pluralRu } from "../catalog/format";
import { openExternalLink } from "../max/bridge";
import { useRoute } from "../routing/router";
import { ActionIcon } from "../ui/icons";
import { AppMedia, AppSkeletonList, AppState } from "../ui/primitives";
import { voteOptionMeta } from "./format";

export { VoteCreateSection, voteCreateReady } from "./VoteCreatePage";

export type VoteState = { status: "loading" } | { status: "notfound" } | { status: "forbidden" } | { status: "error" } | { status: "ready"; vote: VoteScreen };

export function voteBallotsCast(vote: VoteScreen): number {
  return vote.options.reduce((sum, option) => sum + option.votes, 0);
}

export function votePercent(votes: number, total: number): number {
  return total <= 0 ? 0 : Math.round((votes / total) * 100);
}

export function voteProgressLabel(voted: number, total: number): string {
  return `Проголосовали ${voted} из ${total}`;
}

export function voteMineNote(vote: VoteScreen): string | null {
  const mine = vote.options.find((option) => option.event.id === vote.myBallotEventId);
  return mine === undefined ? null : `Ты проголосовал за «${mine.event.title}»`;
}

/**
 * «Ксения ещё не голосовала» of the design, minus the gender: the friend DTO carries a name and
 * nothing else, so agreeing the verb with it would be a guess about a real person. The plural form
 * is right for any number and any gender, and the second sentence of the design stays verbatim.
 */
export function votePendingNote(vote: VoteScreen, ownId: string | null): string | null {
  const voted = new Set(vote.votedUserIds);
  const pending = vote.voters.filter((voter) => !voted.has(voter.id) && voter.id !== ownId);
  if (pending.length === 0) return null;
  return `Ещё не проголосовали: ${pending.map((voter) => voter.name.split(" ")[0]).join(", ")}. Напомнить можно в чате MAX.`;
}

export function VoteFaces({ vote }: { vote: VoteScreen }) {
  const voted = vote.voters.filter((voter) => vote.votedUserIds.includes(voter.id));
  if (voted.length === 0) return null;
  return (
    <span className="app-we-faces" role="img" aria-label={voted.map((voter) => voter.name).join(", ")}>
      {voted.map((voter) => (
        <span key={voter.id} className="app-we-face">
          {voter.name.charAt(0)}
        </span>
      ))}
    </span>
  );
}

interface VoteViewProps {
  state: VoteState;
  ownId: string | null;
  /** Kept after a ballot so the mark survives a reload that has not landed yet. */
  myChoice: string | null;
  voting: boolean;
  closing: boolean;
  /** True while the viewer is picking again: the breakdown goes back to being tappable. */
  revoting: boolean;
  failed: boolean;
  onBack: () => void;
  onVote: (eventId: string) => void;
  onRevote: () => void;
  onClose: () => void;
  onChat: (link: string) => void;
  onOpenEvent: (eventId: string) => void;
}

export function VoteView({ state, ownId, myChoice, voting, closing, revoting, failed, onBack, onVote, onRevote, onClose, onChat, onOpenEvent }: VoteViewProps) {
  if (state.status !== "ready") {
    return (
      <section className="app-poll" aria-label="Голосование">
        <div className="app-we-bar">
          <button type="button" className="app-we-round app-we-round--back" aria-label="Назад" onClick={onBack}>
            <ActionIcon name="chevron" size={18} strokeWidth={2.4} />
            Назад
          </button>
          <h1 className="app-we-bar-name">Голосование</h1>
        </div>
        {state.status === "loading" && <AppSkeletonList rows={3} />}
        {state.status === "notfound" && <AppState>Голосование не найдено.</AppState>}
        {state.status === "forbidden" && <AppState error>Голосование недоступно.</AppState>}
        {state.status === "error" && <AppState error>Не удалось загрузить голосование.</AppState>}
      </section>
    );
  }

  const { vote } = state;
  const myBallotEventId = vote.myBallotEventId ?? myChoice;
  const closed = vote.status === "closed";
  const isHost = ownId !== null && vote.hostUserId === ownId;
  const cast = voteBallotsCast(vote);
  const leader = vote.options.find((option) => option.event.id === vote.winnerEventId) ?? null;
  const pickable = !closed && (myBallotEventId === null || revoting);
  const pending = votePendingNote(vote, ownId);
  const mine = voteMineNote(vote);

  return (
    <section className="app-poll" aria-label="Голосование">
      <div className="app-we-bar">
        <button type="button" className="app-we-round app-we-round--back" aria-label="Назад" onClick={onBack}>
          <ActionIcon name="chevron" size={18} strokeWidth={2.4} />
          Назад
        </button>
        <h1 className="app-we-bar-name">{vote.title}</h1>
      </div>

      <div className="app-we-people">
        <VoteFaces vote={vote} />
        <span className="app-we-people-text">{voteProgressLabel(vote.votedUserIds.length, vote.voters.length)}</span>
        {vote.chatLink !== null && (
          <button type="button" className="app-we-chat" onClick={() => onChat(vote.chatLink!)}>
            <span className="app-we-chat-mark" aria-hidden="true">
              M
            </span>
            Чат
          </button>
        )}
      </div>

      {leader !== null ? (
        <section className="app-poll-lead" aria-label={closed ? "Победитель" : "Лидер голосования"}>
          <p className="app-poll-lead-label">{closed ? "Победил" : "Лидирует"}</p>
          <h2 className="app-poll-lead-title">{leader.event.title}</h2>
          <p className="app-poll-lead-meta">
            {voteOptionMeta(leader.event)} · {leader.votes} {pluralRu(leader.votes, "голос", "голоса", "голосов")}
          </p>
          <div className="app-poll-lead-actions">
            <button type="button" className="app-poll-lead-open" onClick={() => onOpenEvent(leader.event.id)}>
              Открыть событие
            </button>
            {isHost && !closed && (
              <button type="button" className="app-poll-lead-close" disabled={closing} onClick={onClose}>
                {closing ? "Завершаем…" : "Завершить"}
              </button>
            )}
          </div>
        </section>
      ) : (
        <p className="app-poll-empty">Голосов пока нет — выбери вариант первым.</p>
      )}

      <h2 className="app-poll-section">Все варианты</h2>
      <div className="app-poll-results">
        {vote.options.map((option) => {
          const percent = votePercent(option.votes, cast);
          const isMine = myBallotEventId === option.event.id;
          const body = (
            <>
              <span className="app-poll-result-fill" style={{ width: `${percent}%` }} aria-hidden="true" />
              <span className="app-poll-result-body">
                <AppMedia category={option.event.category} className="app-poll-result-media" />
                <span className="app-poll-result-text">
                  <span className="app-poll-result-title">
                    {option.event.title}
                    {isMine && (
                      <span className="app-poll-result-mark" aria-hidden="true">
                        <ActionIcon name="check" size={15} strokeWidth={3} />
                      </span>
                    )}
                  </span>
                  <span className="app-poll-result-meta">
                    {voteOptionMeta(option.event)}
                    {isMine ? " · твой голос" : ""}
                  </span>
                </span>
                <span className="app-poll-result-tally">
                  <span className="app-poll-result-votes">{option.votes}</span>
                  <span className="app-poll-result-share">{percent}%</span>
                </span>
              </span>
            </>
          );
          const className = isMine ? "app-poll-result app-poll-result--mine" : "app-poll-result";
          return pickable ? (
            <button type="button" key={option.event.id} className={className} disabled={voting} onClick={() => onVote(option.event.id)}>
              {body}
            </button>
          ) : (
            <div key={option.event.id} className={className}>
              {body}
            </div>
          );
        })}
      </div>

      {mine !== null && (
        <div className="app-poll-mine">
          <span className="app-poll-mine-mark" aria-hidden="true">
            <ActionIcon name="check" size={18} strokeWidth={2.4} />
          </span>
          <span className="app-poll-mine-text">{mine}</span>
          {!closed && !revoting && (
            <button type="button" className="app-we-block-action" onClick={onRevote}>
              Изменить
            </button>
          )}
        </div>
      )}
      {closed && <p className="app-poll-pending">Голосование завершено, новые голоса не принимаются.</p>}
      {!closed && pending !== null && <p className="app-poll-pending">{pending}</p>}
      {failed && <AppState error>Не удалось отправить голос.</AppState>}
    </section>
  );
}

export function VotePage({ id }: { id: string }) {
  const { back, navigate } = useRoute();
  const auth = useAuth();
  const ownId = auth.status === "authenticated" ? auth.user.id : null;
  const [state, setState] = useState<VoteState>({ status: "loading" });
  const [myChoice, setMyChoice] = useState<string | null>(null);
  const [voting, setVoting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [revoting, setRevoting] = useState(false);
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
        setRevoting(false);
        setVoting(false);
      },
      () => {
        setFailed(true);
        setVoting(false);
      },
    );
  };

  const close = () => {
    if (state.status !== "ready" || closing) return;
    setClosing(true);
    setFailed(false);
    apiClient.closeVote(state.vote.id).then(
      (next) => {
        setState({ status: "ready", vote: next });
        setClosing(false);
      },
      () => {
        setFailed(true);
        setClosing(false);
      },
    );
  };

  return <VoteView state={state} ownId={ownId} myChoice={myChoice} voting={voting} closing={closing} revoting={revoting} failed={failed} onBack={back} onVote={vote} onRevote={() => setRevoting(true)} onClose={close} onChat={openExternalLink} onOpenEvent={(eventId) => navigate({ name: "event", id: eventId })} />;
}
