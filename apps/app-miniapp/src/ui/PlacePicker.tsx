import { useEffect, useState } from "react";
import type { Place } from "@max-events/api-contracts";
import { ActionIcon } from "./icons";
import { useSheetSwipe } from "./sheet";

export function filterPlaces<T extends Pick<Place, "title" | "address">>(places: T[], query: string): T[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return places;
  return places.filter((place) => place.title.toLowerCase().includes(needle) || place.address.toLowerCase().includes(needle));
}

export function PlacePicker<T extends Pick<Place, "id" | "title" | "address">>({ title, places, selectedId = null, hint = null, onPick, onClose }: { title: string; places: T[]; selectedId?: string | null; hint?: string | null; onPick: (place: T) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const shown = filterPlaces(places, query);
  const swipe = useSheetSwipe(onClose);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="app-picker" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="app-picker-scrim" aria-label="Закрыть" onClick={onClose} />
      <div className="app-picker-sheet app-sheet" style={swipe.style}>
        <div className="app-sheet-grab" aria-hidden="true" {...swipe.grab} />
        <div className="app-picker-head">
          <h2 className="app-picker-title">{title}</h2>
        </div>
        {hint !== null && <p className="app-picker-hint">{hint}</p>}
        <input className="app-picker-search" aria-label="Найти место" placeholder="Название или адрес" value={query} onChange={(change) => setQuery(change.target.value)} />
        {shown.length === 0 ? (
          <p className="app-picker-empty">{places.length === 0 ? "Пока нет мест." : "Ничего не нашлось. Попробуйте другое слово."}</p>
        ) : (
          <ul className="app-picker-list">
            {shown.map((place) => {
              const selected = place.id === selectedId;
              return (
                <li key={place.id}>
                  <button type="button" className={selected ? "app-picker-event app-picker-event--on" : "app-picker-event"} aria-pressed={selected} onClick={() => onPick(place)}>
                    <span className="app-picker-place-mark" aria-hidden="true">
                      <ActionIcon name="pin" size={18} strokeWidth={2.2} />
                    </span>
                    <span className="app-picker-copy">
                      <span className="app-picker-name">{place.title}</span>
                      {place.address.trim() !== "" && <span className="app-picker-meta">{place.address}</span>}
                    </span>
                    {selected && <ActionIcon name="check" size={18} strokeWidth={2.6} />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
