// START_MODULE_CONTRACT
// PURPOSE: «Ближайшие события» — список событий выбранного города по времени начала, вход с поиска.
// SCOPE: Один экран. Карточки из apiClient.listEventCards с sort soon. Шапка и «Назад» — оболочка MAX.
// DEPENDS: ../api/client.js, ../routing/router.js, ../today/TodaySection.js, ../ui/primitives.js, ./EventPoster.js
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - UpcomingPage - container: soonest events in the opened city
// END_MODULE_MAP

import { useEffect, useState } from "react";
import { apiClient, type CatalogCard } from "../api/client";
import { useRoute } from "../routing/router";
import { dayKey } from "../today/TodaySection";
import { AppSkeleton, AppState } from "../ui/primitives";
import { EventPoster } from "./EventPoster";

export function UpcomingPage({ city }: { readonly city: string }) {
  const { navigate } = useRoute();
  const [cards, setCards] = useState<CatalogCard[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    setCards(null);
    apiClient.listEventCards({ city, sort: "soon", dateFrom: dayKey(new Date()), limit: 40 }).then(
      (rows) => {
        if (alive) setCards(rows);
      },
      () => {
        if (alive) setFailed(true);
      },
    );
    return () => {
      alive = false;
    };
  }, [city]);

  return (
    <section className="app-upcoming" aria-label="Ближайшие события">
      {failed ? <AppState error>Не удалось загрузить события.</AppState> : cards === null ? <AppSkeleton /> : cards.length === 0 ? <p className="app-upcoming-empty">Ближайших событий пока нет.</p> : cards.map((card) => <EventPoster key={card.event.id} card={card} onOpen={(id) => navigate({ name: "event", id })} />)}
    </section>
  );
}
