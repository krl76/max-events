// START_MODULE_CONTRACT
// PURPOSE: Friends feed screen "Твои люди идут": friends grouped with the events they attend, join CTA to the event page.
// SCOPE: Data via apiClient.getFriendsActivity (mock or live backend); grouping by friend; CTA navigates to the event route; empty/loading/error states.
// DEPENDS: ../api/client.js (apiClient, FriendActivityByFriend), @max-events/api-contracts (FriendActivityByFriendSchema), ../routing/router.js, ../catalog/CatalogPage.js (formatStartsAt), ../event/EventPage.js (PARTICIPATION_STATUS_LABELS), ../auth/AuthContext.js, ../ui/theme.css
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
import { PARTICIPATION_STATUS_LABELS } from "../event/EventPage";
import { useRoute } from "../routing/router";
import { AppAvatar, AppButton, AppState } from "../ui/primitives";

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
  if (state.status === "loading") return <AppState>Загрузка…</AppState>;
  if (state.status === "error") return <AppState error>Не удалось загрузить события друзей.</AppState>;
  if (state.groups.length === 0) return <AppState>Пока никто из друзей никуда не идёт</AppState>;

  return (
    <>
      {state.groups.map((group) => (
        <section key={group.friend.id} className="app-friends-group">
          <div className="app-friends-person">
            <AppAvatar size={44}>{initials(group.friend.name)}</AppAvatar>
            <span className="app-friends-name">{group.friend.name}</span>
          </div>
          {group.events.map(({ event, participationStatus }) => (
            <article key={event.id} className="app-card app-card--row">
              <div className="app-card-media" />
              <div className="app-card-body">
                <span className="app-card-title">{event.title}</span>
                <span className="app-card-subtitle">{formatStartsAt(event.startsAt)}</span>
                <span className="app-today-chip">{PARTICIPATION_STATUS_LABELS[participationStatus]}</span>
                <AppButton className="app-friends-join" size="small" onClick={() => onJoin(event.id)}>
                  Присоединиться
                </AppButton>
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
  const userId = auth.status === "authenticated" ? auth.user.id : null;
  const { navigate } = useRoute();
  const [state, setState] = useState<FriendsState>({ status: "loading" });

  useEffect(() => {
    if (userId === null) return;
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
