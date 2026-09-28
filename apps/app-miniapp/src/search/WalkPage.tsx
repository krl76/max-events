import { useState } from "react";
import type { AssistDayResponse } from "@max-events/api-contracts";
import { pluralRu } from "../catalog/format";
import { useRoute } from "../routing/router";
import { AppButton, AppState } from "../ui/primitives";
import { EMPTY_WALK_CHOICE, WalkWizard } from "./WalkWizard";

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

export type WalkState = { status: "loading" } | { status: "error" } | { status: "ready"; day: AssistDayResponse };

export function WalkView({ city, state, onBack, onAnother }: { readonly city: string; readonly state: WalkState; readonly onBack: () => void; readonly onAnother: () => void }) {
  return (
    <section className="app-walk">
      <button type="button" className="app-walk-back" onClick={onBack}>
        Назад
      </button>
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

export function WalkPage({ city }: { readonly city: string }) {
  const { back } = useRoute();
  const [choice, setChoice] = useState(EMPTY_WALK_CHOICE);
  return <WalkWizard city={city} choice={choice} onChange={setChoice} onBack={back} />;
}
