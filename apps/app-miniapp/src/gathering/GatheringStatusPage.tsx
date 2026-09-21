// START_MODULE_CONTRACT
// PURPOSE: Gathering status screen: every invitee answer («подтвердил / смотрит / занят»), the invitee answer buttons («Иду / Занят»), the «Ты + N из M» summary and the chat link button when the gathering chat exists.
// SCOPE: Data via apiClient.getGathering (mock or live); presentational rendering of invitee responses; the authenticated invitee (not the host) answers via apiClient.respondToGathering and the state updates from the server response.
// DEPENDS: ../api/client.js (apiClient), ../auth/AuthContext.js (useAuth), @max-events/api-contracts (Gathering, InviteeResponse), ../max/bridge.js (openExternalLink), ../ui/primitives.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - INVITEE_RESPONSE_LABELS - ru labels for invitee responses (accepted/considering/busy)
// - gatheringSummary - «Ты + accepted из total» aggregate line
// - GatheringStatusState - union of gathering fetch states (loading / error / ready)
// - GatheringStatusView - presentational: summary title, event hint, answer buttons for the current invitee (current answer pressed), chat link button, invitee answer list
// - GatheringStatusPage - route container: loads the gathering by id, sends invitee answers (PATCH response), state from the server payload
// END_MODULE_MAP

import { useEffect, useState } from "react";
import { apiClient } from "../api/client";
import type { Gathering, InviteeResponse } from "@max-events/api-contracts";
import { useAuth } from "../auth/AuthContext";
import { openExternalLink } from "../max/bridge";
import { AppButton, AppTitle, AppState } from "../ui/primitives";

export const INVITEE_RESPONSE_LABELS: Record<InviteeResponse, string> = { accepted: "подтвердил", considering: "смотрит", busy: "занят" };

const RESPONSE_ACTIONS: { value: InviteeResponse; label: string }[] = [
  { value: "accepted", label: "Иду" },
  { value: "busy", label: "Занят" },
];

export function gatheringSummary(gathering: Gathering): string {
  const accepted = gathering.invitees.filter((invitee) => invitee.response === "accepted").length;
  return `Ты + ${accepted} из ${gathering.invitees.length}`;
}

export type GatheringStatusState = { status: "loading" } | { status: "error" } | { status: "ready"; gathering: Gathering };

interface GatheringStatusViewProps {
  state: GatheringStatusState;
  /** Current user id: an invitee sees the answer buttons, the host (or null) does not. */
  myUserId?: string | null;
  responding?: boolean;
  failed?: boolean;
  onRespond?: (response: InviteeResponse) => void;
}

export function GatheringStatusView({ state, myUserId = null, responding = false, failed = false, onRespond = () => {} }: GatheringStatusViewProps) {
  if (state.status === "loading") return <AppState>Загрузка…</AppState>;
  if (state.status === "error") return <AppState error>Не удалось загрузить сбор.</AppState>;
  const myResponse = myUserId === null ? undefined : state.gathering.invitees.find((invitee) => invitee.friend.id === myUserId)?.response;
  return (
    <section className="app-gathering">
      <AppTitle asChild>
        <h2 className="app-section-title">{gatheringSummary(state.gathering)}</h2>
      </AppTitle>
      <p className="app-gathering-hint">{state.gathering.event.title}</p>
      {myResponse !== undefined && (
        <div className="app-gathering-response" role="group" aria-label="Твой ответ">
          {RESPONSE_ACTIONS.map(({ value, label }) => (
            <AppButton key={value} aria-pressed={value === myResponse} disabled={responding || value === myResponse} onClick={() => onRespond(value)}>
              {label}
            </AppButton>
          ))}
        </div>
      )}
      {failed && <AppState error>Не удалось отправить ответ.</AppState>}
      {state.gathering.chatLink !== null && (
        <AppButton tone="secondary" onClick={() => openExternalLink(state.gathering.chatLink!)}>
          В чат сбора
        </AppButton>
      )}
      <ul className="app-gathering-invitees">
        {state.gathering.invitees.map(({ friend, response }) => (
          <li key={friend.id} className="app-gathering-invitee">
            <span className="app-gathering-friend-name">{friend.name}</span>
            <span className={`app-gathering-friend-status app-gathering-friend-status--${response}`}>{INVITEE_RESPONSE_LABELS[response]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function GatheringStatusPage({ id }: { id: string }) {
  const auth = useAuth();
  const myUserId = auth.status === "authenticated" ? auth.user.id : null;
  const [state, setState] = useState<GatheringStatusState>({ status: "loading" });
  const [responding, setResponding] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    apiClient.getGathering(id).then(
      (gathering) => {
        if (alive) setState({ status: "ready", gathering });
      },
      () => {
        if (alive) setState({ status: "error" });
      },
    );
    return () => {
      alive = false;
    };
  }, [id]);

  const respond = (response: InviteeResponse) => {
    if (state.status !== "ready" || responding) return;
    setResponding(true);
    setFailed(false);
    apiClient.respondToGathering(state.gathering.id, response).then(
      (gathering) => {
        setState({ status: "ready", gathering });
        setResponding(false);
      },
      () => {
        setFailed(true);
        setResponding(false);
      },
    );
  };

  return <GatheringStatusView state={state} myUserId={myUserId} responding={responding} failed={failed} onRespond={respond} />;
}
