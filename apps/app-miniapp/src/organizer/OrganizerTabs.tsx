// START_MODULE_CONTRACT
// PURPOSE: The tab bar of the organizer contour (макет, экраны 45–48): Дашборд · События · Создать · Промо · Профиль.
// SCOPE: The bar and its section union only — presentational, driven by the caller's state. The organizer space has no router of its own (it lives outside RouteProvider, behind its own login), so the section is local state, not a route.
// DEPENDS: ../ui/icons.js (TabIconGlyph), ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - OrganizerSection - dashboard | events | create | promo | profile
// - ORGANIZER_TABS - the five bar entries in design order, with their icon and label
// - OrganizerTabBar - the bar: icon + label per section, aria-current on the active one
// END_MODULE_MAP

import { TabIconGlyph, type TabIcon } from "../ui/icons";

export type OrganizerSection = "dashboard" | "events" | "create" | "promo" | "profile";

export const ORGANIZER_TABS: Array<{ section: OrganizerSection; icon: TabIcon; label: string }> = [
  { section: "dashboard", icon: "dashboard", label: "Дашборд" },
  { section: "events", icon: "events", label: "События" },
  { section: "create", icon: "create", label: "Создать" },
  { section: "promo", icon: "promo", label: "Промо" },
  { section: "profile", icon: "profile", label: "Профиль" },
];

export function OrganizerTabBar({ section, onSection }: { section: OrganizerSection; onSection: (section: OrganizerSection) => void }) {
  return (
    <nav className="app-tabbar" aria-label="Организатор">
      {ORGANIZER_TABS.map((tab) => (
        <button key={tab.section} type="button" aria-current={tab.section === section ? "page" : undefined} onClick={() => onSection(tab.section)}>
          <TabIconGlyph name={tab.icon} size={24} filled={tab.section === section} />
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
