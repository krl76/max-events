// START_MODULE_CONTRACT
// PURPOSE: The «Создать» tab of the user contour: one entry point to everything a viewer can publish — a story, a post, a plan, a micro-event.
// SCOPE: Navigation only. Every destination is an existing screen; the publication screens themselves live in their own modules (story: ../create/StoryCreatePage.js, post: ../create/PostCreatePage.js, plan: ../plans/PlanCreatePage.js, micro-event: ../micro/MicroEvents.js).
// DEPENDS: ../routing/router.js (useRoute), ../ui/primitives.js (AppSection), ../ui/icons.js (ActionIcon), ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - CreateEntry - one publication entry: icon, label, one line of what it is for, target route
// - CREATE_ENTRIES - the four publication entries in design order
// - CreateView - presentational: entry rows, icon + label + description
// - CreatePage - container: routes the picked entry
// END_MODULE_MAP

import type { Route } from "../routing/router";
import { useRoute } from "../routing/router";
import { ActionIcon, type ActionIconName } from "../ui/icons";
import { AppSection } from "../ui/primitives";

export interface CreateEntry {
  icon: ActionIconName;
  label: string;
  description: string;
  route: Route;
}

/** Макет, экран 03: «Создать» opens публикация — история (05), пост (06), план. The micro-event joins them: it is the fourth thing a viewer publishes. */
export const CREATE_ENTRIES: CreateEntry[] = [
  { icon: "clock", label: "История", description: "Сутки у друзей", route: { name: "story-new" } },
  { icon: "comment", label: "Пост", description: "Фото и событие", route: { name: "feed-new", eventId: null } },
  { icon: "bookmark", label: "План", description: "Вечер из афиши", route: { name: "plan-new" } },
  { icon: "user", label: "Микро-событие", description: "Встреча со своими", route: { name: "micro-new" } },
];

export function CreateView({ onPick }: { onPick: (route: Route) => void }) {
  return (
    <AppSection className="app-create-section" ariaLabel="Создать">
      <div className="app-create-board">
        {CREATE_ENTRIES.map((entry) => (
          <button key={entry.label} type="button" className="app-create-card" onClick={() => onPick(entry.route)}>
            <span className="app-create-card-art" aria-hidden="true">
              <ActionIcon name={entry.icon} size={22} />
            </span>
            <span className="app-create-card-copy">
              <span className="app-create-card-label">{entry.label}</span>
              <span className="app-create-card-line">{entry.description}</span>
            </span>
            <span className="app-create-card-go" aria-hidden="true">
              <ActionIcon name="chevron" size={18} />
            </span>
          </button>
        ))}
      </div>
    </AppSection>
  );
}

export function CreatePage() {
  const { navigate } = useRoute();
  return <CreateView onPick={navigate} />;
}
