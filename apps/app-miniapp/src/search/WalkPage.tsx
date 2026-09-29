import { useEffect, useRef, useState } from "react";
import type { AssistDayResponse, CityWalk, ComposeCityWalkWrite } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { pluralRu } from "../catalog/format";
import { useRoute } from "../routing/router";
import { AppButton, AppState } from "../ui/primitives";
import { EMPTY_WALK_CHOICE, walkComposeReady, WalkWizard, type WalkChoice } from "./WalkWizard";
import { WalkResult, walkErrorText, walkStopKeys } from "./WalkResult";

const WAIT_SKELETONS: readonly number[] = [0, 1, 2, 3];

export function cityWalkAsk(city: string): string {
  return `Собери пеший маршрут по достопримечательностям города ${city}: 4–6 остановок по порядку, время между точками и где поесть рядом.`;
}

export function nextWalkAsk(city: string): string {
  return `Собери другой пеший маршрут по достопримечательностям города ${city}. Не повторяй предыдущий.`;
}

export function walkBudgetRub(stops: readonly { readonly event: { readonly priceRub: number | null } }[]): number {
  return stops.reduce((sum, stop) => sum + (stop.event.priceRub ?? 0), 0);
}

export function walkSpanMinutes(stops: readonly { readonly at: string }[]): number | null {
  const times = stops.map((stop) => Date.parse(stop.at)).filter((value) => Number.isFinite(value));
  if (times.length < 2) return null;
  const span = Math.round((Math.max(...times) - Math.min(...times)) / 60_000);
  return span > 0 ? span : null;
}

export function walkSpanLabel(minutes: number | null): string {
  if (minutes === null) return "пешком";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} мин`;
  if (rest === 0) return `${hours} ч`;
  return `${hours} ч ${rest} мин`;
}

export function walkBudgetLabel(total: number): string {
  if (total <= 0) return "Бесплатно";
  return `${total.toLocaleString("ru-RU")} ₽`;
}

export function walkClock(at: string): string {
  const parsed = Date.parse(at);
  if (!Number.isFinite(parsed)) return at;
  return new Date(parsed).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export function walkWaitTitle(city: string): string {
  return `Прокладываю маршрут по ${city}`;
}

export function walkWaitSubtitle(durationMinutes: number): string {
  return `${walkSpanLabel(durationMinutes)} · проверяю реальные места и расстояния`;
}

export type WalkState = { status: "loading" } | { status: "error" } | { status: "ready"; day: AssistDayResponse };

export function WalkView({ city, state, onAnother }: { readonly city: string; readonly state: WalkState; readonly onAnother: () => void }) {
  return (
    <section className="app-walk">
      <h1 className="app-walk-title">Маршрут выходного дня: {city}</h1>
      {state.status === "loading" && <AppState>Собираем прогулку по достопримечательностям.</AppState>}
      {state.status === "error" && <AppState error>Не удалось собрать прогулку.</AppState>}
      {state.status === "ready" && <WalkDraft day={state.day} onAnother={onAnother} />}
    </section>
  );
}

function WalkDraft({ day, onAnother }: { readonly day: AssistDayResponse; readonly onAnother: () => void }) {
  const count = day.stops.length;
  const budget = walkBudgetRub(day.stops);
  return (
    <>
      <ul className="app-walk-stats">
        <li className="app-walk-stat">
          <strong>{walkSpanLabel(walkSpanMinutes(day.stops))}</strong>
          <span>в пути</span>
        </li>
        <li className="app-walk-stat">
          <strong>{count}</strong>
          <span>{pluralRu(count, "достопримечательность", "достопримечательности", "достопримечательностей")}</span>
        </li>
        <li className="app-walk-stat">
          <strong>{walkBudgetLabel(budget)}</strong>
          <span>бюджет</span>
        </li>
      </ul>
      <ol className="app-walk-stops">
        {day.stops.map((stop, index) => (
          <li key={stop.event.id} className="app-walk-stop">
            <span className="app-walk-num">{index + 1}</span>
            <div>
              <p className="app-walk-meta">{walkClock(stop.at)}</p>
              <h3>{stop.event.title}</h3>
              <p className="app-walk-meta">
                {stop.event.ratingAverage != null ? `★ ${stop.event.ratingAverage.toFixed(1)} · ` : ""}
                {walkBudgetLabel(stop.event.priceRub ?? 0)}
                {stop.event.city !== "" ? ` · ${stop.event.city}` : ""}
              </p>
              <p className="app-walk-note">{stop.explanation}</p>
            </div>
          </li>
        ))}
      </ol>
      <AppButton className="app-walk-another" stretched onClick={onAnother}>
        Хочу новую прогулку
      </AppButton>
    </>
  );
}

export function WalkPage({ city, compose = (body) => apiClient.composeCityWalk(body), initialChoice = EMPTY_WALK_CHOICE }: { readonly city: string; readonly compose?: (body: ComposeCityWalkWrite) => Promise<CityWalk>; readonly initialChoice?: WalkChoice }) {
  const { navigate } = useRoute();
  const [choice, setChoice] = useState(initialChoice);
  const [excludeKeys, setExcludeKeys] = useState<readonly string[]>([]);
  const [phase, setPhase] = useState<"form" | "wait" | "ready">("form");
  const [walk, setWalk] = useState<CityWalk | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const live = useRef(true);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  async function onCompose(): Promise<void> {
    if (choice.durationMinutes === null || choice.budgetMode === null || !walkComposeReady(choice)) return;
    const durationMinutes = choice.durationMinutes;
    const budgetMode = choice.budgetMode;
    setError(null);
    setPhase("wait");
    try {
      const result = await compose({
        city,
        durationMinutes,
        budgetMode,
        budgetRub: budgetMode === "custom" ? choice.budgetRub : null,
        interests: [...choice.interests],
        excludeKeys: [...excludeKeys],
      });
      if (!live.current) return;
      setWalk(result);
      setNow(Date.now());
      setPhase("ready");
    } catch (caught) {
      if (!live.current) return;
      setError(walkErrorText(caught));
      setPhase("form");
    } finally {
      // Wait screen is pure CSS animation — no timers to clean up.
    }
  }

  function onAnother(): void {
    if (walk !== null) setExcludeKeys((keys) => [...keys, ...walkStopKeys(walk)]);
    setChoice(EMPTY_WALK_CHOICE);
    setWalk(null);
    setError(null);
    setPhase("form");
  }

  if (phase === "wait") {
    return (
      <section className="app-walk">
        <header className="app-walk-head">
          <h1 className="app-walk-title">Прогулка: {city}</h1>
        </header>
        <div className="app-walk-wait" aria-live="polite">
          <div className="app-walk-trail" aria-hidden="true">
            <svg viewBox="0 0 240 90" width="240" height="90" fill="none">
              <path className="app-walk-trail-path" d="M12 70 C 50 18, 95 86, 140 38 S 200 14, 228 32" stroke="var(--app-accent)" stroke-width="2.5" stroke-linecap="round" />
              <circle className="app-walk-trail-pin" cx="12" cy="70" r="7" fill="var(--app-text)" />
              <circle className="app-walk-trail-pin" cx="140" cy="38" r="7" fill="var(--app-text)" />
              <circle className="app-walk-trail-pin" cx="228" cy="32" r="7" fill="var(--app-accent)" />
            </svg>
          </div>
          <h2 className="app-walk-wait-title">{walkWaitTitle(city)}</h2>
          {choice.durationMinutes !== null ? <p className="app-walk-hint">{walkWaitSubtitle(choice.durationMinutes)}</p> : null}
          <div className="app-walk-wait-skeletons">
            {WAIT_SKELETONS.map((item) => (
              <div key={item} className="app-walk-wait-sk">
                <span className="app-walk-wait-sk-num" />
                <div>
                  <span className="app-walk-wait-sk-line" />
                  <span className="app-walk-wait-sk-line app-walk-wait-sk-line--short" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (phase === "ready" && walk !== null) {
    return <WalkResult city={city} walk={walk} now={now} onAnother={onAnother} onPlace={(id) => navigate({ name: "place", id })} onSaved={() => navigate({ name: "walks" })} onMap={() => navigate({ name: "map", walkId: walk.id })} />;
  }

  return (
    <WalkWizard
      city={city}
      choice={choice}
      onChange={setChoice}
      notice={error}
      onSaved={() => navigate({ name: "walks" })}
      onCompose={() => {
        void onCompose();
      }}
    />
  );
}
