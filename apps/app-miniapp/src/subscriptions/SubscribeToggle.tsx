// START_MODULE_CONTRACT
// PURPOSE: Follow/unfollow control for one subscription target (organizer, place or interest).
// SCOPE: SubscribeToggleView renders the button and the failure line; SubscribeToggle loads the viewer's follows once, matches this target and toggles it via apiClient. The button appears on the event and place screens; new events reach the follower as a bot DM, so the control stays useful even where no DM is wired yet.
// DEPENDS: ../api/client.js (apiClient), @max-events/api-contracts (CreateSubscription, Subscription), ../ui/primitives.js
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - matchesSubscriptionTarget - whether a stored follow is this target
// - SubscribeToggleState - union of the follow-state fetch states (loading / failed / ready)
// - SubscribeToggleView - presentational: follow button with aria-pressed, retry when the state is unknown, failure line
// - SubscribeToggle - container: loads the follows, creates or removes this one
// END_MODULE_MAP

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../api/client";
import type { CreateSubscription, Subscription } from "@max-events/api-contracts";
import { AppButton, AppState } from "../ui/primitives";

export function matchesSubscriptionTarget(row: Subscription, target: CreateSubscription): boolean {
  if (row.type !== target.type) return false;
  if (target.type === "organizer") return row.organizerUserId === target.organizerUserId;
  if (target.type === "place") return row.placeId === target.placeId;
  return (row.interest ?? "").toLowerCase() === target.interest.toLowerCase();
}

export type SubscribeToggleState = { status: "loading" } | { status: "failed" } | { status: "ready"; subscriptionId: string | null };

interface SubscribeToggleViewProps {
  state: SubscribeToggleState;
  subscribeLabel: string;
  unsubscribeLabel: string;
  busy?: boolean;
  failed?: boolean;
  onToggle?: () => void;
  onRetry?: () => void;
}

export function SubscribeToggleView({ state, subscribeLabel, unsubscribeLabel, busy = false, failed = false, onToggle = () => {}, onRetry = () => {} }: SubscribeToggleViewProps) {
  // Until the follows are known the label would be a guess, and a button that flips under the finger
  // is worse than one that waits.
  if (state.status === "loading")
    return (
      <AppButton tone="secondary" stretched disabled>
        Проверяем подписку…
      </AppButton>
    );
  // Showing «Подписаться» here would be a guess too: a follower would press it, see the label flip to
  // «Отписаться», press again to fix it — and lose the subscription they already had.
  if (state.status === "failed")
    return (
      <AppState error action={{ label: "Повторить", onClick: onRetry }}>
        Не удалось проверить подписку.
      </AppState>
    );
  const subscribed = state.subscriptionId !== null;
  return (
    <>
      <AppButton tone="secondary" stretched aria-pressed={subscribed} disabled={busy} onClick={onToggle}>
        {subscribed ? unsubscribeLabel : subscribeLabel}
      </AppButton>
      {failed && <AppState error>Не удалось изменить подписку.</AppState>}
    </>
  );
}

interface SubscribeToggleProps {
  target: CreateSubscription;
  subscribeLabel: string;
  unsubscribeLabel: string;
}

export function SubscribeToggle({ target, subscribeLabel, unsubscribeLabel }: SubscribeToggleProps) {
  const [state, setState] = useState<SubscribeToggleState>({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const targetKey = JSON.stringify(target);

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    setBusy(false);
    setFailed(false);
    apiClient.listSubscriptions().then(
      (rows) => {
        if (alive) setState({ status: "ready", subscriptionId: rows.find((row) => matchesSubscriptionTarget(row, target))?.id ?? null });
      },
      () => {
        if (alive) setState({ status: "failed" });
      },
    );
    return () => {
      alive = false;
    };
    // targetKey, not target: a caller building the object inline must not restart the fetch every render.
  }, [targetKey, attempt]);

  const onToggle = useCallback(() => {
    if (state.status !== "ready" || busy) return;
    setBusy(true);
    setFailed(false);
    const current = state.subscriptionId;
    const action = current === null ? apiClient.createSubscription(target).then((row) => row.id) : apiClient.removeSubscription(current).then(() => null);
    action.then(
      (subscriptionId) => {
        setState({ status: "ready", subscriptionId });
        setBusy(false);
      },
      () => {
        setFailed(true);
        setBusy(false);
      },
    );
  }, [state, busy, target]);

  return <SubscribeToggleView state={state} subscribeLabel={subscribeLabel} unsubscribeLabel={unsubscribeLabel} busy={busy} failed={failed} onToggle={onToggle} onRetry={() => setAttempt((value) => value + 1)} />;
}
