// START_MODULE_CONTRACT
// PURPOSE: «Собрать план» autoplan section (#173) shown on the event page once the user is booked: POST /plans/auto preview (dinner->road->meetup->event timeline, travel minutes, nearby food picks) and entry into the already-saved draft plan.
// SCOPE: Build via apiClient.createAutoPlan at the fixed Moscow center; the backend persists the plan, the section never re-creates it; idle/loading/error/ready states.
// DEPENDS: ../api/client.js (apiClient), @max-events/api-contracts (AutoPlanProposal), ../catalog/MapScreen.js (MOSCOW_CENTER), ../routing/router.js, ../ui/primitives.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - AutoPlanState - union of autoplan states (idle / loading / error / ready)
// - formatTimelineAt - HH:MM ru time of a timeline step
// - AutoPlanView - presentational: CTA, preview timeline, travel line, food places, «Открыть план»
// - AutoPlanSection - container: runs createAutoPlan on the CTA click, navigates to the saved plan
// END_MODULE_MAP

import { useState } from "react";
import type { AutoPlanProposal } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { MOSCOW_CENTER } from "../catalog/MapScreen";
import { useRoute } from "../routing/router";
import { AppButton, AppTitle } from "../ui/primitives";

// ponytail: fixed Moscow center as the autoplan origin; user geolocation when the bridge exposes it
const [AUTOPLAN_LAT, AUTOPLAN_LNG] = MOSCOW_CENTER;

export type AutoPlanState = { status: "idle" } | { status: "loading" } | { status: "error" } | { status: "ready"; proposal: AutoPlanProposal };

export function formatTimelineAt(at: string): string {
  return new Date(at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export function AutoPlanView({ state, onBuild, onOpenPlan }: { state: AutoPlanState; onBuild: () => void; onOpenPlan: (planId: string) => void }) {
  return (
    <section className="app-event">
      <div className="app-event-body">
        <AppTitle asChild>
          <h2 className="app-section-title">План на вечер</h2>
        </AppTitle>
        {(state.status === "idle" || state.status === "error") && (
          <AppButton onClick={onBuild} stretched>
            Собрать план
          </AppButton>
        )}
        {state.status === "error" && <p className="app-state app-state--error">Не удалось собрать план.</p>}
        {state.status === "loading" && <p className="app-state">Собираем план…</p>}
        {state.status === "ready" && (
          <>
            <ol className="app-plan-participants">
              {state.proposal.timeline.map((step, index) => (
                <li key={index} className="app-plan-participant">
                  {formatTimelineAt(step.at)} · {step.label} — {step.detail}
                </li>
              ))}
            </ol>
            <p className="app-plan-meeting">{state.proposal.travelMinutes} мин до места</p>
            {state.proposal.foodPlaces.length > 0 && (
              <>
                <p className="app-state">Где поесть рядом:</p>
                <ul className="app-plan-participants">
                  {state.proposal.foodPlaces.map((place) => (
                    <li key={place.id} className="app-plan-participant">
                      {place.title} · {place.address}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <AppButton onClick={() => onOpenPlan(state.proposal.plan.plan.id)} stretched>
              Открыть план
            </AppButton>
          </>
        )}
      </div>
    </section>
  );
}

export function AutoPlanSection({ eventId }: { eventId: string }) {
  const { navigate } = useRoute();
  const [state, setState] = useState<AutoPlanState>({ status: "idle" });

  const build = () => {
    setState({ status: "loading" });
    apiClient.createAutoPlan(eventId, AUTOPLAN_LAT, AUTOPLAN_LNG).then(
      (proposal) => setState({ status: "ready", proposal }),
      () => setState({ status: "error" }),
    );
  };

  return <AutoPlanView state={state} onBuild={build} onOpenPlan={(planId) => navigate({ name: "plan", id: planId })} />;
}
