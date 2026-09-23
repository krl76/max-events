// START_MODULE_CONTRACT
// PURPOSE: Base mini-app layout: header (home: the feed header — wordmark, search, notifications bell; other routes: per-route title + back button), content, bottom tabbar with icons.
// SCOPE: Tab navigation between home/search/create/plans/profile (макет, экраны 03 и 08); children render routed pages. The organizer contour carries its own bar in ../organizer/OrganizerSpace.tsx.
// DEPENDS: ../api/client.js (apiClient), ../routing/router.js, ./theme.css, ./icons.js
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - FeedHeader - шапка ленты (макет, экран 03): словомарк «афиша MAX», поиск и колокольчик со счётчиком непрочитанных (индикатор: экрана уведомлений ещё нет, #494)
// - Layout - header + routed children + tabbar (icon + label per tab)
// - TABS - tabbar definitions with per-tab active predicate; the map (экран 16) and the swipe deck (экран 09) belong to the Поиск tab, because both are entered from search
// - ROUTE_TITLES - header title per route name (tab routes keep their tab labels)
// - routeTitle - header title for the current route
// - routeHasBack - back button shown on every non-tab route, the map included
// - routeHasHeader - header hidden wherever the screen draws its own chrome: the search/plans/profile tabs (profile renders its own gradient hero), the map and the swipe deck, which draw over the content, «После события», whose hero carries a close button instead of a back arrow, the two list screens (экраны 37 и 39), the we-groups and the votes (экраны 30-33), the micro-event feed and card (экраны 24 и 25), the friends list with its counter (экран 26) and the friend route (экран 28), the plan with its date, party size and «MAX СОБРАЛ» badge (экран 15), the assistant with its gradient hero (экран 10), and the fullscreen composers
// - routeIsFullscreen - the story and post composers (макет, экраны 05 и 06) own the whole viewport: no shell header, no tabbar, no gutters
// END_MODULE_MAP

import { useEffect, useState, type ReactNode } from "react";
import { apiClient } from "../api/client";
import { isTabRoute, useRoute, type Route } from "../routing/router";
import { ActionIcon, TabIconGlyph, type TabIcon } from "./icons";

export const TABS: Array<{ icon: TabIcon; label: string; active: (route: string) => boolean; route: "home" | "search" | "create" | "plans" | "profile" }> = [
  { icon: "feed", label: "Лента", route: "home", active: (name) => name === "home" || name === "micro" || name === "micro-event" },
  { icon: "search", label: "Поиск", route: "search", active: (name) => name === "search" || name === "map" || name === "swipe" || name === "assist" },
  { icon: "create", label: "Создать", route: "create", active: (name) => name === "create" || name === "story-new" || name === "feed-new" || name === "micro-new" || name === "plan-new" },
  { icon: "plans", label: "Планы", route: "plans", active: (name) => name === "plans" || name === "plan" || name === "day-route" || name === "calendar" || name === "lists" || name === "list" },
  { icon: "profile", label: "Профиль", route: "profile", active: (name) => name === "profile" || name === "friends" || name === "subscriptions" || name === "discovery" || name === "people" || name === "friend-route" },
];

export const ROUTE_TITLES: Record<Route["name"], string> = {
  home: "Лента",
  search: "Поиск",
  swipe: "Подбор мест",
  create: "Создать",
  map: "Карта",
  plans: "Планы",
  friends: "Друзья",
  calendar: "Календарь",
  profile: "Профиль",
  settings: "Настройки",
  subscriptions: "Подписки",
  event: "Событие",
  place: "Место",
  whereto: "Куда пойдём?",
  nearby: "Рядом со мной",
  discovery: "Друзья открыли",
  people: "Люди рядом",
  "gathering-new": "Сбор компании",
  gathering: "Сбор компании",
  plan: "План",
  "plan-new": "Свой план",
  "day-route": "Маршрут на день",
  lists: "Списки",
  list: "Список",
  achievements: "Достижения",
  "after-event": "После события",
  "micro-new": "Новое микро-событие",
  "story-new": "Новая история",
  "feed-new": "Новое впечатление",
  organizer: "Панель организатора",
  "we-groups": "Группы «Мы»",
  "we-group": "Группа «Мы»",
  vote: "Голосование",
  moderation: "Жалобы",
  "vote-new": "Новое голосование",
  micro: "Микро-события",
  "micro-event": "Микро-событие",
  "friend-route": "Маршрут друга",
  assist: "MAX AI ассистент",
};

export function routeTitle(route: Route): string {
  return ROUTE_TITLES[route.name];
}

export function routeHasBack(route: Route): boolean {
  return !isTabRoute(route.name);
}

// Экраны 08, 16 и 09 рисуют собственную шапку: карта — плавающую пилюлю «Поиск» поверх полотна,
// подбор свайпами — свою строку с кнопкой назад. Общая шапка перекрыла бы и то и другое.
// Экраны 30-33 тоже рисуют свою шапку: у списка групп рядом с заголовком «Создать», у группы —
// её название и меню, у голосований — название вопроса. Общая шапка стала бы второй.
// Экраны 24-29 — то же самое: у ленты микро-событий и у друзей своя строка с действием, у карточки
// микро-события и у маршрута друга — свой заголовок с кнопкой назад.
// План (15) несёт под названием дату, размер компании и бейдж «MAX СОБРАЛ», ассистент (10) — свой
// градиентный герой: и то и другое не помещается в строку общей шапки.
const HEADERLESS_ROUTES: ReadonlySet<Route["name"]> = new Set(["search", "swipe", "map", "plans", "profile", "after-event", "lists", "list", "we-groups", "we-group", "vote", "vote-new", "micro", "micro-event", "friends", "friend-route", "plan", "assist"]);

/**
 * Публикация истории и поста (макет, экраны 05 и 06). Обе рисуют собственную шапку с крестом и
 * собственный низ — рельс фонов с кнопками «Близкие друзья»/«В историю» у истории, панель вложений
 * со строкой «Черновик сохранён» у поста. Фиксированный таббар накрыл бы этот низ, а шапка оболочки
 * стала бы второй шапкой, поэтому на этих двух маршрутах экран забирает вьюпорт целиком.
 */
const FULLSCREEN_ROUTES: ReadonlySet<Route["name"]> = new Set(["story-new", "feed-new"]);

export function routeIsFullscreen(route: Route): boolean {
  return FULLSCREEN_ROUTES.has(route.name);
}

export function routeHasHeader(route: Route): boolean {
  return !HEADERLESS_ROUTES.has(route.name) && !routeIsFullscreen(route);
}

/**
 * Шапка ленты (макет, экран 03): словомарк, поиск и колокольчик со счётчиком.
 *
 * Колокольчик — индикатор, а не кнопка: экран уведомлений (07) ещё не построен, а домена уведомлений
 * нет вовсе (#494, smart-alerts — планировщик, не входящие). Счётчик приходит с мока за той сигнатурой,
 * которую примет будущий эндпоинт; кнопкой колокольчик станет вместе с экраном.
 */
export function FeedHeader({ onSearch }: { onSearch: () => void }) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let alive = true;
    apiClient.getNotificationsSummary("").then(
      (summary) => {
        if (alive) setUnread(summary.unreadCount);
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      <span className="app-header-wordmark">
        афиша
        <span className="app-header-wordmark-dot" aria-hidden="true" />
        MAX
      </span>
      <span className="app-header-actions">
        <button type="button" className="app-header-action" aria-label="Поиск" onClick={onSearch}>
          <ActionIcon name="search" size={24} />
        </button>
        <span className="app-header-bell" aria-label={unread === 0 ? "Уведомления" : `Уведомления: ${unread} новых`}>
          <ActionIcon name="bell" size={24} />
          {unread > 0 && (
            <span className="app-header-bell-count" aria-hidden="true">
              {unread}
            </span>
          )}
        </span>
      </span>
    </>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { route, navigate, back, transition, navSeq } = useRoute();

  return (
    <>
      {routeHasHeader(route) && (
        <header className="app-header">
          {route.name === "home" ? (
            <FeedHeader onSearch={() => navigate({ name: "search" })} />
          ) : (
            <>
              {routeHasBack(route) && (
                <button type="button" className="app-header-back" aria-label="Назад" onClick={back}>
                  {/* 24px: навигационная иконка, как у таббара (20px — размер для списков) */}
                  <ActionIcon name="chevron" size={24} strokeWidth={2} />
                </button>
              )}
              <span className="app-header-title">{routeTitle(route)}</span>
            </>
          )}
        </header>
      )}
      <main key={navSeq} className={`app-content app-screen--${transition}${route.name === "map" ? " app-content--flush" : ""}${routeIsFullscreen(route) ? " app-content--full" : ""}`}>
        {children}
      </main>
      {!routeIsFullscreen(route) && (
        <nav className="app-tabbar">
          {TABS.map((tab) => (
            <button key={tab.route} type="button" aria-current={tab.active(route.name) ? "page" : undefined} onClick={() => navigate({ name: tab.route })}>
              <TabIconGlyph name={tab.icon} size={24} filled={tab.active(route.name)} />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      )}
    </>
  );
}
