// START_MODULE_CONTRACT
// PURPOSE: «Мои подписки»: what the viewer follows, and the way off each one — the block on the profile and the standalone screen behind it (макет, экран 38).
// SCOPE: SUBSCRIPTION_TYPE_LABELS and MySubscriptionsView are presentational only (the profile owns the data and the unsubscribe call there); SubscriptionsPage is the container of the standalone screen. Grouping by type and the per-target counters of экран 38 are wave 12 (T-014).
// DEPENDS: @max-events/api-contracts (Subscription, SubscriptionType), ../api/client.js (apiClient), ../ui/primitives.js
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - SUBSCRIPTION_TYPE_LABELS - ru labels for organizer / place / interest
// - MySubscriptionsView - presentational: followed targets by name with an unsubscribe action, empty state
// - SubscriptionsPage - container of the standalone screen: loads the follows, removes one, keeps the failed row in place
// END_MODULE_MAP

import { useCallback, useEffect, useState } from "react";
import type { Subscription, SubscriptionType } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { AppButton, AppSection, AppState } from "../ui/primitives";

export const SUBSCRIPTION_TYPE_LABELS: Record<SubscriptionType, string> = { organizer: "Организатор", place: "Место", interest: "Интерес" };

interface MySubscriptionsViewProps {
  subscriptions: Subscription[];
  /** The one being removed right now, so its button cannot be pressed twice. */
  removingId?: string | null;
  /** A failed unsubscribe leaves the row in place; without this the button would just look dead. */
  failed?: boolean;
  onUnsubscribe?: (subscriptionId: string) => void;
}

export function MySubscriptionsView({ subscriptions, removingId = null, failed = false, onUnsubscribe = () => {} }: MySubscriptionsViewProps) {
  return (
    <AppSection title="Мои подписки">
      {subscriptions.length === 0 ? (
        <p className="app-today-summary">Пока нет подписок — подпишитесь на организатора или место, и новые события придут в чат с ботом.</p>
      ) : (
        <ul className="app-participation-counters">
          {subscriptions.map((subscription) => (
            <li key={subscription.id} className="app-subscription-row">
              {SUBSCRIPTION_TYPE_LABELS[subscription.type]}: {subscription.title}
              <AppButton size="small" tone="secondary" disabled={removingId === subscription.id} onClick={() => onUnsubscribe(subscription.id)} aria-label={`Отписаться: ${subscription.title}`}>
                Отписаться
              </AppButton>
            </li>
          ))}
        </ul>
      )}
      {failed && <AppState error>Не удалось отписаться.</AppState>}
    </AppSection>
  );
}

export function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    apiClient.listSubscriptions().then(
      (list) => {
        if (!alive) return;
        setSubscriptions(list);
        setLoading(false);
      },
      () => {
        if (alive) setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  const unsubscribe = useCallback((subscriptionId: string) => {
    setRemovingId(subscriptionId);
    setFailed(false);
    apiClient.removeSubscription(subscriptionId).then(
      () => {
        setSubscriptions((current) => current.filter((item) => item.id !== subscriptionId));
        setRemovingId(null);
      },
      () => {
        setFailed(true);
        setRemovingId(null);
      },
    );
  }, []);

  if (loading) return <AppState>Загружаем подписки…</AppState>;
  return <MySubscriptionsView subscriptions={subscriptions} removingId={removingId} failed={failed} onUnsubscribe={unsubscribe} />;
}
