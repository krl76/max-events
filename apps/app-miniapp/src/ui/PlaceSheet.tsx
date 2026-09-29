import { useMemo, useState } from "react";
import type { Place } from "@max-events/api-contracts";
import { PinPicker } from "./PinPicker";
import { useSheetSwipe } from "./sheet";

export interface PlaceChoice {
  /** What a person reads: a street, a venue, or the words they typed. */
  label: string;
  placeId: string | null;
  latitude?: number;
  longitude?: number;
}

/** Address first: a known place, words you type, or a map pin turned into a street. */
export function PlaceSheet({ title, places, onConfirm, onClose }: { title: string; places: readonly Place[]; onConfirm: (choice: PlaceChoice) => void; onClose: () => void }) {
  const swipe = useSheetSwipe(onClose);
  const [query, setQuery] = useState("");
  const [mapOpen, setMapOpen] = useState(false);
  const needle = query.trim().toLocaleLowerCase("ru");
  const matches = useMemo(() => {
    const ranked = needle === "" ? places : places.filter((place) => `${place.title} ${place.address}`.toLocaleLowerCase("ru").includes(needle));
    return ranked.slice(0, 6);
  }, [needle, places]);
  const exact = matches.some((place) => place.title.toLocaleLowerCase("ru") === needle || place.address.toLocaleLowerCase("ru") === needle);

  return (
    <div className="app-picker app-place-layer" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="app-picker-scrim" aria-label="Закрыть" onClick={onClose} />
      <div className="app-place-sheet app-sheet" style={swipe.style}>
        <div className="app-sheet-grab" aria-hidden="true" {...swipe.grab} />
        <p className="app-place-title">{title}</p>
        <input className="app-place-query" aria-label="Адрес или место" placeholder="Улица, парк, метро" value={query} onChange={(change) => setQuery(change.target.value)} />
        <ul className="app-place-list">
          {matches.map((place) => (
            <li key={place.id}>
              <button type="button" onClick={() => onConfirm({ label: place.address.trim() !== "" ? place.address : place.title, placeId: place.id })}>
                <span>{place.title}</span>
                {place.address.trim() !== "" && <small>{place.address}</small>}
              </button>
            </li>
          ))}
          {needle !== "" && !exact && (
            <li>
              <button type="button" onClick={() => onConfirm({ label: query.trim(), placeId: null })}>
                <span>Использовать «{query.trim()}»</span>
              </button>
            </li>
          )}
        </ul>
        <button type="button" className="app-place-map" onClick={() => setMapOpen(true)}>
          На карте
        </button>
      </div>
      {mapOpen && (
        <PinPicker
          title={title}
          places={places}
          onConfirm={(choice) => {
            onConfirm({ label: choice.address, placeId: null, latitude: choice.latitude, longitude: choice.longitude });
            setMapOpen(false);
          }}
          onClose={() => setMapOpen(false)}
        />
      )}
    </div>
  );
}
