// START_MODULE_CONTRACT
// PURPOSE: «Подписчики»: who follows the viewer, opened by the counter in the profile header, with the follow-back action next to every name.
// SCOPE: The followers list only. The three catalog follow kinds live on ./MySubscriptions.tsx; this screen is the people half of the social graph. «Добавить» writes a mutual friendship.
// DEPENDS: @max-events/api-contracts (Friend), ../api/client.js (apiClient), ../auth/AuthContext.js, ../catalog/format.js (pluralRu), ../ui/primitives.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - personInitial - the letter standing in for a person: there are no photographs of people in the product
// - followersCountLabel - «8 подписчиков» over the list
// - FollowersView - presentational: the counter line, the rows with their follow-back action, the empty state
// - FollowersPage - container: loads both follow directions, writes the follow back, keeps the row in place when the write fails
// END_MODULE_MAP

import { useCallback, useEffect, useState } from "react";
import type { Friend } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { pluralRu } from "../catalog/format";
import { useRoute } from "../routing/router";
import { AppState } from "../ui/primitives";

/** Фотографий людей в продукте нет, поэтому лицо человека в списке — буква его имени. */
export function personInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}

export function followersCountLabel(count: number): string {
  return `${count} ${pluralRu(count, "подписчик", "подписчика", "подписчиков")}`;
}

interface FollowersViewProps {
  followers: Friend[];
  /** Ids of the people the viewer follows back; a name in this set carries no button, only the state. */
  followingIds?: string[];
  /** The one being written right now, so the button cannot be pressed twice. */
  pendingId?: string | null;
  /** A failed follow leaves the row as it was; without this the button would just look dead. */
  failed?: boolean;
  onFollowBack?: (userId: string) => void;
  onOpenPerson?: (userId: string) => void;
}

export function FollowersView({ followers, followingIds = [], pendingId = null, failed = false, onFollowBack = () => {}, onOpenPerson }: FollowersViewProps) {
  if (followers.length === 0) {
    return <AppState hint="Публикуйте впечатления — так вас находят.">Вас пока никто не добавил</AppState>;
  }
  return (
    <section className="app-followers" aria-label="Подписчики">
      <p className="app-followers-count">{followersCountLabel(followers.length)}</p>
      {followers.map((person) => {
        const mutual = followingIds.includes(person.id);
        return (
          <div key={person.id} className="app-follower">
            {onOpenPerson === undefined ? (
              <>
                <span className="app-follower-face" aria-hidden="true">
                  {personInitial(person.name)}
                </span>
                <span className="app-follower-name">{person.name}</span>
              </>
            ) : (
              <button type="button" className="app-follower-open" onClick={() => onOpenPerson(person.id)}>
                <span className="app-follower-face" aria-hidden="true">
                  {personInitial(person.name)}
                </span>
                <span className="app-follower-name">{person.name}</span>
              </button>
            )}
            {mutual ? (
              <span className="app-follower-state">Друзья</span>
            ) : (
              <button type="button" className="app-follower-act" disabled={pendingId === person.id} aria-label={`Добавить: ${person.name}`} onClick={() => onFollowBack(person.id)}>
                Добавить
              </button>
            )}
          </div>
        );
      })}
      {failed && <AppState error>Не удалось добавить.</AppState>}
    </section>
  );
}

export function FollowersPage() {
  const auth = useAuth();
  const { navigate } = useRoute();
  const userId = auth.status === "authenticated" ? auth.user.id : null;
  const [followers, setFollowers] = useState<Friend[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (userId === null) return;
    let alive = true;
    // Both directions at once: the list is the followers, the follow-back state is the other one.
    Promise.all([apiClient.listFollowers(userId), apiClient.listFollowing(userId)]).then(
      ([incoming, outgoing]) => {
        if (!alive) return;
        setFollowers(incoming);
        setFollowingIds(outgoing.map((person) => person.id));
        setLoading(false);
      },
      () => {
        if (alive) setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [userId]);

  const followBack = useCallback(
    (personId: string) => {
      setPendingId(personId);
      setFailed(false);
      apiClient.addFriend(personId).then(
        () => {
          setFollowingIds((ids) => (ids.includes(personId) ? ids : [...ids, personId]));
          setPendingId(null);
        },
        () => {
          setFailed(true);
          setPendingId(null);
        },
      );
    },
    [],
  );

  if (userId === null) return <AppState>Откройте приложение внутри MAX, чтобы увидеть подписчиков.</AppState>;
  if (loading) return <AppState>Загружаем подписчиков…</AppState>;
  return <FollowersView followers={followers} followingIds={followingIds} pendingId={pendingId} failed={failed} onFollowBack={followBack} onOpenPerson={(id) => navigate({ name: "user", id })} />;
}
