// START_MODULE_CONTRACT
// PURPOSE: Friends feed screen "Твои люди идут": friends grouped with the events they attend, join CTA to the event page.
// SCOPE: Data via apiClient.getFriendsActivity (mock or live backend); grouping by friend; CTA navigates to the event route; empty/loading/error states.
// DEPENDS: ../api/client.js (apiClient, FriendActivityByFriend), @max-events/api-contracts (FriendActivityByFriendSchema), ../routing/router.js, ../catalog/CatalogPage.js (formatStartsAt), ../event/EventPage.js (PARTICIPATION_STATUS_LABELS, DEMO_USER_ID), ../auth/AuthContext.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - FriendsState - union of friends feed fetch states (loading / error / ready)
// - initials - "Анна Соколова" -> "АС" for the initials avatar
// - FriendsView - presentational: friend groups with avatar, name, event cards and join CTA, empty state
// - FriendsPage - route container: resolves the user id, loads the friends feed, wires the join navigation
// END_MODULE_MAP

import { useEffect, useState } from "react";
import { apiClient } from "../api/client";
import type { FriendActivityByFriend } from "@max-events/api-contracts";
import { useAuth } from "../auth/AuthContext";
import { formatStartsAt } from "../catalog/CatalogPage";
import { DEMO_USER_ID, PARTICIPATION_STATUS_LABELS } from "../event/EventPage";
import { useRoute } from "../routing/router";

export type FriendsState = { status: "loading" } | { status: "error" } | { status: "ready"; groups: FriendActivityByFriend[] };

export function initials(name: string): string {
  return name
    .split(" ")
    .map((word) => word.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface FriendsViewProps {
  state: FriendsState;
  onJoin: (eventId: string) => void;
}

export function FriendsView({ state, onJoin }: FriendsViewProps) {
  if (state.status === "loading") return <p className="app-state">Загрузка…</p>;
  if (state.status === "error") return <p className="app-state app-state--error">Не удалось загрузить события друзей.</p>;
  if (state.groups.length === 0) return <p className="app-state">Пока никто из друзей никуда не идёт</p>;

  return (
    <>
      {state.groups.map((group) => (
        <section key={group.friend.id} className="app-friends-group">
          <div className="app-friends-person">
            <span className="app-friends-avatar" aria-hidden="true">
              {initials(group.friend.name)}
            </span>
            <span className="app-friends-name">{group.friend.name}</span>
          </div>
          {group.events.map(({ event, participationStatus }) => (
            <article key={event.id} className="app-card">
              <div className="app-card-body">
                <span className="app-card-title">{event.title}</span>
                <span className="app-card-subtitle">
                  {formatStartsAt(event.startsAt)} · {PARTICIPATION_STATUS_LABELS[participationStatus]}
                </span>
                <button type="button" className="app-friends-join" onClick={() => onJoin(event.id)}>
                  Присоединиться
                </button>
              </div>
            </article>
          ))}
        </section>
      ))}
    </>
  );
}

export function FriendsPage() {
  const auth = useAuth();
  const userId = auth.status === "authenticated" ? auth.user.id : DEMO_USER_ID;
  const { navigate } = useRoute();
  const [state, setState] = useState<FriendsState>({ status: "loading" });

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    apiClient.getFriendsActivity(userId).then(
      (groups) => {
        if (alive) setState({ status: "ready", groups });
      },
      () => {
        if (alive) setState({ status: "error" });
      },
    );
    return () => {
      alive = false;
    };
  }, [userId]);

  return <FriendsView state={state} onJoin={(eventId) => navigate({ name: "event", id: eventId })} />;
}
