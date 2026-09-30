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
import { pictured } from "./photos";
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

export function EventPicker<T extends PickableEvent>({
  title,
  events,
  selectedId = null,
  selectedIds,
  multiple = false,
  hint = null,
  confirmLabel = "Выбрать",
  max,
  onPick,
  onConfirm,
  onClose,
}: {
  title: string;
  events: T[];
  selectedId?: string | null;
  selectedIds?: readonly string[];
  multiple?: boolean;
  hint?: string | null;
  confirmLabel?: string;
  max?: number;
  onPick?: (event: T) => void;
  onConfirm?: (events: T[]) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>(() => (selectedIds ? [...selectedIds] : selectedId ? [selectedId] : []));
  const shown = filterEvents(events, query);
  const swipe = useSheetSwipe(onClose);
  const pickedSet = new Set(picked);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggle = (event: T) => {
    if (!multiple) {
      onPick?.(event);
      return;
    }
    setPicked((current) => {
      if (current.includes(event.id)) return current.filter((id) => id !== event.id);
      if (max !== undefined && current.length >= max) return current;
      return [...current, event.id];
    });
  };

  return (
    <div className="app-picker" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="app-picker-scrim" aria-label="Закрыть" onClick={onClose} />
      <div className="app-picker-sheet app-sheet" style={swipe.style}>
        <div className="app-sheet-grab" aria-hidden="true" {...swipe.grab} />
        <div className="app-picker-head">
          <h2 className="app-picker-title">{title}</h2>
        </div>
        {hint !== null && <p className="app-picker-hint">{hint}</p>}
        <input className="app-picker-search" aria-label="Найти событие" placeholder="Название или город" value={query} onChange={(change) => setQuery(change.target.value)} />
        {shown.length === 0 ? (
          <p className="app-picker-empty">{events.length === 0 ? "В афише пока нет событий." : "Ничего не нашлось. Попробуйте другое слово."}</p>
        ) : (
          <ul className="app-picker-list">
            {shown.map((event) => {
              const selected = pickedSet.has(event.id);
              const when = formatStartsAt(event.startsAt);
              const meta = event.city ? `${when} · ${event.city}` : when;
              return (
                <li key={event.id}>
                  <button type="button" className={selected ? "app-picker-event app-picker-event--on" : "app-picker-event"} aria-pressed={selected} onClick={() => toggle(event)}>
                    <AppMedia category={event.category} src={pictured(event.id, event.coverUrl)} className="app-picker-media" />
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
        {multiple && (
          <div className="app-picker-actions">
            <button type="button" className="app-fpick-cancel" onClick={onClose}>
              Отмена
            </button>
            <button
              type="button"
              className="app-fpick-confirm"
              disabled={picked.length === 0}
              onClick={() => {
                const chosen = events.filter((event) => pickedSet.has(event.id));
                onConfirm?.(chosen);
              }}
            >
              {picked.length > 1 ? `${confirmLabel} · ${picked.length}` : confirmLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
