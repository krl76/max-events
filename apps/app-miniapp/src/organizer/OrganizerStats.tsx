import { useEffect, useState } from "react";
import { apiClient, type OrganizerSummary } from "../api/client";
import { AppSkeletonList, AppState } from "../ui/primitives";
import { PROMO_PERIODS, TRAFFIC_SOURCE_LABELS, WEEKDAY_LABELS, barHeights, formatCount, formatDelta, periodQueryFor, trafficLead } from "./OrganizerDashboard";

export function OrganizerStats({ embedded = false }: { embedded?: boolean } = {}) {
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState<OrganizerSummary | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    setSummary(null);
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

  const lead = summary === null ? null : trafficLead(summary.sources);
  return (
    <section className="app-gathering" aria-label="Источники регистраций">
      {!embedded && <h1 className="app-section-title">Источники регистраций</h1>}
      <p className="app-gathering-hint">Откуда гости находят события организации в MAX: чаты, лента и поиск.</p>
      <div className="app-evt-filters" role="tablist" aria-label="Период">
        {PROMO_PERIODS.map((period) => (
          <button key={period.days} type="button" role="tab" aria-selected={days === period.days} className={days === period.days ? "app-evt-filter app-evt-filter--on" : "app-evt-filter"} onClick={() => setDays(period.days)}>
            {period.label}
          </button>
        ))}
      </div>
      {failed && <AppState error>Не удалось загрузить источники регистраций.</AppState>}
      {summary === null && !failed && <AppSkeletonList rows={3} />}
      {summary !== null && (
        <>
          <div className="app-org-tiles">
            <div className="app-org-tile">
              <span className="app-org-tile-label">Регистрации за период</span>
              <span className="app-org-tile-big">{formatCount(summary.bookings)}</span>
              <span className="app-org-tile-note">{formatDelta(summary.bookingsDeltaPercent)}</span>
            </div>
            <div className="app-org-tile">
              <span className="app-org-tile-label">Дошли до входа</span>
              <span className="app-org-tile-big">{summary.attendedPercent === null ? "Нет данных" : `${summary.attendedPercent}%`}</span>
              <span className="app-org-tile-note">по контролю входа</span>
            </div>
          </div>
          {lead !== null && (
            <div className="app-org-sources">
              <span className="app-org-chart-title">{lead.lead}</span>
              {lead.rest !== "" && <span className="app-org-tile-note">{lead.rest}</span>}
              {summary.bookings === 0 && <span className="app-org-tile-note">За период регистраций нет: это измеренный ноль, а не отсутствие учёта.</span>}
              {summary.sources.map((row) => (
                <div key={row.source} className="app-org-source">
                  <span className="app-org-source-label">{TRAFFIC_SOURCE_LABELS[row.source]}</span>
                  <span className="app-org-source-track" aria-hidden="true">
                    <span className={`app-org-source-fill app-org-source-fill--${row.source}`} style={{ width: `${row.percent}%` }} />
                  </span>
                  <span className="app-org-source-value">{row.percent}%</span>
                </div>
              ))}
            </div>
          )}
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
        </>
      )}
    </section>
  );
}
