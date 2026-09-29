// START_MODULE_CONTRACT
// PURPOSE: Base mini-app layout: header (home: the feed header — wordmark, search, notifications bell; other routes: per-route title + back button), content, bottom tabbar with icons.
// SCOPE: Tab navigation between home/search/create/plans/profile (макет, экраны 03 и 08); children render routed pages. The organizer contour carries its own bar in ../organizer/OrganizerSpace.tsx.
// DEPENDS: ../api/client.js (apiClient), ../routing/router.js, ./theme.css, ./icons.js
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - FeedHeader - шапка ленты (макет, экран 03): словомарк «афиша MAX», поиск и колокольчик со счётчиком непрочитанных — кнопка, ведущая на экран 07 (домен уведомлений на моке, #494)
// - Layout - header + routed children + tabbar (icon + label per tab)
// - TABS - tabbar definitions with per-tab active predicate; the map is its own tab, and plans, saved lists, bookings and the calendar open from the profile
// - ROUTE_TITLES - header title per route name (tab routes keep their tab labels)
// - routeTitle - header title for the current route
// - routeHasBack - back button shown on every non-tab route; fullscreen screens declare onBack/onClose props they never render, so the native button stays the only way out
// - routeHasHeader - header hidden wherever the screen draws its own chrome: the search/plans/profile tabs (profile renders its own gradient hero), the map and the swipe deck, which draw over the content, «После события», whose hero carries a close button instead of a back arrow, the two list screens (экраны 37 и 39), the we-groups and the votes (экраны 30-33), the micro-event feed and card (экраны 24 и 25), the friends list with its counter (экран 26) and the friend route (экран 28), the plan with its date, party size and «MAX СОБРАЛ» badge (экран 15), the assistant with its gradient hero (экран 10), and the fullscreen composers
// - routeIsFullscreen - composers/place/calendar/assist/day-route own the viewport: no shell header, no tabbar
// - routeIsFlush - map canvas and screens that already set their own 20px fields (story, post, place, slots, notifications)
// - routeIsFullscreen - the story and post composers (макет, экраны 05 и 06), the place page (34) and the two booking screens (19 и 20) own the whole viewport: each carries its own back control and its own bottom bar, so neither the shell header nor the tabbar belongs there
// - routeHasHeader - header hidden where the screen draws its own topbar: the search/plans/profile tabs and the two list screens (макет, экраны 37 и 39)
// - routeHasHeader - header hidden on экран 17, whose gradient hero carries the back arrow and the share/save circles, and on экран 23, whose topbar carries the event title and its thumbnail
// - routeIsFullscreen - экран 07 too: it draws its own bell-and-close topbar and the design gives it no tabbar, because notifications open over the feed and close back into it
// - routeHasHeader - header hidden on «Куда пойдём?» (экраны 11 и 12), whose title changes with the wizard step — «Куда пойдём?» over the questions, the number found over the result
// END_MODULE_MAP

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { apiClient } from "../api/client";
import { getWebApp, SHARE_NOTICE, shareNoticeText, type ShareChannel } from "../max/bridge";
import { isTabRoute, useRoute, type Route } from "../routing/router";
import { ActionIcon, TabIconGlyph, type TabIcon } from "./icons";
import { consumeFrozenScroll, freezeScroll, noteAppliedScroll, rememberScroll, routeScrollKey } from "./scroll-memory";

export const TABS: Array<{ icon: TabIcon; label: string; active: (route: string) => boolean; route: "home" | "search" | "create" | "map" | "profile" }> = [
  { icon: "feed", label: "Лента", route: "home", active: (name) => name === "home" || name === "micro" || name === "micro-event" },
  { icon: "search", label: "Поиск", route: "search", active: (name) => name === "search" || name === "browse" || name === "swipe" || name === "assist" },
  { icon: "map", label: "Карта", route: "map", active: (name) => name === "map" },
  { icon: "create", label: "Создать", route: "create", active: (name) => name === "create" || name === "story-new" || name === "feed-new" || name === "micro-new" || name === "plan-new" },
  {
    icon: "profile",
    label: "Профиль",
    route: "profile",
    active: (name) => name === "profile" || name === "user" || name === "friends" || name === "subscriptions" || name === "followers" || name === "discovery" || name === "people" || name === "friend-route" || name === "plans" || name === "plan" || name === "day-route" || name === "calendar" || name === "lists" || name === "list" || name === "bookings" || name === "slot-ticket",
  },
];

export const ROUTE_TITLES: Record<Route["name"], string> = {
  home: "Лента",
  search: "Поиск",
  browse: "Подборка",
  swipe: "Подбор мест",
  create: "Создать",
  map: "Карта",
  plans: "Планы",
  friends: "Друзья",
  calendar: "Календарь",
  profile: "Профиль",
  user: "Профиль",
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
  walk: "Прогулка",
  upcoming: "Ближайшие события",
  walks: "Мои прогулки",
  "walk-saved": "Прогулка",
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
  moderation: "Модерация",
  "vote-new": "Новое голосование",
  micro: "Микро-события",
  "micro-event": "Микро-событие",
  "friend-route": "Маршрут друга",
  assist: "MAX AI ассистент",
  "slot-booking": "Бронирование слота",
  "slot-ticket": "Бронь",
  bookings: "Мои брони",
  companions: "С кем пойти",
  // Экран 07 рисует свою шапку (полноэкранный маршрут); строка здесь нужна таблице, которая обязана быть полной
  notifications: "Умные уведомления",
  // «Подписчики»: обратная сторона подписки, вход — счётчик в шапке профиля
  followers: "Подписчики",
  post: "Пост",
  onboarding: "Онбординг",
};

export function routeTitle(route: Route): string {
  return ROUTE_TITLES[route.name];
}

/** A screen whose title depends on the viewer (in the city or at its center) replaces the static route name. */
const HeaderTitleContext = createContext<(title: string | null) => void>(() => {});

export function useHeaderTitle(title: string | null): void {
  const setTitle = useContext(HeaderTitleContext);
  useEffect(() => {
    setTitle(title);
    return () => setTitle(null);
  }, [setTitle, title]);
}

/** Каждый не-табовый маршрут получает нативную кнопку «назад» MAX: своих крестов у полноэкранных экранов в вёрстке нет. */
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
// «Куда пойдём?» (11 и 12) меняет заголовок вместе с шагом: у вопросов это «Куда пойдём?», у выдачи —
// «Пять вариантов», то есть число найденного. Таблица ROUTE_TITLES даёт один заголовок на маршрут,
// поэтому шапку рисует сам экран.
const HEADERLESS_ROUTES: ReadonlySet<Route["name"]> = new Set(["browse", "swipe", "map", "profile", "user", "after-event", "lists", "list", "bookings", "moderation", "event", "companions", "we-groups", "we-group", "vote", "vote-new", "micro", "micro-event", "friends", "friend-route", "plan", "plans", "assist", "whereto", "calendar", "walk", "walks", "walk-saved", "onboarding"]);

/**
 * Публикация истории и поста (макет, экраны 05 и 06): собственный низ — рельс фонов с кнопками
 * «Близкие друзья»/«В историю» у истории, панель вложений со строкой «Черновик сохранён» у поста.
 * Фиксированный таббар накрыл бы этот низ, поэтому на этих маршрутах экран забирает вьюпорт целиком.
 * Крест/назад в их вёрстке не реализован — выход даёт нативная кнопка MAX (routeHasBack).
 */
const FULLSCREEN_ROUTES: ReadonlySet<Route["name"]> = new Set([
  "story-new",
  "feed-new",
  "place",
  "slot-booking",
  "slot-ticket",
  // Экран 07: таббара под ним в макете нет вовсе — уведомления открываются поверх ленты
  // и закрываются обратно в неё нативной кнопкой назад, а не листаются вкладками.
  "notifications",
  // Календарь — отдельный экран: без таббара и без заголовка «Календарь».
  "calendar",
  "assist",
  // Маршрут на день: своя шапка и нижнее «Готово», иначе длинный список прячет действие под таббаром.
  "day-route",
  "walk",
  "walks",
  "walk-saved",
  "onboarding",
]);

export function routeIsFullscreen(route: Route): boolean {
  return FULLSCREEN_ROUTES.has(route.name);
}

/**
 * Холст без боковых полей оболочки: карта (таббар остаётся) и экраны, которые сами
 * ставят 20px — иначе полноэкранный маршрут с полями дал бы 40px. Календарь, MAX AI
 * и маршрут на день полями оболочки пользуются: их вёрстка писалась под .app-content.
 */
const FLUSH_ROUTES: ReadonlySet<Route["name"]> = new Set(["map", "story-new", "feed-new", "place", "slot-booking", "slot-ticket", "notifications", "onboarding"]);

export function routeIsFlush(route: Route): boolean {
  return FLUSH_ROUTES.has(route.name);
}

export function routeHasHeader(route: Route): boolean {
  return !HEADERLESS_ROUTES.has(route.name) && !routeIsFullscreen(route);
}

const HeaderExtrasContext = createContext<HTMLElement | null>(null);

/** Puts controls into the shell header of the current screen. */
export function HeaderSlot({ children }: { children: ReactNode }) {
  const slot = useContext(HeaderExtrasContext);
  if (slot === null) return null;
  return createPortal(children, slot);
}

/**
 * Шапка ленты (макет, экран 03): словомарк, поиск и колокольчик со счётчиком.
 *
 * Колокольчик — кнопка и вход на экран 07 («Вход: колокольчик в ленте» написано в самом макете).
 * Счётчик приходит с GET /notifications/summary. Планировщик smart-alerts по-прежнему шлёт MAX DM.
 */
export function FeedHeader({ onSearch, onNotifications }: { onSearch: () => void; onNotifications: () => void }) {
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
        <button type="button" className="app-header-bell" aria-label={unread === 0 ? "Уведомления" : `Уведомления: ${unread} новых`} onClick={onNotifications}>
          <ActionIcon name="bell" size={24} />
          {unread > 0 && <span className="app-header-bell-dot" aria-hidden="true" />}
        </button>
      </span>
    </>
  );
}

function scrollKey(route: Route): string {
  if ("id" in route && typeof route.id === "string") return routeScrollKey(route.name, route.id);
  if ("eventId" in route && typeof route.eventId === "string") return routeScrollKey(route.name, route.eventId);
  return route.name;
}

export function Layout({ children }: { children: ReactNode }) {
  const { route, navigate, back, transition: _transition, navSeq } = useRoute();
  const scroller = useRef<HTMLElement>(null);
  const acceptScroll = useRef(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [titleOverride, setTitleOverride] = useState<string | null>(null);
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const setHeaderTitle = useCallback((title: string | null) => setTitleOverride(title), []);
  const key = scrollKey(route);

  useEffect(() => {
    const button = getWebApp()?.BackButton;
    if (!button) return;
    // Онбординг сам ведёт эту кнопку по своим шагам. Иначе «Назад» закрывает весь поток.
    if (route.name === "onboarding") return;
    const onNativeBack = () => back();
    button.onClick(onNativeBack);
    if (routeHasBack(route)) button.show();
    else button.hide();
    return () => {
      button.offClick(onNativeBack);
      button.hide();
    };
  }, [route.name, back]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const reveal = (event?: Event) => {
      if (event instanceof AnimationEvent && event.target !== el) return;
      el.classList.add("app-screen--shown");
    };
    el.addEventListener("animationend", reveal);
    const timer = window.setTimeout(reveal, 420);
    return () => {
      el.removeEventListener("animationend", reveal);
      window.clearTimeout(timer);
    };
  }, [navSeq]);

  useLayoutEffect(() => {
    const el = scroller.current;
    const top = consumeFrozenScroll(key);
    acceptScroll.current = false;
    if (el && top !== undefined) {
      el.scrollTop = top;
      noteAppliedScroll(key, top);
    }
    acceptScroll.current = true;
    return () => {
      acceptScroll.current = false;
    };
  }, [navSeq, key]);

  useEffect(() => {
    const onNotice = (event: Event) => {
      const channel = (event as CustomEvent<ShareChannel>).detail;
      setNotice(shareNoticeText(channel));
    };
    window.addEventListener(SHARE_NOTICE, onNotice);
    return () => window.removeEventListener(SHARE_NOTICE, onNotice);
  }, []);

  useEffect(() => {
    if (notice === null) return;
    const timer = window.setTimeout(() => setNotice(null), 2800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  return (
    <HeaderExtrasContext.Provider value={headerSlot}>
      <svg className="app-brand-defs" aria-hidden="true">
        <defs>
          <linearGradient id="app-brand-fill" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#0d001a" />
            <stop offset="50%" stopColor="#471aff" />
            <stop offset="80%" stopColor="#9500ff" />
            <stop offset="100%" stopColor="#00bfff" />
          </linearGradient>
        </defs>
      </svg>
      {routeHasHeader(route) && (
        <header className="app-header">
          {route.name === "home" ? (
            <FeedHeader onSearch={() => navigate({ name: "search", focus: true })} onNotifications={() => navigate({ name: "notifications" })} />
          ) : (
            <>
              <span className="app-header-title">{titleOverride ?? routeTitle(route)}</span>
              <div className="app-header-extras" ref={setHeaderSlot} />
            </>
          )}
        </header>
      )}
      <main
        key={navSeq}
        ref={scroller}
        className={`app-content app-screen--${_transition}${routeIsFlush(route) ? " app-content--flush" : ""}${routeIsFullscreen(route) ? " app-content--full" : ""}`}
        onScroll={(event) => {
          if (!event.isTrusted || !acceptScroll.current) return;
          const top = event.currentTarget.scrollTop;
          if (top === 0 && event.currentTarget.scrollHeight <= event.currentTarget.clientHeight + 24) return;
          rememberScroll(key, top);
          freezeScroll(key, top);
        }}
      >
        <HeaderTitleContext.Provider value={setHeaderTitle}>{children}</HeaderTitleContext.Provider>
      </main>
      {notice !== null && (
        <p className="app-share-notice" role="status">
          {notice}
        </p>
      )}
      {!routeIsFullscreen(route) && route.name !== "nearby" && (
        <nav className="app-tabbar">
          {TABS.map((tab) => (
            <button key={tab.route} type="button" aria-current={tab.active(route.name) ? "page" : undefined} onClick={() => navigate({ name: tab.route })}>
              <TabIconGlyph name={tab.icon} size={24} filled={tab.active(route.name)} />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      )}
    </HeaderExtrasContext.Provider>
  );
}
