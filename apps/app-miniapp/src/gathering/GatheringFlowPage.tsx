// START_MODULE_CONTRACT
// PURPOSE: «Собрать компанию» flow: pick friends with their free/busy/unknown availability, propose a meeting time, launch the gathering (mock POST).
// SCOPE: Data via apiClient.getEvent + apiClient.getFriendAvailability(eventId), local selection state, launch via apiClient.createGathering, then navigation to the gathering screen.
// DEPENDS: ../api/client.js (apiClient, FriendAvailability), ../routing/router.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - AVAILABILITY_LABELS - ru labels for friend availability (free/busy/unknown)
// - GatheringFlowState - union of flow fetch states (loading / error / ready)
// - GatheringFlowView - presentational: friend chips with availability, datetime input, launch CTA
// - GatheringFlowPage - route container: loads the event and availability, wires selection and launch
// END_MODULE_MAP

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../api/client";
import type { FriendAvailability } from "@max-events/api-contracts";
import { useRoute } from "../routing/router";
import { AppButton, AppTitle } from "../ui/primitives";

export const AVAILABILITY_LABELS: Record<FriendAvailability["availability"], string> = { free: "Свободен", busy: "Занят", unknown: "Неизвестно" };

export type GatheringFlowState = { status: "loading" } | { status: "error" } | { status: "ready"; eventTitle: string; defaultMeetingAt: string; friends: FriendAvailability[] };

interface GatheringFlowViewProps {
  state: GatheringFlowState;
  selected: string[];
  meetingAt: string;
  submitting: boolean;
  failed: boolean;
  onToggle: (friendId: string) => void;
  onMeetingAt: (value: string) => void;
  onLaunch: () => void;
}

export function GatheringFlowView({ state, selected, meetingAt, submitting, failed, onToggle, onMeetingAt, onLaunch }: GatheringFlowViewProps) {
  if (state.status === "loading") return <p className="app-state">Загрузка…</p>;
  if (state.status === "error") return <p className="app-state app-state--error">Не удалось загрузить друзей.</p>;
  return (
    <section className="app-gathering">
      <AppTitle asChild>
        <h2 className="app-gathering-title">Собрать компанию</h2>
      </AppTitle>
      <p className="app-gathering-hint">{state.eventTitle}</p>
      <div className="app-gathering-friends" role="group" aria-label="Кого позвать">
        {state.friends.map(({ friend, availability }) => (
          <button key={friend.id} type="button" className="app-gathering-friend" aria-pressed={selected.includes(friend.id)} onClick={() => onToggle(friend.id)}>
            <span className="app-gathering-friend-name">{friend.name}</span>
            <span className={`app-gathering-friend-status app-gathering-friend-status--${availability}`}>{AVAILABILITY_LABELS[availability]}</span>
          </button>
        ))}
      </div>
      <label className="app-gathering-time">
        Когда встречаемся
        <input className="app-gathering-time-input" type="datetime-local" value={meetingAt} min={state.defaultMeetingAt} onChange={(change) => onMeetingAt(change.target.value)} />
      </label>
      <AppButton disabled={selected.length === 0 || meetingAt === "" || submitting} onClick={onLaunch} stretched>
        {submitting ? "Запускаем…" : "Запустить сбор"}
      </AppButton>
      {failed && <p className="app-state app-state--error">Не удалось запустить сбор.</p>}
    </section>
  );
}

export function GatheringFlowPage({ eventId }: { eventId: string }) {
  const { navigate } = useRoute();
  const [state, setState] = useState<GatheringFlowState>({ status: "loading" });
  const [selected, setSelected] = useState<string[]>([]);
  const [meetingAt, setMeetingAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    Promise.all([apiClient.getEvent(eventId), apiClient.getFriendAvailability(eventId)]).then(
      ([event, friends]) => {
        if (alive) setState({ status: "ready", eventTitle: event.title, defaultMeetingAt: event.startsAt.slice(0, 16), friends });
      },
      () => {
        if (alive) setState({ status: "error" });
      },
    );
    return () => {
      alive = false;
    };
  }, [eventId]);

  const effectiveMeetingAt = meetingAt || (state.status === "ready" ? state.defaultMeetingAt : "");

  const toggle = useCallback((friendId: string) => {
    setSelected((current) => (current.includes(friendId) ? current.filter((id) => id !== friendId) : [...current, friendId]));
  }, []);

  const launch = useCallback(() => {
    if (effectiveMeetingAt === "") return;
    setSubmitting(true);
    setFailed(false);
    apiClient.createGathering({ eventId, friendIds: selected, proposedMeetingAt: new Date(effectiveMeetingAt).toISOString() }).then(
      (gathering) => navigate({ name: "gathering", id: gathering.id }),
      () => {
        setSubmitting(false);
        setFailed(true);
      },
    );
  }, [eventId, effectiveMeetingAt, selected, navigate]);

  return <GatheringFlowView state={state} selected={selected} meetingAt={effectiveMeetingAt} submitting={submitting} failed={failed} onToggle={toggle} onMeetingAt={setMeetingAt} onLaunch={launch} />;
}
