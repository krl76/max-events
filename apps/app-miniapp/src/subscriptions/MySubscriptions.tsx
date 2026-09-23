// START_MODULE_CONTRACT
// PURPOSE: «Мои подписки» block on the profile: what the viewer follows, and the way off each one.
// SCOPE: SUBSCRIPTION_TYPE_LABELS and MySubscriptionsView — presentational only, including the line a failed unsubscribe leaves behind; the profile owns the data and the unsubscribe call, as it does for every other block on that screen.
// DEPENDS: @max-events/api-contracts (Subscription, SubscriptionType), ../ui/primitives.js
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - SUBSCRIPTION_TYPE_LABELS - ru labels for organizer / place / interest
// - MySubscriptionsView - presentational: followed targets by name with an unsubscribe action, empty state
// END_MODULE_MAP

import type { Subscription, SubscriptionType } from "@max-events/api-contracts";
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
