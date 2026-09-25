// START_MODULE_CONTRACT
// PURPOSE: «Подписки» (макет, экран 38): everything the viewer follows — the three kinds the backend keeps (organizers, places, interests) and the people they follow — grouped, counted and each with its way out; plus the compact block the profile still embeds.
// SCOPE: SUBSCRIPTION_* tables, groupSubscriptions, SubscriptionsView and MySubscriptionsView are presentational only; SubscriptionsPage is the container of the standalone screen. Following a person is not a Subscription row (#501) — it is the follow set of экран 02 — so the people group comes in beside the three, from its own store, and the screen says where it comes from.
// DEPENDS: @max-events/api-contracts (Friend, Subscription, SubscriptionType), ../api/client.js (apiClient), ../auth/AuthContext.js, ../routing/router.js, ../ui/primitives.js, ../ui/icons.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - SUBSCRIPTION_TYPE_LABELS - ru labels for organizer / place / interest (singular, used by the profile block)
// - SUBSCRIPTION_TYPE_PLURALS - ru plural labels: the filter chips and the group headings of экран 38
// - SUBSCRIPTION_TYPES - the three grouped types in the order the screen lists them; the `user` type is drawn from the follow set as «Люди», not as a fourth group
// - SUBSCRIPTION_TYPE_ICONS - glyph per type: a building, a pin, a tag - not three identical circles
// - PEOPLE_SUBSCRIPTION_NOTE - the line that says where the people group comes from, since it is not a Subscription (#501)
// - PEOPLE_GROUP_HEADING - ru heading of the people group, the fourth one on the screen
// - SubscriptionFilter - "all", one of the three types, or the people group
// - subscriptionFilterLabel - «Все · 14» for the all-chip, the plural label for the other chips
// - groupSubscriptions - follows split into the three groups, in screen order, empty groups dropped
// - SubscriptionsView - экран 38 presentational: filter chips, grouped rows with unsubscribe, the people group and its note
// - MySubscriptionsView - compact presentational block the profile embeds: followed targets with an unsubscribe action
// - SubscriptionsPage - container of the standalone screen: loads the follows and the followed people, filters them, removes one, keeps the failed row in place
// END_MODULE_MAP

import { useCallback, useEffect, useState } from "react";
import { SubscriptionTypeSchema } from "@max-events/api-contracts";
import type { Friend, Subscription, SubscriptionType } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useRoute } from "../routing/router";
import { ActionIcon, type ActionIconName } from "../ui/icons";
import { AppButton, AppChip, AppSection, AppState } from "../ui/primitives";

export const SUBSCRIPTION_TYPE_LABELS: Record<SubscriptionType, string> = { organizer: "Организатор", place: "Место", interest: "Интерес", user: "Пользователь" };

export const SUBSCRIPTION_TYPE_PLURALS: Record<SubscriptionType, string> = { organizer: "Организаторы", place: "Места", interest: "Интересы", user: "Люди" };

/** The enum order is the screen order; taking it from the contract keeps a fourth kind from being invented here. */
export const SUBSCRIPTION_TYPES: readonly SubscriptionType[] = SubscriptionTypeSchema.options.filter((type) => type !== "user");

export const SUBSCRIPTION_TYPE_ICONS: Record<SubscriptionType, ActionIconName> = { organizer: "building", place: "pin", interest: "tag", user: "user" };

/**
 * The people group is here but it is not drawn from Subscription rows: «Подписаться» in a profile writes
 * the follow set of экран 02, and that set is what the group lists. The backend also knows a `user`
 * subscription type (the onboarding follow of a person); those rows are left out of the three groups
 * and of the counter here, so a person is never counted twice. The screen shows both stores and says
 * which is which — one counter over two stores is the honest reading of «подписки».
 */
export const PEOPLE_SUBSCRIPTION_NOTE = "Подписки на людей хранятся отдельно от подписок на организаторов, места и интересы.";

export const PEOPLE_GROUP_HEADING = "Люди";

export type SubscriptionFilter = "all" | SubscriptionType | "people";

/** Only the all-chip carries a number: every other chip counts itself in the group heading below. */
export function subscriptionFilterLabel(filter: SubscriptionFilter, subscriptions: Subscription[], peopleCount = 0): string {
  if (filter === "all") return `Все · ${subscriptions.filter((row) => row.type !== "user").length + peopleCount}`;
  return filter === "people" ? PEOPLE_GROUP_HEADING : SUBSCRIPTION_TYPE_PLURALS[filter];
}

export function groupSubscriptions(subscriptions: Subscription[]): Array<{ type: SubscriptionType; rows: Subscription[] }> {
  return SUBSCRIPTION_TYPES.map((type) => ({ type, rows: subscriptions.filter((subscription) => subscription.type === type) })).filter((group) => group.rows.length > 0);
}

interface SubscriptionsViewProps {
  subscriptions: Subscription[];
  /** People the viewer follows: the fourth group, coming from the follow set rather than from `subscriptions` (#501). */
  people?: Friend[];
  filter?: SubscriptionFilter;
  onFilter?: (filter: SubscriptionFilter) => void;
  /** The one being removed right now, so its button cannot be pressed twice; a person is keyed by their user id. */
  removingId?: string | null;
  /** A failed unsubscribe leaves the row in place; without this the button would just look dead. */
  failed?: boolean;
  onUnsubscribe?: (subscriptionId: string) => void;
  onUnfollow?: (userId: string) => void;
  onOpenPlace?: (placeId: string) => void;
}

export function SubscriptionsView({ subscriptions, people = [], filter = "all", onFilter = () => {}, removingId = null, failed = false, onUnsubscribe = () => {}, onUnfollow = () => {}, onOpenPlace }: SubscriptionsViewProps) {
  const shown = filter === "all" ? subscriptions : filter === "people" ? [] : subscriptions.filter((subscription) => subscription.type === filter);
  const shownPeople = filter === "all" || filter === "people" ? people : [];
  const total = subscriptions.length + people.length;
  return (
    <section className="app-subs" aria-label="Подписки">
      <div className="app-subs-filters" role="group" aria-label="Типы подписок">
        {/* Чип «Люди» стоит последним: три типа группируются из подписок, люди приходят из набора подписок на людей */}
        {(["all", ...SUBSCRIPTION_TYPES, "people"] as SubscriptionFilter[]).map((candidate) => (
          <AppChip key={candidate} pressed={filter === candidate} onClick={() => onFilter(candidate)}>
            {subscriptionFilterLabel(candidate, subscriptions, people.length)}
          </AppChip>
        ))}
      </div>
      {total === 0 && <AppState hint={PEOPLE_SUBSCRIPTION_NOTE}>Пока нет подписок — подпишитесь на организатора или место, и новые события придут в чат с ботом.</AppState>}
      {total > 0 && shown.length + shownPeople.length === 0 && <AppState>В этой группе пока пусто.</AppState>}
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
      {shownPeople.length > 0 && (
        <div>
          <p className="app-subs-group">
            {PEOPLE_GROUP_HEADING} · {shownPeople.length}
          </p>
          {shownPeople.map((person) => (
            <div key={person.id} className="app-subs-row">
              {/* Чужого профиля в приложении нет, поэтому строка человека никуда не ведёт — как организатор и интерес */}
              <span className="app-subs-target">
                <span className="app-subs-mark app-subs-mark--people" aria-hidden="true">
                  <ActionIcon name="users" size={20} strokeWidth={2.2} />
                </span>
                <span className="app-subs-title">{person.name}</span>
              </span>
              <button type="button" className="app-subs-off" disabled={removingId === person.id} aria-label={`Отписаться: ${person.name}`} onClick={() => onUnfollow(person.id)}>
                Отписаться
              </button>
            </div>
          ))}
        </div>
      )}
      {failed && <AppState error>Не удалось отписаться.</AppState>}
      {total > 0 && (
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
  const auth = useAuth();
  const userId = auth.status === "authenticated" ? auth.user.id : null;
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [people, setPeople] = useState<Friend[]>([]);
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

  useEffect(() => {
    if (userId === null) return;
    let alive = true;
    // The people group is a second store, so it loads on its own: the three kinds must not wait for it.
    apiClient.listFollowing(userId).then(
      (list) => {
        if (alive) setPeople(list);
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [userId]);

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

  const unfollow = useCallback(
    (personId: string) => {
      setRemovingId(personId);
      setFailed(false);
      // The follow set is written whole, not toggled: PUT /friends/follows is the only writer there is.
      apiClient.followFriends(people.filter((person) => person.id !== personId).map((person) => person.id)).then(
        (stored) => {
          setPeople((current) => current.filter((person) => stored.includes(person.id)));
          setRemovingId(null);
        },
        () => {
          setFailed(true);
          setRemovingId(null);
        },
      );
    },
    [people],
  );

  if (loading) return <AppState>Загружаем подписки…</AppState>;
  return <SubscriptionsView subscriptions={subscriptions} people={people} filter={filter} onFilter={setFilter} removingId={removingId} failed={failed} onUnsubscribe={unsubscribe} onUnfollow={unfollow} onOpenPlace={(placeId) => navigate({ name: "place", id: placeId })} />;
}
