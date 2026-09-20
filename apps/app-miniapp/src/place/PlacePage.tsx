// START_MODULE_CONTRACT
// PURPOSE: Place social page (P2-11-c): «место как социальный объект» — today events, friend visits, people rating, popularity today, personal history, a «Я здесь» check-in and a «Пожаловаться» control.
// SCOPE: Data via apiClient.getPlacePage + getPlace (mock or live); empty data per block, not a page error; no navigation logic beyond event cards.
// DEPENDS: ../api/client.js (apiClient), @max-events/api-contracts (PlacePage, PlaceFriendVisit), ../auth/AuthContext.js, ../catalog/CatalogPage.js (CATEGORY_LABELS, formatStartsAt), ../catalog/format.js (pluralRu), ../event/ReviewSection.js (RatingView), ../routing/router.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PlacePageState - union of place page fetch states (loading / error / ready)
// - friendVisitLabel - ru line per friend visit («была здесь 3 раза» / «идёт сегодня»)
// - PlacePageView - presentational: place title/address, the five social blocks with empty states
// - PlacePage - route container: resolves the user id, loads the aggregate, wires event card navigation; records the page view fire-and-forget once auth resolved (#196)
// END_MODULE_MAP

import { useEffect, useState } from "react";
import { apiClient, trackPageView } from "../api/client";
import type { Place, PlaceFriendVisit, PlacePage as PlacePageAggregate } from "@max-events/api-contracts";
import { useAuth } from "../auth/AuthContext";
import { CATEGORY_LABELS, formatStartsAt } from "../catalog/CatalogPage";
import { pluralRu } from "../catalog/format";
import { RatingView } from "../event/ReviewSection";
import { ReportButton } from "../event/ReportButton";
import { useRoute } from "../routing/router";
import { AppAvatar, AppButton, AppTitle, AppState } from "../ui/primitives";

export type PlacePageState = { status: "loading" } | { status: "error" } | { status: "ready"; place: Place; page: PlacePageAggregate };

/** Friend line: «Анна была здесь 3 раза» / «Дима идёт сегодня»; the going-today line wins when both apply. */
export function friendVisitLabel(visit: PlaceFriendVisit): string {
  const name = visit.friend.name.split(" ")[0];
  if (visit.goingToday) return `${name} идёт сегодня`;
  // ponytail: gender heuristic for demo fixtures; male names on -а/-я (Дима, Никита, Илья) are listed as exceptions — per-friend gender arrives with the profile contract
  const maleExceptions = ["дима", "никита", "илья"];
  const lowerName = name.toLowerCase();
  const isFemale = /[ая]$/.test(lowerName) && !maleExceptions.includes(lowerName);
  const gendered = isFemale ? "была здесь" : "был здесь";
  return `${name} ${gendered} ${visit.visitsCount} ${pluralRu(visit.visitsCount, "раз", "раза", "раз")}`;
}

interface PlacePageViewProps {
  place: Place;
  page: PlacePageAggregate;
  userId: string;
  checkedIn: boolean;
  onCheckIn: () => void;
  onOpenEvent: (eventId: string) => void;
}

export function PlacePageView({ place, page, userId, checkedIn, onCheckIn, onOpenEvent }: PlacePageViewProps) {
  return (
    <article className="app-event">
      <div className="app-event-body">
        <AppTitle asChild>
          <h1 className="app-event-title">{place.title}</h1>
        </AppTitle>
        <p className="app-place-address">
          {place.address}, {place.city}
        </p>
        <p className="app-place-popularity">{page.popularityToday > 0 ? `${page.popularityToday} ${pluralRu(page.popularityToday, "человек", "человека", "человек")} были здесь сегодня` : "Сегодня здесь пока никого не было"}</p>
        {checkedIn ? (
          <AppButton disabled tone="secondary" stretched>
            Вы были здесь
          </AppButton>
        ) : (
          <AppButton onClick={onCheckIn} stretched tone="secondary">
            Я здесь
          </AppButton>
        )}

        <section className="app-place-block" aria-label="События сегодня">
          <h2 className="app-section-title">События сегодня</h2>
          {page.todayEvents.length === 0 ? (
            <AppState>На сегодня событий нет.</AppState>
          ) : (
            page.todayEvents.map((event) => (
              <button key={event.id} type="button" className="app-card app-card--link" onClick={() => onOpenEvent(event.id)}>
                <div className="app-card-body">
                  <span className="app-card-title">{event.title}</span>
                  <span className="app-card-subtitle">
                    {formatStartsAt(event.startsAt)} · {CATEGORY_LABELS[event.category]}
                  </span>
                </div>
              </button>
            ))
          )}
        </section>

        <section className="app-place-block" aria-label="Друзья">
          <h2 className="app-section-title">Друзья</h2>
          {page.friends.length === 0 ? (
            <AppState>Друзья пока не отмечались здесь.</AppState>
          ) : (
            <ul className="app-place-friends">
              {page.friends.map((visit) => (
                <li key={visit.friend.id} className="app-place-friend">
                  <AppAvatar size={36}>{visit.friend.name[0]}</AppAvatar>
                  <span className="app-friends-name">{friendVisitLabel(visit)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="app-place-block" aria-label="Оценки людей">
          <h2 className="app-section-title">Оценки людей</h2>
          {page.rating === null ? <AppState>Оценок пока нет.</AppState> : <RatingView rating={page.rating} />}
        </section>

        <section className="app-place-block" aria-label="Личная история">
          <h2 className="app-section-title">Личная история</h2>
          <p className="app-place-personal">{page.personalVisitsCount > 0 ? `Ты был здесь ${page.personalVisitsCount} ${pluralRu(page.personalVisitsCount, "раз", "раза", "раз")}` : "Ты пока не был здесь"}</p>
        </section>
      </div>
      <ReportButton target={{ placeId: place.id }} userId={userId} />
    </article>
  );
}

export function PlacePage({ id }: { id: string }) {
  const auth = useAuth();
  const userId = auth.status === "authenticated" ? auth.user.id : null;
  const { navigate } = useRoute();
  const [state, setState] = useState<PlacePageState>({ status: "loading" });
  // ponytail: session-only check-in state — the PlacePage aggregate has no per-user "was here" field, so a re-mount resets the button; backend-parity state is a separate task
  const [checkedIn, setCheckedIn] = useState(false);

  // Fire-and-forget page view (#196): a tracking failure must never break the page (trackPageView swallows rejections); skip until auth resolves so pre-login views are not recorded.
  useEffect(() => {
    if (userId === null) return;
    trackPageView({ targetType: "place", targetId: id });
  }, [id, userId]);

  useEffect(() => {
    if (userId === null) return;
    let alive = true;
    setState({ status: "loading" });
    Promise.all([apiClient.getPlace(id), apiClient.getPlacePage(id, userId)]).then(
      ([place, page]) => {
        if (alive) setState({ status: "ready", place, page });
      },
      () => {
        if (alive) setState({ status: "error" });
      },
    );
    return () => {
      alive = false;
    };
  }, [id, userId]);

  if (state.status === "loading") return <AppState>Загрузка…</AppState>;
  if (state.status === "error") return <AppState error>Не удалось загрузить место.</AppState>;
  const checkIn = () => {
    if (userId === null) return;
    apiClient.createCheckIn({ userId, placeId: id }).then(
      () => setCheckedIn(true),
      () => {},
    );
  };
  return <PlacePageView place={state.place} page={state.page} userId={userId ?? ""} checkedIn={checkedIn} onCheckIn={checkIn} onOpenEvent={(eventId) => navigate({ name: "event", id: eventId })} />;
}
