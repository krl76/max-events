import { useEffect, useState } from "react";
import { apiClient, type OrganizerSummary, type OrganizerTrafficSource } from "../api/client";
import { AppChip, AppSkeletonList, AppState } from "../ui/primitives";
import { PROMO_PERIODS, WEEKDAY_LABELS, barHeights, periodQueryFor } from "./OrganizerDashboard";

const SOURCE_LABEL: Record<OrganizerTrafficSource | "unknown", string> = { chats: "Чаты", feed: "Лента", search: "Поиск", unknown: "Не определён" };

export function OrganizerStats() {
  const [days, setDays] = useState(7);
  const [summary, setSummary] = useState<OrganizerSummary | null>(null);
  const [failed, setFailed] = useState(false);
  const [metric, setMetric] = useState<"registrations">("registrations");

  useEffect(() => {
    let alive = true;
    setFailed(false);
    apiClient.getOrganizerSummary(periodQueryFor(days)).then(
      (payload) => {
        if (alive) setSummary(payload);
      },
      () => {
        if (alive) setFailed(true);
      },
    );
    return () => {
      alive = false;
    };
  }, [days]);

  const known = summary === null ? 0 : summary.sources.reduce((sum, row) => sum + row.percent, 0);
  const unknown = summary !== null && summary.bookings > 0 && known === 0 ? 100 : 0;
  return (
    <section className="app-gathering" aria-label="Статистика">
      <h1 className="app-section-title">Статистика</h1>
      <div className="app-filters-chips" role="group" aria-label="Период">
        {PROMO_PERIODS.map((period) => (
          <AppChip key={period.days} pressed={days === period.days} onClick={() => setDays(period.days)}>
            {period.label}
          </AppChip>
        ))}
      </div>
      <p className="app-gathering-hint">Цифры по всем событиям организации. Отдельный фильтр по одному событию кабинет пока не считает. Просмотры страниц не передаются — для них нет данных, это не ноль. Оплата на внешнем сайте не считается покупкой здесь.</p>
      {failed && <AppState error>Не удалось загрузить статистику.</AppState>}
      {summary === null && !failed && <AppSkeletonList rows={3} />}
      {summary !== null && (
        <>
          <div className="app-org-tiles">
            <button type="button" className="app-org-tile" onClick={() => setMetric("registrations")}>
              <span className="app-org-tile-label">Подтверждённые регистрации</span>
              <span className="app-org-tile-big">{summary.bookings}</span>
            </button>
            <div className="app-org-tile">
              <span className="app-org-tile-label">Просмотры страниц</span>
              <span className="app-org-tile-big">Нет данных</span>
            </div>
            <div className="app-org-tile">
              <span className="app-org-tile-label">Посещения по контролю входа</span>
              <span className="app-org-tile-big">{summary.attendedPercent === null ? "Нет данных" : `${summary.attendedPercent}%`}</span>
            </div>
          </div>
          {metric === "registrations" && (
            <div className="app-org-chart">
              <span className="app-org-chart-title">Регистрации по дням недели</span>
              <span className="app-org-chart-bars" aria-hidden="true">
                {barHeights(summary.byWeekday).map((bar, index) => (
                  <span key={WEEKDAY_LABELS[index]} className={bar.accent ? "app-org-bar app-org-bar--on" : "app-org-bar"} style={{ height: `${bar.height}%` }} />
                ))}
              </span>
              <span className="app-org-chart-days" aria-hidden="true">
                {WEEKDAY_LABELS.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </span>
            </div>
          )}
          <h2 className="app-section-title">Источники регистраций</h2>
          {summary.bookings === 0 && <p className="app-gathering-hint">За период регистраций нет: это измеренный ноль, а не отсутствие учёта.</p>}
          {summary.sources.map((row) => (
            <p key={row.source} className="app-set-row-hint">
              {SOURCE_LABEL[row.source]} · {row.percent}%
            </p>
          ))}
          {unknown > 0 && <p className="app-set-row-hint">Не определён · записи без сохранённого источника</p>}
        </>
      )}
    </section>
  );
}
