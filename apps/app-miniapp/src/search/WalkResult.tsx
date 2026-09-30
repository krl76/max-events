import type { CityWalk, CityWalkStop } from "@max-events/api-contracts";
import { pluralRu } from "../catalog/format";
import { ApiError } from "../api/endpoints/transport";
import { AppButton } from "../ui/primitives";
import { ActionIcon } from "../ui/icons";

export function walkStopPhoto(stop: { readonly imageUrl?: string | null }): string | null {
  const value = stop.imageUrl?.trim() ?? "";
  return value.startsWith("https://") ? value : null;
}

/** The catalog fallback «Место в городе …» does not describe the sight, so the card leaves it out. */
export function walkStopBlurb(description: string): string | null {
  const text = description.trim();
  if (text === "" || /^Место в городе .+\.$/.test(text)) return null;
  return text;
}

export function WalkStopMedia({ stop }: { readonly stop: { readonly imageUrl?: string | null } }) {
  const photo = walkStopPhoto(stop);
  if (photo === null) return null;
  return <img className="app-walk-photo" alt="" src={photo} />;
}

const DWELL_MINUTES = 20;

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
    <button type="button" className="app-walk-place" onClick={() => onPlace(placeId)}>
      {stop.title}
    </button>
  );
}

export function walkShareText(walk: CityWalk): string {
  return `Прогулка по городу ${walk.city} в Афише MAX`;
}

export function WalkResult({ city, walk, now, onAnother, onPlace, onSaved, onMap, onShare }: { readonly city: string; readonly walk: CityWalk; readonly now: number; readonly onAnother: () => void; readonly onPlace: (id: string) => void; readonly onSaved?: () => void; readonly onMap?: () => void; readonly onShare?: () => void }) {
  const count = walk.stops.length;
  const travel = walk.legs.reduce((sum, leg) => sum + leg.travelMinutes, 0);
  return (
    <section className="app-walk">
      <header className="app-walk-head">
        <h1 className="app-walk-title">Прогулка: {city}</h1>
      </header>
      {walk.sourceLabel === "catalog" ? <p className="app-walk-note">Маршрут из каталога</p> : null}
      <p className="app-walk-saved-flag">
        <ActionIcon name="check" size={14} />
        Сохранено в мои прогулки
      </p>
      <ul className="app-walk-stats">
        <li className="app-walk-stat">
          <strong>{walk.fitted ? travelLabel(travel) : "Дольше выбранного времени"}</strong>
          <span>{walk.fitted ? "в пути" : "время"}</span>
        </li>
        <li className="app-walk-stat">
          <strong>{count}</strong>
          <span>{pluralRu(count, "место", "места", "мест")}</span>
        </li>
        <li className="app-walk-stat">
          <strong>{moneyLabel(legBudget(walk.legs))}</strong>
          <span>бюджет</span>
        </li>
      </ul>
      <ol className="app-walk-stops">
        {walk.stops.map((stop, index) => {
          const leg = walk.legs[index];
          const blurb = walkStopBlurb(stop.description);
          return (
            <li key={stop.sourceUrl} className="app-walk-stop app-walk-stop--card">
              <div className="app-walk-stop-body">
                <span className="app-walk-num">{stop.order}</span>
                <p className="app-walk-meta">
                  {arrivalLabel(now, index, walk.legs)}
                  {leg !== undefined ? ` · ${leg.travelMinutes} мин пешком` : ""}
                </p>
                <StopTitle stop={stop} onPlace={onPlace} />
                <p className="app-walk-meta">{stop.address}</p>
                {blurb !== null ? <p className="app-walk-note">{blurb}</p> : null}
              </div>
              <WalkStopMedia stop={stop} />
            </li>
          );
        })}
      </ol>
      <div className="app-walk-dock">
        <AppButton className="app-walk-another" stretched onClick={onAnother}>
          Хочу новую прогулку
        </AppButton>
        {onSaved !== undefined || onMap !== undefined || onShare !== undefined ? (
          <div className="app-walk-dock-row">
            {onSaved !== undefined ? (
              <button type="button" className="app-walk-dock-btn" onClick={onSaved}>
                <ActionIcon name="check" size={16} />
                <span>Мои прогулки</span>
              </button>
            ) : null}
            {onMap !== undefined ? (
              <button type="button" className="app-walk-dock-btn" onClick={onMap}>
                <ActionIcon name="pin" size={16} />
                <span>Маршрут</span>
              </button>
            ) : null}
            {onShare !== undefined ? (
              <button type="button" className="app-walk-dock-btn" onClick={onShare}>
                <ActionIcon name="share" size={16} />
                <span>Отправить в MAX</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
