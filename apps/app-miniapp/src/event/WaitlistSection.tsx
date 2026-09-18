// START_MODULE_CONTRACT
// PURPOSE: Waitlist block on the sold-out event page: join CTA, FIFO queue position, confirmation offer with a countdown and confirm/decline actions.
// SCOPE: Data via apiClient.joinWaitlist/getMyWaitlistEntry/confirmWaitlistOffer/declineWaitlistOffer (mock or live); presentational WaitlistView plus the WaitlistSection container; the user id is resolved by the caller, no navigation logic.
// DEPENDS: ../api/client.js (apiClient), @max-events/api-contracts (WaitlistEntry), ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - WaitlistState - union of the section states (loading / error / idle / waiting / offered)
// - formatOfferCountdown - m:ss label of the remaining confirmation window
// - WaitlistView - presentational: join CTA, queue position, offer countdown with confirm/decline buttons
// - WaitlistSection - container: loads the active entry, wires join/confirm/decline, ticks the offer countdown once per second
// END_MODULE_MAP

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../api/client";
import type { WaitlistEntry } from "@max-events/api-contracts";
import { AppButton, AppText, AppTitle } from "../ui/primitives";

export type WaitlistState = { status: "loading" } | { status: "error" } | { status: "idle" } | { status: "waiting"; position: number } | { status: "offered"; secondsLeft: number };

export function formatOfferCountdown(secondsLeft: number): string {
  const total = Math.max(0, Math.floor(secondsLeft));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

interface WaitlistViewProps {
  state: WaitlistState;
  onJoin: () => void;
  onConfirm: () => void;
  onDecline: () => void;
}

export function WaitlistView({ state, onJoin, onConfirm, onDecline }: WaitlistViewProps) {
  return (
    <section className="app-event">
      <div className="app-event-body">
        <AppTitle asChild>
          <h2 className="app-participation-title">Лист ожидания</h2>
        </AppTitle>
        {state.status === "loading" && <p className="app-state">Загрузка…</p>}
        {state.status === "error" && <p className="app-state app-state--error">Не удалось выполнить действие. Попробуй ещё раз.</p>}
        {state.status === "idle" && (
          <AppButton onClick={onJoin} stretched>
            Встать в лист ожидания
          </AppButton>
        )}
        {state.status === "waiting" && <AppText>Вы {state.position}-й в очереди</AppText>}
        {state.status === "offered" && (
          <>
            <AppText>Место освободилось! Подтверди участие за {formatOfferCountdown(state.secondsLeft)}</AppText>
            <AppButton onClick={onConfirm} stretched>
              Подтвердить
            </AppButton>
            <AppButton onClick={onDecline} stretched tone="secondary">
              Отказаться
            </AppButton>
          </>
        )}
      </div>
    </section>
  );
}

function secondsUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 1000));
}

export function WaitlistSection({ eventId, userId, onChanged }: { eventId: string; userId: string; onChanged?: () => void }) {
  const [entry, setEntry] = useState<WaitlistEntry | null>(null);
  const [phase, setPhase] = useState<"loading" | "error" | "ready">("loading");
  const [, setTick] = useState(0);

  const load = useCallback(() => {
    apiClient.getMyWaitlistEntry(eventId, userId).then(
      (next) => {
        setEntry(next);
        setPhase("ready");
      },
      () => setPhase("error"),
    );
  }, [eventId, userId]);
  useEffect(() => {
    load();
  }, [load]);

  const offeredUntil = entry?.status === "offered" ? entry.offeredUntil : null;
  useEffect(() => {
    if (offeredUntil === null) return;
    const timer = setInterval(() => {
      setTick((n) => n + 1);
      if (secondsUntil(offeredUntil) <= 0) load();
    }, 1000);
    return () => clearInterval(timer);
  }, [offeredUntil, load]);

  const join = useCallback(() => {
    setPhase("loading");
    apiClient.joinWaitlist(eventId, userId).then(load, () => setPhase("error"));
  }, [eventId, userId, load]);

  const confirm = useCallback(() => {
    if (entry === null) return;
    apiClient.confirmWaitlistOffer(entry.id).then(() => {
      onChanged?.();
      load();
    }, load);
  }, [entry, onChanged, load]);

  const decline = useCallback(() => {
    if (entry === null) return;
    apiClient.declineWaitlistOffer(entry.id).then(load, load);
  }, [entry, load]);

  const state: WaitlistState = phase === "loading" ? { status: "loading" } : phase === "error" ? { status: "error" } : entry === null ? { status: "idle" } : entry.status === "offered" && entry.offeredUntil !== null ? { status: "offered", secondsLeft: secondsUntil(entry.offeredUntil) } : entry.status === "waiting" ? { status: "waiting", position: entry.position } : { status: "idle" };

  return <WaitlistView state={state} onJoin={join} onConfirm={confirm} onDecline={decline} />;
}
