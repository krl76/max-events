// START_MODULE_CONTRACT
// PURPOSE: Inline SVG icons (MAX UI ships only chevron/close/search): tabbar glyphs with filled variants, post actions, event meta, list chevron.
// SCOPE: Stroke icons drawn with currentColor, 24px grid, 1.7 stroke; no new dependencies; names are a closed union.
// DEPENDS: react
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - TabIcon - union of the tabbar icon names: the user bar (feed/search/create/plans/profile) plus map and the organizer bar (dashboard/events/create/promo/profile)
// - TabIconGlyph - inline stroke SVG for a tabbar icon, filled variant for the active tab
// - ActionIconName - union of post-action and meta icon names (heart/comment/share/bookmark/pin/clock/ticket/user/chevron/star/alert/search/settings/bell/check/plus/building/close/text/adjust/sparkle/friends/camera/calendar/lines)
// - ActionIcon - inline stroke SVG by ActionIconName; filled=true fills the glyph (liked heart, saved bookmark, active tab)
// END_MODULE_MAP

import type { ReactNode } from "react";

export type TabIcon = "feed" | "search" | "create" | "map" | "plans" | "profile" | "dashboard" | "events" | "promo";

const OUTLINE: Record<TabIcon, ReactNode> = {
  feed: <path d="M3.8 10.4 12 3.9l8.2 6.5v8.2a1.4 1.4 0 0 1-1.4 1.4H5.2a1.4 1.4 0 0 1-1.4-1.4Z" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20.2 20.2-4-4" />
    </>
  ),
  create: (
    <>
      <rect x="3.6" y="3.6" width="16.8" height="16.8" rx="5" />
      <path d="M12 8.4v7.2M8.4 12h7.2" />
    </>
  ),
  map: (
    <>
      <path d="M12 21s-6.8-5.4-6.8-10.4a6.8 6.8 0 0 1 13.6 0C18.8 15.6 12 21 12 21Z" />
      <circle cx="12" cy="10.4" r="2.4" />
    </>
  ),
  plans: <path d="M6.5 4.5h11v15.4L12 16.2l-5.5 3.7Z" />,
  profile: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.8 20c.9-3.4 3.8-5.2 7.2-5.2s6.3 1.8 7.2 5.2" />
    </>
  ),
  dashboard: (
    <>
      <rect x="3.6" y="3.6" width="7" height="7" rx="2" />
      <rect x="13.4" y="3.6" width="7" height="7" rx="2" />
      <rect x="3.6" y="13.4" width="7" height="7" rx="2" />
      <rect x="13.4" y="13.4" width="7" height="7" rx="2" />
    </>
  ),
  events: (
    <>
      <rect x="3.6" y="5.4" width="16.8" height="15" rx="3" />
      <path d="M3.6 10.2h16.8M8.2 3.6v3.4M15.8 3.6v3.4" />
    </>
  ),
  promo: (
    <>
      <path d="M4 9.4h3.4L14.6 4.8v14.4L7.4 14.6H4a1 1 0 0 1-1-1v-3.2a1 1 0 0 1 1-1Z" />
      <path d="M17.8 9.2a4.2 4.2 0 0 1 0 5.6" />
    </>
  ),
};

const FILLED: Partial<Record<TabIcon, ReactNode>> = {
  feed: <path d="M12 2.9 2.8 10.1v8.5a2.4 2.4 0 0 0 2.4 2.4h4.3v-6.2h5v6.2h4.3a2.4 2.4 0 0 0 2.4-2.4v-8.5Z" />,
  map: <path d="M12 21s-6.8-5.4-6.8-10.4a6.8 6.8 0 0 1 13.6 0C18.8 15.6 12 21 12 21Z" />,
  plans: <path d="M5.5 3.5h13v17.6L12 17.2l-6.5 3.9Z" />,
  profile: (
    <>
      <circle cx="12" cy="8" r="4.1" />
      <path d="M4.3 20.5c.9-3.7 4-5.7 7.7-5.7s6.8 2 7.7 5.7Z" />
    </>
  ),
};

function Glyph({ paths, size, filled, strokeWidth }: { paths: ReactNode; size: number; filled: boolean; strokeWidth?: number }) {
  return (
    <svg aria-hidden="true" fill={filled ? "currentColor" : "none"} height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth ?? 1.7} viewBox="0 0 24 24" width={size}>
      {paths}
    </svg>
  );
}

export function TabIconGlyph({ name, size = 24, filled = false }: { name: TabIcon; size?: number; filled?: boolean }) {
  return <Glyph paths={filled ? (FILLED[name] ?? OUTLINE[name]) : OUTLINE[name]} size={size} filled={filled} />;
}

export type ActionIconName = "heart" | "comment" | "share" | "bookmark" | "pin" | "clock" | "ticket" | "user" | "chevron" | "star" | "alert" | "search" | "settings" | "bell" | "check" | "plus" | "building" | "close" | "text" | "adjust" | "sparkle" | "friends" | "camera" | "calendar" | "lines";

const ACTIONS: Record<ActionIconName, ReactNode> = {
  heart: <path d="M12 20.3S3.4 15.4 3.4 9.6a4.6 4.6 0 0 1 8.6-2.3A4.6 4.6 0 0 1 20.6 9.6c0 5.8-8.6 10.7-8.6 10.7Z" />,
  comment: <path d="M20.5 11.7a8.5 8.5 0 0 1-12.4 7.5L3.6 20.4l1.3-4.3a8.5 8.5 0 1 1 15.6-4.4Z" />,
  share: <path d="M21 3 3.6 9.7l6.2 2.9m11.2-9.6-5.5 18-4.9-8.4m10.4-9.6L9.8 12.6" />,
  bookmark: <path d="M6.2 3.8h11.6a.7.7 0 0 1 .7.7v15.9L12 16.2l-6.5 4.2V4.5a.7.7 0 0 1 .7-.7Z" />,
  pin: (
    <>
      <path d="M12 21s-6.8-5.4-6.8-10.4a6.8 6.8 0 0 1 13.6 0C18.8 15.6 12 21 12 21Z" />
      <circle cx="12" cy="10.4" r="2.4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 7.2V12l3.4 2" />
    </>
  ),
  ticket: (
    <>
      <path d="M3.5 9V6.5a1 1 0 0 1 1-1h15a1 1 0 0 1 1 1V9a3 3 0 0 0 0 6v2.5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1V15a3 3 0 0 0 0-6Z" />
      <path d="M14 5.5v13" strokeDasharray="2.4 2.4" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.8 20c.9-3.4 3.8-5.2 7.2-5.2s6.3 1.8 7.2 5.2" />
    </>
  ),
  chevron: <path d="m9.2 5.6 6.4 6.4-6.4 6.4" />,
  star: <path d="M12 3.6l2.5 5.1 5.6.8-4 4 .9 5.6-5-2.7-5 2.7.9-5.6-4-4 5.6-.8Z" />,
  alert: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 7.6v5.2" />
      <path d="M12 16.4h.01" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20.2 20.2-4-4" />
    </>
  ),
  // Колокольчик уведомлений в шапке ленты (макет, экран 03)
  bell: (
    <>
      <path d="M12 3.4a5.7 5.7 0 0 0-5.7 5.7c0 4.3-1.7 5.6-1.7 5.6h14.8s-1.7-1.3-1.7-5.6A5.7 5.7 0 0 0 12 3.4Z" />
      <path d="M13.8 18.2a2.1 2.1 0 0 1-3.6 0" />
    </>
  ),
  // Галочка онбординга: подписка на человека и выбранный город/интерес (макет, экран 02)
  check: <path d="M5 12l5 5L20 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  // Вход организатора (макет, экран 01): дом с дверью, а не ещё один кружок с глифом
  building: (
    <>
      <path d="M4 21V9l8-5 8 5v12" />
      <path d="M9 21v-6h6v6" />
    </>
  ),
  // Закрыть композер истории и поста (макет, экраны 05 и 06) — крест, а не развёрнутый шеврон «назад»
  close: <path d="M6 6l12 12M18 6L6 18" />,
  // Подпись поверх истории (макет, экран 05): строки по центру
  text: <path d="M4 7h16M8 12h8M10 17h4" />,
  // Настройка кадра истории (макет, экран 05): ползунок с точкой посередине
  adjust: (
    <>
      <path d="M12 3v5M12 16v5M5 12h14" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  // Эффекты истории (макет, экран 05): четырёхлучевая искра
  sparkle: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />,
  // Двое: аудитория истории и отметка друзей в посте (макет, экраны 05 и 06) — в отличие от одиночного user
  friends: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6M15 15.5c3 0 6 1.5 6 4.5" />
    </>
  ),
  // Добавить фото (макет, экран 06): плитка-заглушка и нижняя панель композера
  camera: (
    <>
      <path d="M4 8a2 2 0 0 1 2-2h2l2-2h4l2 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  // Привязать событие (макет, экран 06); тот же смысл, что у таббарного events, но в 20px-размере списков
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="4" />
      <path d="M3 9h18M8 2v4M16 2v4" />
    </>
  ),
  // Текст поста (макет, экран 06): строки по левому краю, в отличие от центрированного text
  lines: <path d="M4 6h16M4 12h10M4 18h13" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.01a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z" />
    </>
  ),
};

export function ActionIcon({ name, size = 24, filled = false, strokeWidth = 1.7 }: { name: ActionIconName; size?: number; filled?: boolean; strokeWidth?: number }) {
  return <Glyph paths={ACTIONS[name]} size={size} filled={filled} strokeWidth={strokeWidth} />;
}
