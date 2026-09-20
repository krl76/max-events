// START_MODULE_CONTRACT
// PURPOSE: Gathering status screen: every invitee answer («подтвердил / смотрит / занят»), the «Ты + N из M» summary and the chat link button when the gathering chat exists.
// SCOPE: Data via apiClient.getGathering (mock or live); presentational rendering of invitee responses; no actions on responses.
// DEPENDS: ../api/client.js (apiClient), @max-events/api-contracts (Gathering, InviteeResponse), ../max/bridge.js (openExternalLink), ../ui/primitives.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - INVITEE_RESPONSE_LABELS - ru labels for invitee responses (accepted/considering/busy)
// - gatheringSummary - «Ты + accepted из total» aggregate line
// - GatheringStatusState - union of gathering fetch states (loading / error / ready)
// - GatheringStatusView - presentational: summary title, event hint, invitee answer list, chat link button
// - GatheringStatusPage - route container: loads the gathering by id
// END_MODULE_MAP

import { useEffect, useState } from "react";
import { apiClient } from "../api/client";
import type { Gathering, InviteeResponse } from "@max-events/api-contracts";
import { openExternalLink } from "../max/bridge";
import { AppButton, AppTitle, AppState } from "../ui/primitives";

export const INVITEE_RESPONSE_LABELS: Record<InviteeResponse, string> = { accepted: "подтвердил", considering: "смотрит", busy: "занят" };

export function gatheringSummary(gathering: Gathering): string {
  const accepted = gathering.invitees.filter((invitee) => invitee.response === "accepted").length;
  return `Ты + ${accepted} из ${gathering.invitees.length}`;
}

export type GatheringStatusState = { status: "loading" } | { status: "error" } | { status: "ready"; gathering: Gathering };

export function GatheringStatusView({ state }: { state: GatheringStatusState }) {
  if (state.status === "loading") return <AppState>Загрузка…</AppState>;
  if (state.status === "error") return <AppState error>Не удалось загрузить сбор.</AppState>;
  return (
    <section className="app-gathering">
      <AppTitle asChild>
        <h2 className="app-section-title">{gatheringSummary(state.gathering)}</h2>
      </AppTitle>
      <p className="app-gathering-hint">{state.gathering.event.title}</p>
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
  const [state, setState] = useState<GatheringStatusState>({ status: "loading" });
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
  return <GatheringStatusView state={state} />;
}
