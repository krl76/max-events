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
// - CreateView - presentational: four equal full-width tiles, icon, label and one line
// - CreatePage - container: routes the picked entry
// END_MODULE_MAP

import { useEffect, useState } from "react";
import type { MicroEvent, PlanCard } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { planWhenPlace } from "../plans/PlansPage";
import { pictured } from "../ui/photos";
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
  { icon: "clock", label: "История", description: "Кадр, который друзья увидят сутки", route: { name: "story-new" } },
  { icon: "comment", label: "Пост", description: "Фото и мысль к событию", route: { name: "feed-new", eventId: null } },
  { icon: "bookmark", label: "План", description: "Собрать вечер из афиши", route: { name: "plan-new" } },
  { icon: "user", label: "Микро-событие", description: "Короткая встреча со своими", route: { name: "micro-new" } },
];

export function CreateView({ onPick }: { onPick: (route: Route) => void }) {
  return (
    <AppSection className="app-create-section" ariaLabel="Создать">
      <div className="app-create-board">
        {CREATE_ENTRIES.map((entry, index) => (
          <button key={entry.label} type="button" className={`app-create-card app-create-card--${index}`} onClick={() => onPick(entry.route)}>
            <span className="app-create-card-art" aria-hidden="true">
              <ActionIcon name={entry.icon} size={22} />
            </span>
            <span className="app-create-card-copy">
              <span className="app-create-card-label">{entry.label}</span>
              <span className="app-create-card-line">{entry.description}</span>
            </span>
          </button>
        ))}
      </div>
    </AppSection>
  );
}

export function CreateContinue({ plans, micros, onOpenPlan, onOpenMicro }: { plans: PlanCard[]; micros: MicroEvent[]; onOpenPlan: (id: string) => void; onOpenMicro: (id: string) => void }) {
  if (plans.length === 0 && micros.length === 0) return null;
  return (
    <div className="app-create-live">
      {plans.length > 0 && (
        <>
          <p className="app-create-live-title">Ближайшие планы</p>
          {plans.slice(0, 3).map((card) => (
            <button key={card.plan.id} type="button" className="app-create-live-row" onClick={() => onOpenPlan(card.plan.id)}>
              <img alt="" src={pictured(card.event.id, card.event.coverUrl)} />
              <span className="app-create-live-copy">
                <strong>{card.event.title}</strong>
                <span>{planWhenPlace(card.plan)}</span>
              </span>
              <ActionIcon name="chevron" size={16} />
            </button>
          ))}
        </>
      )}
      {micros.length > 0 && (
        <>
          <p className="app-create-live-title">Открытые сборы</p>
          {micros.slice(0, 3).map((item) => (
            <button key={item.id} type="button" className="app-create-live-row" onClick={() => onOpenMicro(item.id)}>
              <span className="app-create-live-copy">
                <strong>{item.title}</strong>
                <span>
                  {item.participantsCount}/{item.participantsLimit} · присоединиться
                </span>
              </span>
              <ActionIcon name="chevron" size={16} />
            </button>
          ))}
        </>
      )}
    </div>
  );
}

export function CreatePage() {
  const { navigate } = useRoute();
  const auth = useAuth();
  const [plans, setPlans] = useState<PlanCard[]>([]);
  const [micros, setMicros] = useState<MicroEvent[]>([]);

  useEffect(() => {
    let alive = true;
    apiClient.listPlans().then(
      (list) => {
        if (alive) setPlans(list.filter((card) => Date.parse(card.plan.meetingAt) >= Date.now()).slice(0, 3));
      },
      () => {},
    );
    apiClient.listMicroEvents().then(
      (list) => {
        if (!alive) return;
        const userId = auth.status === "authenticated" ? auth.user.id : null;
        setMicros(list.filter((item) => item.status === "open" && (userId === null || !item.participantIds.includes(userId))).slice(0, 3));
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [auth]);

  return (
    <>
      <CreateView onPick={navigate} />
      <CreateContinue plans={plans} micros={micros} onOpenPlan={(id) => navigate({ name: "plan", id })} onOpenMicro={(id) => navigate({ name: "micro-event", id })} />
    </>
  );
}
