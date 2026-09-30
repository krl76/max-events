import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSheetSwipe } from "./sheet";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MINUTE_STEPS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55] as const;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** `YYYY-MM-DDTHH:mm` in local time, the same shape datetime-local used to produce. */
export function whenValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function whenLabel(value: string): string {
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return "Выберите дату и время";
  return at.toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

/** «Сентябрь 2026» — month name starts a heading, so it is capitalised. */
export function whenMonthTitle(cursor: Date): string {
  const raw = cursor.toLocaleString("ru-RU", { month: "long", year: "numeric" }).replace(/\sг\.?$/, "");
  return raw.length === 0 ? raw : `${raw.charAt(0).toUpperCase()}${raw.slice(1)}`;
}

/** «4 сентября · 04:00» under the calendar, so date and time read as one choice. */
export function whenSummary(value: string): string | null {
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return null;
  const day = at.toLocaleString("ru-RU", { day: "numeric", month: "long" });
  return `${day} · ${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

function monthCells(cursor: Date): Array<{ day: number; outside: boolean }> {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = (first.getDay() + 6) % 7;
  const days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells: Array<{ day: number; outside: boolean }> = [];
  const prevDays = new Date(cursor.getFullYear(), cursor.getMonth(), 0).getDate();
  for (let index = 0; index < start; index += 1) cells.push({ day: prevDays - start + index + 1, outside: true });
  for (let day = 1; day <= days; day += 1) cells.push({ day, outside: false });
  while (cells.length % 7 !== 0) cells.push({ day: cells.length % 7, outside: true });
  return cells;
}

export function WhenField({ value, label, title, onChange }: { value: string; label: string; title?: string; onChange: (value: string) => void }) {
  const parsed = value === "" || Number.isNaN(new Date(value).getTime()) ? new Date() : new Date(value);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => new Date(parsed.getFullYear(), parsed.getMonth(), 1));
  const [hour, setHour] = useState(parsed.getHours());
  const [minute, setMinute] = useState(parsed.getMinutes() - (parsed.getMinutes() % 5));
  const host = typeof document === "undefined" ? null : (document.querySelector(".app-root") ?? document.body);
  const swipe = useSheetSwipe(() => setOpen(false));
  const hourRef = useRef<HTMLButtonElement | null>(null);
  const minuteRef = useRef<HTMLButtonElement | null>(null);
  const today = new Date();
  const selectedDay = value === "" ? null : parsed.getDate();
  const selectedMonth = parsed.getMonth();
  const picked = value === "" ? null : whenSummary(value);

  useEffect(() => {
    if (!open) return;
    hourRef.current?.scrollIntoView({ block: "center" });
    minuteRef.current?.scrollIntoView({ block: "center" });
  }, [open]);

  const commit = (day: number, nextHour: number, nextMinute: number) => {
    onChange(whenValue(new Date(cursor.getFullYear(), cursor.getMonth(), day, nextHour, nextMinute)));
  };

  const activeDay = selectedDay !== null && selectedMonth === cursor.getMonth() ? selectedDay : parsed.getDate();

  const sheet =
    open && host !== null
      ? createPortal(
          <div className="app-picker" role="dialog" aria-modal="true" aria-label={title ?? label}>
            <button type="button" className="app-picker-scrim" aria-label="Закрыть" onClick={() => setOpen(false)} />
            <div className="app-picker-sheet app-when-sheet app-sheet" style={swipe.style}>
              <div className="app-sheet-grab" aria-hidden="true" {...swipe.grab} />
              <h2 className="app-picker-title">{title ?? label}</h2>
              {picked !== null && <p className="app-when-picked">{picked}</p>}
              <div className="app-when-month">
                <button type="button" aria-label="Предыдущий месяц" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
                  ‹
                </button>
                <span>{whenMonthTitle(cursor)}</span>
                <button type="button" aria-label="Следующий месяц" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
                  ›
                </button>
              </div>
              <div className="app-when-week">
                {WEEKDAYS.map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
              <div className="app-when-grid">
                {monthCells(cursor).map((cell, index) => {
                  if (cell.outside) return <span key={`out-${index}`} className="app-when-day app-when-day--out" />;
                  const isOn = selectedDay === cell.day && selectedMonth === cursor.getMonth();
                  const isToday = cell.day === today.getDate() && cursor.getMonth() === today.getMonth() && cursor.getFullYear() === today.getFullYear();
                  return (
                    <button
                      key={cell.day}
                      type="button"
                      className={`app-when-day${isOn ? " app-when-day--on" : ""}${isToday ? " app-when-day--today" : ""}`}
                      onClick={() => commit(cell.day, hour, minute)}
                    >
                      {cell.day}
                    </button>
                  );
                })}
              </div>
              <div className="app-when-time">
                <div className="app-when-time-col">
                  <span className="app-when-time-k">Час</span>
                  <div className="app-when-time-list" role="listbox" aria-label="Час">
                    {Array.from({ length: 24 }, (_, index) => (
                      <button
                        key={index}
                        type="button"
                        role="option"
                        ref={hour === index ? hourRef : undefined}
                        aria-selected={hour === index}
                        className={hour === index ? "app-when-tick app-when-tick--on" : "app-when-tick"}
                        onClick={() => {
                          setHour(index);
                          commit(activeDay, index, minute);
                        }}
                      >
                        {pad(index)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="app-when-time-col">
                  <span className="app-when-time-k">Минуты</span>
                  <div className="app-when-time-list" role="listbox" aria-label="Минуты">
                    {MINUTE_STEPS.map((step) => (
                      <button
                        key={step}
                        type="button"
                        role="option"
                        ref={minute === step ? minuteRef : undefined}
                        aria-selected={minute === step}
                        className={minute === step ? "app-when-tick app-when-tick--on" : "app-when-tick"}
                        onClick={() => {
                          setMinute(step);
                          commit(activeDay, hour, step);
                        }}
                      >
                        {pad(step)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button type="button" className="app-when-done" onClick={() => setOpen(false)}>
                Готово
              </button>
            </div>
          </div>,
          host,
        )
      : null;

  return (
    <div className="app-when">
      <button type="button" className={value === "" ? "app-when-open app-when-open--empty" : "app-when-open"} aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        {value === "" ? label : whenLabel(value)}
      </button>
      {sheet}
    </div>
  );
}
