// START_MODULE_CONTRACT
// PURPOSE: «Собрать компанию» flow: pick friends in the FriendPicker sheet (avatar, nick, search), propose a meeting time, launch the gathering.
// SCOPE: Data via apiClient.getEvent + apiClient.getFriendAvailability(eventId), local selection state, launch via apiClient.createGathering, then navigation to the gathering screen; an empty friend graph offers «Пригласить в MAX» instead of a dead picker.
// DEPENDS: ../api/client.js (apiClient, FriendAvailability), ../friends/avatar.js, ../friends/friends-empty.js, ../friends/invite.js, ../routing/router.js, ../ui/FriendPicker.js, ../ui/WhenField.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - AVAILABILITY_LABELS - ru labels for friend availability (free/busy/unknown)
// - gatheringFriends - Friend[] the picker and the selected column share
// - GatheringFlowState - union of flow fetch states (loading / error / ready)
// - GatheringFlowView - presentational: selected people as a column, FriendPicker sheet, WhenField, launch CTA
// - GatheringFlowPage - route container: loads the event and availability, opens the picker on arrival, wires selection and launch
// END_MODULE_MAP

import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "../api/client";
import type { Friend, FriendAvailability } from "@max-events/api-contracts";
import { PersonAvatar } from "../friends/avatar";
import { FRIENDS_GRAPH_EMPTY_TEXT } from "../friends/friends-empty";
import { FriendsInviteButton, useInviteFriends } from "../friends/invite";
import { useRoute } from "../routing/router";
import { friendHandle } from "../ui/friend-handle";
import { FriendPicker } from "../ui/FriendPicker";
import { ActionIcon } from "../ui/icons";
import { AppButton, AppTitle, AppState } from "../ui/primitives";
import { WhenField } from "../ui/WhenField";

export const AVAILABILITY_LABELS: Record<FriendAvailability["availability"], string> = { free: "Свободен", busy: "Занят", unknown: "Неизвестно" };

export function gatheringFriends(rows: FriendAvailability[]): Friend[] {
  return rows.map((row) => row.friend);
}

export type GatheringFlowState = { status: "loading" } | { status: "error" } | { status: "ready"; eventTitle: string; defaultMeetingAt: string; friends: FriendAvailability[] };

interface GatheringFlowViewProps {
  state: GatheringFlowState;
  selected: string[];
  meetingAt: string;
  submitting: boolean;
  failed: boolean;
  picking: boolean;
  onSelected: (friendIds: string[]) => void;
  onMeetingAt: (value: string) => void;
  onLaunch: () => void;
  onOpenPicker: () => void;
  onClosePicker: () => void;
  onRetry?: () => void;
}

export function GatheringFlowView({ state, selected, meetingAt, submitting, failed, picking, onSelected, onMeetingAt, onLaunch, onOpenPicker, onClosePicker, onRetry }: GatheringFlowViewProps) {
  const inviteFriends = useInviteFriends();
  if (state.status === "loading") return <AppState>Загрузка…</AppState>;
  if (state.status === "error")
    return (
      <AppState error action={onRetry === undefined ? undefined : { label: "Повторить", onClick: onRetry }}>
        Не удалось загрузить друзей.
      </AppState>
    );
  const friends = gatheringFriends(state.friends);
  const picked = friends.filter((friend) => selected.includes(friend.id));
  return (
    <section className="app-gathering">
      <AppTitle asChild>
        <h2 className="app-section-title">Собрать компанию</h2>
      </AppTitle>
      <p className="app-gathering-hint">{state.eventTitle}</p>
      {friends.length === 0 ? (
        <>
          <AppState>{FRIENDS_GRAPH_EMPTY_TEXT}</AppState>
          <FriendsInviteButton onClick={inviteFriends} />
        </>
      ) : (
        <>
          {picked.length > 0 && (
            <ul className="app-we-form-people" aria-label="Кого позвать">
              {picked.map((friend) => (
                <li key={friend.id} className="app-we-form-person">
                  {friend.avatarUrl ? <img className="app-fpick-avatar" src={friend.avatarUrl} alt="" /> : <PersonAvatar id={friend.id} name={friend.name} size={36} />}
                  <span className="app-fpick-name">
                    {friend.name}
                    <span className="app-fpick-handle">@{friendHandle(friend)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="app-poll-more" onClick={onOpenPicker}>
            <ActionIcon name="plus" size={16} strokeWidth={2.8} />
            {picked.length === 0 ? "Выбрать людей" : "Изменить"}
          </button>
        </>
      )}
      <div className="app-gathering-time">
        Когда встречаемся
        <WhenField title="Когда встречаемся" label="Выбрать" value={meetingAt} onChange={onMeetingAt} />
      </div>
      <AppButton disabled={selected.length === 0 || meetingAt === "" || submitting} onClick={onLaunch} stretched>
        {submitting ? "Запускаем…" : "Запустить сбор"}
      </AppButton>
      {failed && <AppState error>Не удалось запустить сбор.</AppState>}
      {picking && (
        <FriendPicker
          title="Кого позвать"
          hint="Аватар и ник — найди по имени или пролистай список."
          friends={friends}
          selectedIds={selected}
          multiple
          confirmLabel="Готово"
          emptyText={FRIENDS_GRAPH_EMPTY_TEXT}
          onConfirm={(ids) => {
            onSelected(ids);
            onClosePicker();
          }}
          onClose={onClosePicker}
        />
      )}
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
  const [picking, setPicking] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const openedPicker = useRef(false);

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    Promise.all([apiClient.getEvent(eventId), apiClient.getFriendAvailability(eventId)]).then(
      ([event, friends]) => {
        if (!alive) return;
        setState({ status: "ready", eventTitle: event.title, defaultMeetingAt: event.startsAt.slice(0, 16), friends });
        if (!openedPicker.current && friends.length > 0) {
          openedPicker.current = true;
          setPicking(true);
        }
      },
      () => {
        if (alive) setState({ status: "error" });
      },
    );
    return () => {
      alive = false;
    };
  }, [eventId, attempt]);

  const effectiveMeetingAt = meetingAt || (state.status === "ready" ? state.defaultMeetingAt : "");

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

  return (
    <GatheringFlowView
      state={state}
      selected={selected}
      meetingAt={effectiveMeetingAt}
      submitting={submitting}
      failed={failed}
      picking={picking}
      onSelected={setSelected}
      onMeetingAt={setMeetingAt}
      onLaunch={launch}
      onOpenPicker={() => setPicking(true)}
      onClosePicker={() => setPicking(false)}
      onRetry={() => setAttempt((n) => n + 1)}
    />
  );
}
