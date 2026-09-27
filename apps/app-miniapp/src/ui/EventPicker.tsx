// START_MODULE_CONTRACT
// PURPOSE: Bottom sheet for choosing an event by its cover, title and time — one window for a post, a story and a plan.
// SCOPE: Presentational. The caller owns the event list and what a pick means. Escape, the scrim and «Закрыть» dismiss it.
// DEPENDS: react, @max-events/api-contracts (EventCategory), ../catalog/format.js (formatStartsAt), ./icons.js, ./primitives.js (AppMedia)
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PickableEvent - the fields the sheet can draw; a full Event satisfies it
// - filterEvents - case-insensitive match on title or city; a blank query returns the list
// - EventPicker - the sheet
// END_MODULE_MAP

import { useEffect, useState } from "react";
import type { EventCategory } from "@max-events/api-contracts";
import { formatStartsAt } from "../catalog/format";
import { ActionIcon } from "./icons";
import { AppMedia } from "./primitives";
import { useSheetSwipe } from "./sheet";

export interface PickableEvent {
  id: string;
  title: string;
  startsAt: string;
  coverUrl?: string | null;
  category?: EventCategory;
  city?: string | null;
}

export function filterEvents<T extends PickableEvent>(events: T[], query: string): T[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return events;
  return events.filter((event) => event.title.toLowerCase().includes(needle) || (event.city ?? "").toLowerCase().includes(needle));
}

export function EventPicker<T extends PickableEvent>({ title, events, selectedId, onPick, onClose }: { title: string; events: T[]; selectedId: string | null; onPick: (event: T) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const shown = filterEvents(events, query);
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
        <input className="app-picker-search" aria-label="Найти событие" placeholder="Название или город" value={query} onChange={(change) => setQuery(change.target.value)} />
        {shown.length === 0 ? (
          <p className="app-picker-empty">{events.length === 0 ? "В афише пока нет событий." : "Ничего не нашлось. Попробуйте другое слово."}</p>
        ) : (
          <ul className="app-picker-list">
            {shown.map((event) => {
              const selected = event.id === selectedId;
              const when = formatStartsAt(event.startsAt);
              const meta = event.city ? `${when} · ${event.city}` : when;
              return (
                <li key={event.id}>
                  <button type="button" className={selected ? "app-picker-event app-picker-event--on" : "app-picker-event"} aria-pressed={selected} onClick={() => onPick(event)}>
                    <AppMedia category={event.category} src={event.coverUrl} className="app-picker-media" />
                    <span className="app-picker-copy">
                      <span className="app-picker-name">{event.title}</span>
                      <span className="app-picker-meta">{meta}</span>
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
