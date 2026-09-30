import { useEffect, useState } from "react";
import { apiClient, type OrganizerSummary } from "../api/client";
import { AppChip, AppSkeletonList, AppState } from "../ui/primitives";
import { PROMO_PERIODS, TRAFFIC_SOURCE_LABELS, WEEKDAY_LABELS, barHeights, formatCount, periodQueryFor, trafficLead } from "./OrganizerDashboard";

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
      <div className="app-filters-chips" role="group" aria-label="Период">
        {PROMO_PERIODS.map((period) => (
          <AppChip key={period.days} pressed={days === period.days} onClick={() => setDays(period.days)}>
            {period.label}
          </AppChip>
        ))}
      </div>
      {failed && <AppState error>Не удалось загрузить источники регистраций.</AppState>}
      {summary === null && !failed && <AppSkeletonList rows={3} />}
      {summary !== null && (
        <>
          <div className="app-org-tiles">
            <div className="app-org-tile">
              <span className="app-org-tile-label">Регистрации</span>
              <span className="app-org-tile-big">{formatCount(summary.bookings)}</span>
            </div>
            <div className="app-org-tile">
              <span className="app-org-tile-label">Дошли до входа</span>
              <span className="app-org-tile-big">{summary.attendedPercent === null ? "—" : `${summary.attendedPercent}%`}</span>
            </div>
          </div>
          {lead !== null && (
            <div className="app-org-sources">
              <span className="app-org-chart-title">{lead.lead}</span>
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
