// START_MODULE_CONTRACT
// PURPOSE: «Подписки» (макет, экран 38): the three kinds the backend keeps — organizers, places, interests — grouped, counted and each with its way out; plus the compact block the profile still embeds.
// SCOPE: SUBSCRIPTION_* tables, groupSubscriptions, SubscriptionsView and MySubscriptionsView are presentational only; SubscriptionsPage is the container of the standalone screen. Following a person is not a subscription type the backend has (#501) and never joins these three; the screen says so out loud.
// DEPENDS: @max-events/api-contracts (Subscription, SubscriptionType), ../api/client.js (apiClient), ../routing/router.js, ../ui/primitives.js, ../ui/icons.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - SUBSCRIPTION_TYPE_LABELS - ru labels for organizer / place / interest (singular, used by the profile block)
// - SUBSCRIPTION_TYPE_PLURALS - ru plural labels: the filter chips and the group headings of экран 38
// - SUBSCRIPTION_TYPES - the three types in the order the screen lists them
// - SUBSCRIPTION_TYPE_ICONS - glyph per type: a building, a pin, a tag - not three identical circles
// - PEOPLE_SUBSCRIPTION_NOTE - the line that keeps following a person out of this list (#501)
// - SubscriptionFilter - "all" or one of the three types
// - subscriptionFilterLabel - «Все · 14» for the all-chip, the plural label for a type chip
// - groupSubscriptions - follows split into the three groups, in screen order, empty groups dropped
// - SubscriptionsView - экран 38 presentational: filter chips, grouped rows with unsubscribe, the people note
// - MySubscriptionsView - compact presentational block the profile embeds: followed targets with an unsubscribe action
// - SubscriptionsPage - container of the standalone screen: loads the follows, filters them, removes one, keeps the failed row in place
// END_MODULE_MAP

import { useCallback, useEffect, useState } from "react";
import { SubscriptionTypeSchema } from "@max-events/api-contracts";
import type { Subscription, SubscriptionType } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { useRoute } from "../routing/router";
import { ActionIcon, type ActionIconName } from "../ui/icons";
import { AppButton, AppChip, AppSection, AppState } from "../ui/primitives";

export const SUBSCRIPTION_TYPE_LABELS: Record<SubscriptionType, string> = { organizer: "Организатор", place: "Место", interest: "Интерес" };

export const SUBSCRIPTION_TYPE_PLURALS: Record<SubscriptionType, string> = { organizer: "Организаторы", place: "Места", interest: "Интересы" };

/** The enum order is the screen order; taking it from the contract keeps a fourth kind from being invented here. */
export const SUBSCRIPTION_TYPES: readonly SubscriptionType[] = SubscriptionTypeSchema.options;

export const SUBSCRIPTION_TYPE_ICONS: Record<SubscriptionType, ActionIconName> = { organizer: "building", place: "pin", interest: "tag" };

/** Экран 38 spells this out: «Подписаться» on a friend's profile is a different thing the backend does not keep (#501). */
export const PEOPLE_SUBSCRIPTION_NOTE = "Подписки на людей живут отдельно: кнопка «Подписаться» в профиле друга сюда не попадает.";

export type SubscriptionFilter = "all" | SubscriptionType;

/** Only the all-chip carries a number: a type chip counts itself in the group heading below. */
export function subscriptionFilterLabel(filter: SubscriptionFilter, subscriptions: Subscription[]): string {
  return filter === "all" ? `Все · ${subscriptions.length}` : SUBSCRIPTION_TYPE_PLURALS[filter];
}

export function groupSubscriptions(subscriptions: Subscription[]): Array<{ type: SubscriptionType; rows: Subscription[] }> {
  return SUBSCRIPTION_TYPES.map((type) => ({ type, rows: subscriptions.filter((subscription) => subscription.type === type) })).filter((group) => group.rows.length > 0);
}

interface SubscriptionsViewProps {
  subscriptions: Subscription[];
  filter?: SubscriptionFilter;
  onFilter?: (filter: SubscriptionFilter) => void;
  /** The one being removed right now, so its button cannot be pressed twice. */
  removingId?: string | null;
  /** A failed unsubscribe leaves the row in place; without this the button would just look dead. */
  failed?: boolean;
  onUnsubscribe?: (subscriptionId: string) => void;
  onOpenPlace?: (placeId: string) => void;
}

export function SubscriptionsView({ subscriptions, filter = "all", onFilter = () => {}, removingId = null, failed = false, onUnsubscribe = () => {}, onOpenPlace }: SubscriptionsViewProps) {
  const shown = filter === "all" ? subscriptions : subscriptions.filter((subscription) => subscription.type === filter);
  return (
    <section className="app-subs" aria-label="Подписки">
      <div className="app-subs-filters" role="group" aria-label="Типы подписок">
        {(["all", ...SUBSCRIPTION_TYPES] as SubscriptionFilter[]).map((candidate) => (
          <AppChip key={candidate} pressed={filter === candidate} onClick={() => onFilter(candidate)}>
            {subscriptionFilterLabel(candidate, subscriptions)}
          </AppChip>
        ))}
      </div>
      {subscriptions.length === 0 && <AppState hint={PEOPLE_SUBSCRIPTION_NOTE}>Пока нет подписок — подпишитесь на организатора или место, и новые события придут в чат с ботом.</AppState>}
      {subscriptions.length > 0 && shown.length === 0 && <AppState>В этой группе пока пусто.</AppState>}
      {groupSubscriptions(shown).map(({ type, rows }) => (
        <div key={type}>
          <p className="app-subs-group">
            {SUBSCRIPTION_TYPE_PLURALS[type]} · {rows.length}
          </p>
          {rows.map((subscription) => {
            // Only a place has a screen behind it today; an organizer and an interest have none, so
            // their rows stay plain text rather than pretending to lead somewhere.
            const open = subscription.type === "place" && subscription.placeId !== null && onOpenPlace !== undefined ? onOpenPlace : null;
            const body = (
              <>
                <span className={`app-subs-mark app-subs-mark--${type}`} aria-hidden="true">
                  <ActionIcon name={SUBSCRIPTION_TYPE_ICONS[type]} size={20} strokeWidth={2.2} />
                </span>
                {/* One line, not two: the design's second line («34 события · выставки и лекции») is
                    copy the Subscription contract does not carry, and the group heading already names the type. */}
                <span className="app-subs-title">{subscription.title}</span>
              </>
            );
            return (
              <div key={subscription.id} className="app-subs-row">
                {open === null ? (
                  <span className="app-subs-target">{body}</span>
                ) : (
                  <button type="button" className="app-subs-target app-subs-target--link" onClick={() => open(subscription.placeId!)}>
                    {body}
                  </button>
                )}
                <button type="button" className="app-subs-off" disabled={removingId === subscription.id} aria-label={`Отписаться: ${subscription.title}`} onClick={() => onUnsubscribe(subscription.id)}>
                  Отписаться
                </button>
              </div>
            );
          })}
        </div>
      ))}
      {failed && <AppState error>Не удалось отписаться.</AppState>}
      {subscriptions.length > 0 && (
        <p className="app-subs-note">
          <ActionIcon name="alert" size={18} strokeWidth={2.2} />
          <span>{PEOPLE_SUBSCRIPTION_NOTE}</span>
        </p>
      )}
    </section>
  );
}

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
  const { navigate } = useRoute();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<SubscriptionFilter>("all");
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
  return <SubscriptionsView subscriptions={subscriptions} filter={filter} onFilter={setFilter} removingId={removingId} failed={failed} onUnsubscribe={unsubscribe} onOpenPlace={(placeId) => navigate({ name: "place", id: placeId })} />;
}
