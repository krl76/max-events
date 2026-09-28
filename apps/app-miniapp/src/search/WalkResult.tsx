import type { CityWalk, CityWalkStop } from "@max-events/api-contracts";
import { pluralRu } from "../catalog/format";
import { ApiError } from "../api/endpoints/transport";
import { AppButton } from "../ui/primitives";

const DWELL_MINUTES = 20;

export function walkWaitLine(city: string, step: 0 | 1 | 2): string {
  if (step === 0) return `Ищем места в ${city}`;
  if (step === 1) return "Собираем порядок";
  return "Считаем пешие ноги";
}

export function walkErrorText(error: unknown): string {
  if (error instanceof ApiError && error.status === 422) return "В этом городе пока нет двух мест для прогулки.";
  return "Не удалось собрать прогулку.";
}

export function walkStopKeys(walk: CityWalk): readonly string[] {
  const keys: string[] = [];
  for (const stop of walk.stops) {
    keys.push(stop.sourceUrl);
    if (stop.placeId !== null) keys.push(stop.placeId);
  }
  return keys;
}

export function walkArrivalOffsetMinutes(index: number, legs: readonly { readonly travelMinutes: number }[]): number {
  let minutes = 0;
  for (let i = 0; i < index; i += 1) minutes += DWELL_MINUTES + (legs[i]?.travelMinutes ?? 0);
  return minutes;
}

function arrivalLabel(now: number, index: number, legs: readonly { readonly travelMinutes: number }[]): string {
  return new Date(now + walkArrivalOffsetMinutes(index, legs) * 60_000).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function legBudget(legs: readonly { readonly priceRub: number | null }[]): number {
  return legs.reduce((sum, leg) => sum + (leg.priceRub ?? 0), 0);
}

function moneyLabel(total: number): string {
  if (total <= 0) return "Бесплатно";
  return `${total.toLocaleString("ru-RU")} ₽`;
}

function travelLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} мин`;
  if (rest === 0) return `${hours} ч`;
  return `${hours} ч ${rest} мин`;
}

function StopTitle({ stop, onPlace }: { readonly stop: CityWalkStop; readonly onPlace: (id: string) => void }) {
  const placeId = stop.placeId;
  if (placeId === null) return <h3>{stop.title}</h3>;
  return (
    <button type="button" className="app-walk-back" onClick={() => onPlace(placeId)}>
      {stop.title}
    </button>
  );
}

export function WalkResult({
  city,
  walk,
  now,
  onBack,
  onAnother,
  onPlace,
}: {
  readonly city: string;
  readonly walk: CityWalk;
  readonly now: number;
  readonly onBack: () => void;
  readonly onAnother: () => void;
  readonly onPlace: (id: string) => void;
}) {
  const count = walk.stops.length;
  const travel = walk.legs.reduce((sum, leg) => sum + leg.travelMinutes, 0);
  return (
    <section className="app-walk">
      <button type="button" className="app-walk-back" onClick={onBack}>
        Назад
      </button>
      <h1 className="app-walk-title">Прогулка: {city}</h1>
      {walk.sourceLabel === "catalog" ? <p className="app-walk-note">Маршрут из каталога</p> : null}
      <ul className="app-walk-stats">
        <li className="app-walk-stat">
          <strong>{walk.fitted ? travelLabel(travel) : "Дольше выбранного времени"}</strong>
          <span>{walk.fitted ? "в пути" : "время"}</span>
        </li>
        <li className="app-walk-stat">
          <strong>{count}</strong>
          <span>{pluralRu(count, "достопримечательность", "достопримечательности", "достопримечательностей")}</span>
        </li>
        <li className="app-walk-stat">
          <strong>{moneyLabel(legBudget(walk.legs))}</strong>
          <span>бюджет</span>
        </li>
      </ul>
      <ol className="app-walk-stops">
        {walk.stops.map((stop, index) => {
          const leg = walk.legs[index];
          return (
            <li key={stop.sourceUrl} className="app-walk-stop">
              <span className="app-walk-num">{stop.order}</span>
              <div>
                <p className="app-walk-meta">{arrivalLabel(now, index, walk.legs)}</p>
                <StopTitle stop={stop} onPlace={onPlace} />
                <p className="app-walk-meta">{stop.address}</p>
                <p className="app-walk-note">{stop.description}</p>
                {leg !== undefined ? <p className="app-walk-meta">{leg.travelMinutes} мин пешком</p> : null}
              </div>
            </li>
          );
        })}
      </ol>
      <AppButton className="app-walk-another" stretched onClick={onAnother}>
        Хочу новую прогулку
      </AppButton>
    </section>
  );
}
