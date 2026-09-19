// START_MODULE_CONTRACT
// PURPOSE: "Куда пойдём?" guided wizard: company step, mood/budget step, result with up to 5 event cards and share to a MAX chat.
// SCOPE: Suggestion via the backend GET /api/whereto through apiClient.getWhereto (loading/error/empty via AppState), local wizard state, шаринг через bridge.shareResult; no URL state, no navigation logic.
// DEPENDS: @max-events/api-contracts (WheretoQuerySchema, Whereto*), ../api/client.js (apiClient.getWhereto), ../max/bridge.js (webApp, shareResult, ShareChannel), ../catalog/CatalogPage.js (CATEGORY_LABELS, formatStartsAt), ../routing/router.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS, https://dev.max.ru/docs/webapps/bridge
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - COMPANY_LABELS - ru labels for WheretoCompany
// - MOOD_LABELS - ru labels for WheretoMood
// - BUDGET_LABELS - ru labels for WheretoBudget
// - WheretoState - wizard step: company -> context (mood+budget) -> result (WheretoQuery) -> vote (create form over the result events)
// - WheretoResult - fetch status of the result step: loading | error | ready (backend items)
// - wizardStepIndex - 0-based progress position of a wizard step (drives the «Шаг N из 3» header)
// - buildShareText - numbered share text for the result events
// - WheretoView - presentational wizard by step (result offers the «Голосование с друзьями» CTA when >= 2 events)
// - WheretoPage - route container: wizard state + backend suggestion fetch + share wiring + vote creation handoff
// END_MODULE_MAP

import { useEffect, useState } from "react";
import type { Event, WheretoBudget, WheretoCompany, WheretoMood, WheretoQuery } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { CATEGORY_LABELS, formatStartsAt } from "../catalog/CatalogPage";
import { shareResult, webApp, type ShareChannel } from "../max/bridge";
import { useRoute } from "../routing/router";
import { AppButton, AppChip, AppState, AppMedia } from "../ui/primitives";
import { ActionIcon } from "../ui/icons";
import { VoteCreateSection } from "../votes/VotePage";

export const COMPANY_LABELS: Record<WheretoCompany, string> = { alone: "Я один", friends: "С друзьями", partner: "С девушкой", kids: "С детьми" };

export const MOOD_LABELS: Record<WheretoMood, string> = { active: "Активное", calm: "Спокойное", unusual: "Необычное" };

export const BUDGET_LABELS: Record<WheretoBudget, string> = { any: "Любой", free: "Бесплатное", under_3000: "До 3000 ₽" };

export type WheretoState = { step: "company" } | { step: "context"; company: WheretoCompany; mood: WheretoMood | null; budget: WheretoBudget | null } | { step: "result"; query: WheretoQuery } | { step: "vote"; query: WheretoQuery };

/** Fetch status of the result step: the backend suggestion is loading, failed, or ready with its items. */
export type WheretoResult = { status: "loading" } | { status: "error" } | { status: "ready"; events: Event[] };

export function buildShareText(events: Event[]): string {
  return ["Куда пойдём? Подборка MAX Events:", ...events.map((event, index) => `${index + 1}. ${event.title} — ${formatStartsAt(event.startsAt)}`)].join("\n");
}

interface WheretoViewProps {
  state: WheretoState;
  events: Event[];
  status: WheretoResult["status"];
  shared: ShareChannel | null;
  onCompany: (company: WheretoCompany) => void;
  onMood: (mood: WheretoMood) => void;
  onBudget: (budget: WheretoBudget) => void;
  onShow: () => void;
  onRestart: () => void;
  onShare: () => void;
  onOpenEvent: (id: string) => void;
  onCreateVote: () => void;
}

function ResultCard({ event, onOpenEvent }: { event: Event; onOpenEvent: (id: string) => void }) {
  return (
    <button type="button" className="app-card app-card--link" onClick={() => onOpenEvent(event.id)}>
      <AppMedia category={event.category} />
      <div className="app-card-body">
        <span className="app-card-title">{event.title}</span>
        <span className="app-card-subtitle">
          {formatStartsAt(event.startsAt)} · {CATEGORY_LABELS[event.category]}
        </span>
        <span className="app-card-subtitle">
          {event.city} · {event.priceRub === null ? "Бесплатно" : `${event.priceRub} ₽`}
        </span>
      </div>
    </button>
  );
}

const WIZARD_STEPS = ["Кто идёт?", "Настроение и бюджет", "Ваша подборка"] as const;

export function wizardStepIndex(state: WheretoState): number {
  if (state.step === "company") return 0;
  if (state.step === "context") return 1;
  return 2;
}

function WizardProgress({ step }: { step: number }) {
  return (
    <div className="app-wizard-progress">
      <span className="app-wizard-progress-label">
        Шаг {step + 1} из {WIZARD_STEPS.length} — {WIZARD_STEPS[step]}
      </span>
      <div className="app-wizard-progress-bar" aria-hidden="true">
        {WIZARD_STEPS.map((name, index) => (
          <span key={name} className={index <= step ? "app-wizard-progress-seg app-wizard-progress-seg--on" : "app-wizard-progress-seg"} />
        ))}
      </div>
    </div>
  );
}

export function WheretoView({ state, events, status, shared, onCompany, onMood, onBudget, onShow, onRestart, onShare, onOpenEvent, onCreateVote }: WheretoViewProps) {
  if (state.step === "company") {
    return (
      <>
        <WizardProgress step={0} />
        <p className="app-whereto-hint">Выберите компанию</p>
        <div className="app-whereto-options" role="group" aria-label="Компания">
          {(Object.keys(COMPANY_LABELS) as WheretoCompany[]).map((company) => (
            <button type="button" key={company} className="app-whereto-option" onClick={() => onCompany(company)}>
              {COMPANY_LABELS[company]}
              <ActionIcon name="chevron" size={16} strokeWidth={2} />
            </button>
          ))}
        </div>
      </>
    );
  }

  if (state.step === "context") {
    return (
      <>
        <WizardProgress step={1} />
        <p className="app-whereto-hint">{COMPANY_LABELS[state.company]}</p>
        <div className="app-whereto-chips" role="group" aria-label="Настроение">
          <span className="app-whereto-chips-label">Настроение</span>
          {(Object.keys(MOOD_LABELS) as WheretoMood[]).map((mood) => (
            <AppChip key={mood} pressed={state.mood === mood} onClick={() => onMood(mood)}>
              {MOOD_LABELS[mood]}
            </AppChip>
          ))}
        </div>
        <div className="app-whereto-chips" role="group" aria-label="Бюджет">
          <span className="app-whereto-chips-label">Бюджет</span>
          {(Object.keys(BUDGET_LABELS) as WheretoBudget[]).map((budget) => (
            <AppChip key={budget} pressed={state.budget === budget} onClick={() => onBudget(budget)}>
              {BUDGET_LABELS[budget]}
            </AppChip>
          ))}
        </div>
        <AppButton disabled={state.mood === null || state.budget === null} onClick={onShow} stretched>
          Показать подборку
        </AppButton>
      </>
    );
  }

  return (
    <>
      <WizardProgress step={2} />
      <p className="app-whereto-hint">
        {COMPANY_LABELS[state.query.company]} · {MOOD_LABELS[state.query.mood]} · {BUDGET_LABELS[state.query.budget]}
      </p>
      {status === "loading" && <AppState>Загрузка…</AppState>}
      {status === "error" && <AppState error>Не удалось загрузить подборку.</AppState>}
      {status === "ready" && events.length === 0 && <AppState>Ничего не нашлось — попробуйте другой контекст</AppState>}
      {status === "ready" && events.map((event) => (
        <ResultCard key={event.id} event={event} onOpenEvent={onOpenEvent} />
      ))}
      {status === "ready" && events.length > 0 && (
        <AppButton onClick={onShare} stretched>
          Отправить друзьям
        </AppButton>
      )}
      {status === "ready" && events.length >= 2 && (
        <AppButton tone="secondary" onClick={onCreateVote} stretched>
          Голосование с друзьями
        </AppButton>
      )}
      {shared === "bridge" && <p className="app-whereto-share-hint">Выберите чат в MAX — экран отправки открыт.</p>}
      {shared === "clipboard" && <p className="app-whereto-share-hint">Подборка скопирована — вставьте её в чат.</p>}
      {shared === "unavailable" && <pre className="app-whereto-share-hint">{buildShareText(events)}</pre>}
      <button type="button" className="app-whereto-restart" onClick={onRestart}>
        Начать заново
      </button>
    </>
  );
}

export function WheretoPage() {
  const { navigate } = useRoute();
  const [state, setState] = useState<WheretoState>({ step: "company" });
  const [shared, setShared] = useState<ShareChannel | null>(null);
  const [result, setResult] = useState<WheretoResult | null>(null);
  const query = state.step === "result" || state.step === "vote" ? state.query : null;
  useEffect(() => {
    if (query === null) return;
    let alive = true;
    setResult({ status: "loading" });
    apiClient.getWhereto(query).then(
      (response) => {
        if (alive) setResult({ status: "ready", events: response.items });
      },
      () => {
        if (alive) setResult({ status: "error" });
      },
    );
    return () => {
      alive = false;
    };
  }, [query]);
  const events = result?.status === "ready" ? result.events : [];

  if (state.step === "vote") {
    return <VoteCreateSection events={events} onCreated={(vote) => navigate({ name: "vote", id: vote.id })} onCancel={() => setState({ step: "result", query: state.query })} />;
  }

  return (
    <WheretoView
      state={state}
      events={events}
      status={result?.status ?? "loading"}
      shared={shared}
      onCompany={(company) => setState({ step: "context", company, mood: null, budget: null })}
      onMood={(mood) => setState((current) => (current.step === "context" ? { ...current, mood } : current))}
      onBudget={(budget) => setState((current) => (current.step === "context" ? { ...current, budget } : current))}
      onShow={() => setState((current) => (current.step === "context" && current.mood !== null && current.budget !== null ? { step: "result", query: { company: current.company, mood: current.mood, budget: current.budget } } : current))}
      onRestart={() => {
        setState({ step: "company" });
        setShared(null);
      }}
      onShare={() => {
        shareResult(webApp, buildShareText(events)).then(setShared);
      }}
      onOpenEvent={(id) => navigate({ name: "event", id })}
      onCreateVote={() => setState((current) => (current.step === "result" ? { step: "vote", query: current.query } : current))}
    />
  );
}
