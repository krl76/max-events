// START_MODULE_CONTRACT
// PURPOSE: NL AI-assist home block («Спросите по-своему»): free-text query -> explained picks (summary + criteria chips + event cards) and the «Сделай нам план на субботу» day card; part of the interface, not a separate chat.
// SCOPE: Data via apiClient.assistQuery/assistDay (mock or live backend); loading/error/empty states; 429 -> rate-limit message; pick click navigates to the event route, «Открыть план» to the plan route.
// DEPENDS: ../api/client.js (apiClient, ApiError), @max-events/api-contracts (Assist*), ../catalog/CatalogPage.js (formatStartsAt, CATEGORY_LABELS), ../routing/router.js, ../ui/primitives.js, ./AssistDayCard.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - AssistState - idle/loading/error/ready union of the NL query flow
// - ASSIST_WHEN_LABELS - ru labels for AssistWhen
// - ASSIST_COMPANY_LABELS - ru labels for AssistCompany
// - ASSIST_GENRE_LABELS - ru labels for AssistGenre
// - criteriaChips - AssistCriteria -> chip texts (when / budget / company / genre)
// - assistErrorMessage - ApiError 429 -> rate-limit text, otherwise the given fallback
// - AssistView - presentational: query form, day CTA, summary, chips, picks, states
// - AssistSection - home container: wires the NL form and the Saturday plan to the client and the router
// END_MODULE_MAP

import { useState } from "react";
import type { AssistCompany, AssistCriteria, AssistGenre, AssistResponse, AssistWhen } from "@max-events/api-contracts";
import { ApiError, apiClient } from "../api/client";
import { CATEGORY_LABELS, formatStartsAt } from "../catalog/CatalogPage";
import { useRoute } from "../routing/router";
import { AppButton, AppTitle } from "../ui/primitives";
import { AssistDayCard, type AssistDayState } from "./AssistDayCard";

export type AssistState = { status: "idle" } | { status: "loading" } | { status: "error"; message: string } | { status: "ready"; result: AssistResponse };

export const ASSIST_WHEN_LABELS: Record<AssistWhen, string> = { morning: "Утром", afternoon: "Днём", evening: "Вечером", any: "В любое время" };

export const ASSIST_COMPANY_LABELS: Record<AssistCompany, string> = { alone: "Один", friends: "С друзьями", partner: "Вдвоём", kids: "С детьми" };

export const ASSIST_GENRE_LABELS: Record<AssistGenre, string> = { music: "Музыка", sport: "Спорт", outdoors: "На природе", any: "Любой жанр" };

export function criteriaChips(criteria: AssistCriteria): string[] {
  return [ASSIST_WHEN_LABELS[criteria.when], criteria.budgetMaxRub === null ? "Любой бюджет" : `До ${criteria.budgetMaxRub} ₽`, ASSIST_COMPANY_LABELS[criteria.company], ASSIST_GENRE_LABELS[criteria.genre]];
}

export function assistErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status === 429) return "Слишком много запросов подряд — подождите пару минут и попробуйте снова.";
  return fallback;
}

interface AssistViewProps {
  query: string;
  state: AssistState;
  day: AssistDayState;
  onQuery: (value: string) => void;
  onSubmit: () => void;
  onPlanDay: () => void;
  onCreatePlan: () => void;
  onOpenEvent: (eventId: string) => void;
  onOpenPlan: (planId: string) => void;
}

export function AssistView({ query, state, day, onQuery, onSubmit, onPlanDay, onCreatePlan, onOpenEvent, onOpenPlan }: AssistViewProps) {
  return (
    <section aria-label="Спросите по-своему">
      <AppTitle asChild>
        <h2 className="app-section-title">Спросите по-своему</h2>
      </AppTitle>
      <form
        className="app-filters-inputs"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <input className="app-filters-input" type="text" value={query} aria-label="Запрос подборки" placeholder="Хочу вечером куда-нибудь, максимум 3000 ₽, с девушкой, желательно музыка" onChange={(event) => onQuery(event.target.value)} />
        <AppButton type="submit" disabled={query.trim() === "" || state.status === "loading"}>
          Найти
        </AppButton>
      </form>
      <AppButton tone="secondary" disabled={day.status === "loading"} onClick={onPlanDay}>
        Сделай нам план на субботу
      </AppButton>
      {state.status === "loading" && <p className="app-state">Подбираем варианты…</p>}
      {state.status === "error" && <p className="app-state app-state--error">{state.message}</p>}
      {state.status === "ready" && (
        <>
          <p className="app-today-summary">{state.result.summary}</p>
          <span className="app-today-labels">
            {criteriaChips(state.result.criteria).map((chip) => (
              <span key={chip} className="app-today-chip">
                {chip}
              </span>
            ))}
          </span>
          {state.result.items.length === 0 && <p className="app-state">Ничего не нашлось — попробуйте изменить запрос.</p>}
          {state.result.items.map((pick) => (
            <button key={pick.event.id} type="button" className="app-card app-card--link" onClick={() => onOpenEvent(pick.event.id)}>
              <div className="app-card-body">
                <span className="app-card-title">{pick.event.title}</span>
                <span className="app-card-subtitle">
                  {formatStartsAt(pick.event.startsAt)} · {CATEGORY_LABELS[pick.event.category]} · {pick.event.priceRub === null ? "Бесплатно" : `${pick.event.priceRub} ₽`}
                </span>
                <span className="app-card-subtitle">{pick.explanation}</span>
              </div>
            </button>
          ))}
        </>
      )}
      <AssistDayCard state={day} onOpenEvent={onOpenEvent} onOpenPlan={onOpenPlan} onCreatePlan={onCreatePlan} />
    </section>
  );
}

export function AssistSection() {
  const { navigate } = useRoute();
  const [query, setQuery] = useState("");
  const [state, setState] = useState<AssistState>({ status: "idle" });
  const [day, setDay] = useState<AssistDayState>({ status: "idle" });

  const submit = () => {
    const text = query.trim();
    if (text === "" || state.status === "loading") return;
    setState({ status: "loading" });
    apiClient.assistQuery(text).then(
      (result) => setState({ status: "ready", result }),
      (error: unknown) => setState({ status: "error", message: assistErrorMessage(error, "Не удалось подобрать варианты. Попробуйте ещё раз.") }),
    );
  };

  const planDay = (save: boolean) => {
    if (day.status === "loading") return;
    setDay({ status: "loading" });
    apiClient.assistDay(query.trim() || "План на субботу", save).then(
      (result) => setDay({ status: "ready", result }),
      (error: unknown) => setDay({ status: "error", message: assistErrorMessage(error, "Не удалось собрать план на субботу.") }),
    );
  };

  return <AssistView query={query} state={state} day={day} onQuery={setQuery} onSubmit={submit} onPlanDay={() => planDay(false)} onCreatePlan={() => planDay(true)} onOpenEvent={(id) => navigate({ name: "event", id })} onOpenPlan={(id) => navigate({ name: "plan", id })} />;
}
