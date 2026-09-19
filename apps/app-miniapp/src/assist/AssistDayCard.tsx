// START_MODULE_CONTRACT
// PURPOSE: «План на субботу» day card of the NL assist: stops timeline (at + event + explanation) plus the plan CTA — «Открыть план» when the backend persisted a plan (save=true), «Создать план» (re-request with save) otherwise.
// SCOPE: Presentational over AssistDayState; the plan payload is contract-unknown and surfaced only when it parses as a PlanCard.
// DEPENDS: @max-events/api-contracts (AssistDayResponse, PlanCardSchema), ../catalog/CatalogPage.js (formatStartsAt), ../ui/primitives.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - AssistDayState - idle/loading/error/ready union of the Saturday plan flow
// - AssistDayCard - summary, stops timeline and the honest plan CTA
// END_MODULE_MAP

import type { AssistDayResponse } from "@max-events/api-contracts";
import { PlanCardSchema } from "@max-events/api-contracts";
import { formatStartsAt } from "../catalog/CatalogPage";
import { AppButton, AppState } from "../ui/primitives";

export type AssistDayState = { status: "idle" } | { status: "loading" } | { status: "error"; message: string } | { status: "ready"; result: AssistDayResponse };

interface AssistDayCardProps {
  state: AssistDayState;
  onOpenEvent: (eventId: string) => void;
  onOpenPlan: (planId: string) => void;
  onCreatePlan: () => void;
}

export function AssistDayCard({ state, onOpenEvent, onOpenPlan, onCreatePlan }: AssistDayCardProps) {
  if (state.status === "idle") return null;
  if (state.status === "loading") return <AppState>Собираем план на субботу…</AppState>;
  if (state.status === "error") return <AppState error>{state.message}</AppState>;

  const { result } = state;
  const plan = PlanCardSchema.safeParse(result.plan);
  return (
    <div className="app-card">
      <div className="app-card-body">
        <span className="app-card-title">{result.summary}</span>
        <ol>
          {result.stops.map((stop) => (
            <li key={stop.event.id}>
              <button type="button" className="app-card--link" onClick={() => onOpenEvent(stop.event.id)}>
                {formatStartsAt(stop.at)} — {stop.event.title}
              </button>
              <span className="app-card-subtitle">{stop.explanation}</span>
            </li>
          ))}
        </ol>
        {plan.success ? (
          <AppButton stretched onClick={() => onOpenPlan(plan.data.plan.id)}>
            Открыть план
          </AppButton>
        ) : (
          <AppButton tone="secondary" stretched onClick={onCreatePlan}>
            Создать план
          </AppButton>
        )}
      </div>
    </div>
  );
}
