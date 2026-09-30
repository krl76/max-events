// START_MODULE_CONTRACT
// PURPOSE: The tab bar of the organizer contour: Статистика · События · Продвижение · Финансы · Профиль.
// SCOPE: The bar and its section union only — presentational, driven by the caller's state. The organizer space has no router of its own (it lives outside RouteProvider, behind its own login), so the section is local state, not a route.
// DEPENDS: ../ui/icons.js (TabIconGlyph), ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - OrganizerSection - dashboard | events | promo | profile
// - ORGANIZER_TABS - the three bar entries in order, with their icon and label
// - OrganizerTabBar - the bar: icon + label per section, aria-current on the active one
// END_MODULE_MAP

import { TabIconGlyph, type TabIcon } from "../ui/icons";

export type OrganizerSection = "dashboard" | "events" | "promo" | "finance" | "profile";

export const ORGANIZER_TABS: Array<{ section: OrganizerSection; icon: TabIcon; label: string }> = [
  { section: "dashboard", icon: "dashboard", label: "Статистика" },
  { section: "events", icon: "events", label: "События" },
  { section: "promo", icon: "promo", label: "Продвижение" },
  { section: "finance", icon: "finance", label: "Финансы" },
  { section: "profile", icon: "profile", label: "Профиль" },
];

export function OrganizerTabBar({ section, onSection }: { section: OrganizerSection; onSection: (section: OrganizerSection) => void }) {
  return (
    <nav className="app-tabbar app-tabbar--org" aria-label="Организатор">
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
      {ORGANIZER_TABS.map((tab) => (
        <button key={tab.section} type="button" aria-current={tab.section === section ? "page" : undefined} onClick={() => onSection(tab.section)}>
          <TabIconGlyph name={tab.icon} size={24} filled={tab.section === section} />
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
