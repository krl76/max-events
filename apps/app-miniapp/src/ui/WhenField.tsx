import { useState } from "react";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

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

export function WhenField({ value, label, onChange }: { value: string; label: string; onChange: (value: string) => void }) {
  const parsed = value === "" || Number.isNaN(new Date(value).getTime()) ? new Date() : new Date(value);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => new Date(parsed.getFullYear(), parsed.getMonth(), 1));
  const [hour, setHour] = useState(parsed.getHours());
  const [minute, setMinute] = useState(parsed.getMinutes() - (parsed.getMinutes() % 5));

  const pickDay = (day: number) => {
    const next = new Date(cursor.getFullYear(), cursor.getMonth(), day, hour, minute);
    onChange(whenValue(next));
  };

  return (
    <div className="app-when">
      <button type="button" className={value === "" ? "app-when-open app-when-open--empty" : "app-when-open"} aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        {value === "" ? label : whenLabel(value)}
      </button>
      {open && (
        <div className="app-when-sheet" role="dialog" aria-label={label}>
          <div className="app-when-month">
            <button type="button" aria-label="Предыдущий месяц" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
              ‹
            </button>
            <span>{cursor.toLocaleString("ru-RU", { month: "long", year: "numeric" })}</span>
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
            {monthCells(cursor).map((cell, index) =>
              cell.outside ? (
                <span key={`out-${index}`} className="app-when-day app-when-day--out" />
              ) : (
                <button key={cell.day} type="button" className={parsed.getDate() === cell.day && parsed.getMonth() === cursor.getMonth() && value !== "" ? "app-when-day app-when-day--on" : "app-when-day"} onClick={() => pickDay(cell.day)}>
                  {cell.day}
                </button>
              ),
            )}
          </div>
          <div className="app-when-dials">
            <div className="app-when-dial" role="listbox" aria-label="Час">
              {Array.from({ length: 24 }, (_, index) => (
                <button key={index} type="button" role="option" aria-selected={hour === index} className={hour === index ? "app-when-tick app-when-tick--on" : "app-when-tick"} onClick={() => { setHour(index); if (value !== "") onChange(whenValue(new Date(cursor.getFullYear(), cursor.getMonth(), parsed.getDate(), index, minute))); }}>
                  {pad(index)}
                </button>
              ))}
            </div>
            <div className="app-when-dial" role="listbox" aria-label="Минуты">
              {Array.from({ length: 12 }, (_, index) => index * 5).map((step) => (
                <button key={step} type="button" role="option" aria-selected={minute === step} className={minute === step ? "app-when-tick app-when-tick--on" : "app-when-tick"} onClick={() => { setMinute(step); if (value !== "") { onChange(whenValue(new Date(cursor.getFullYear(), cursor.getMonth(), parsed.getDate(), hour, step))); setOpen(false); } }}>
                  {pad(step)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
