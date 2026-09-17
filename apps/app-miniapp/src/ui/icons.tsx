// START_MODULE_CONTRACT
// PURPOSE: Inline SVG icons for the tabbar (MAX UI ships only chevron/close/search).
// SCOPE: Five stroke icons (feed/plans/friends/calendar/profile) drawn with currentColor; no new dependencies.
// DEPENDS: react
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - TabIconGlyph - inline stroke SVG for a tabbar icon name (feed/plans/friends/calendar/profile)
// - TabIcon - union of the five tabbar icon names
// END_MODULE_MAP

import type { ReactNode } from "react";

export type TabIcon = "feed" | "plans" | "friends" | "calendar" | "profile";

const PATHS: Record<TabIcon, ReactNode> = {
  feed: <path d="M3.8 10.4 12 3.9l8.2 6.5v8.2a1.4 1.4 0 0 1-1.4 1.4H5.2a1.4 1.4 0 0 1-1.4-1.4Z" />,
  plans: <path d="M6.5 4.5h11v15.4L12 16.2l-5.5 3.7Z" />,
  friends: (
    <>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.5 19.5c.7-3 2.9-4.6 5.5-4.6s4.8 1.6 5.5 4.6" />
      <path d="M15.5 5.6a3.2 3.2 0 0 1 0 5.8" />
      <path d="M17.4 15.2c1.6.6 2.7 2 3.1 4" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.8" y="5.3" width="16.4" height="15" rx="1.6" />
      <path d="M3.8 9.8h16.4M8.2 3.4v3.4M15.8 3.4v3.4" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.8 20c.9-3.4 3.8-5.2 7.2-5.2s6.3 1.8 7.2 5.2" />
    </>
  ),
};

export function TabIconGlyph({ name, size = 24 }: { name: TabIcon; size?: number }) {
  return (
    <svg aria-hidden="true" fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} viewBox="0 0 24 24" width={size}>
      {PATHS[name]}
    </svg>
  );
}
