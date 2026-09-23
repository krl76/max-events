// START_MODULE_CONTRACT
// PURPOSE: Moderator queue: the open reports, and the three answers to one — unpublish, ban, dismiss.
// SCOPE: ModerationView is presentational; ModerationPage loads GET /reports?status=open and hides itself on 403, because that is the backend's answer to everyone outside MODERATOR_MAX_USER_IDS. Each button does one thing: a sanction leaves the report open (so both sanctions stay reachable) and only «Закрыть жалобу» resolves it. Banning needs the organizer behind the target, and the event stops being readable the moment it is unpublished, so the organizer is looked up once while the queue loads.
// DEPENDS: ../api/client.js (apiClient, ApiError), @max-events/api-contracts (Report, ReportReason, ReportTargetType), ../ui/primitives.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - REPORT_REASON_LABELS - ru labels per report reason
// - REPORT_TARGET_LABELS - ru labels per report target type
// - REPORT_SOURCE_LABELS - ru labels: a complaint or a moderator's own spot check
// - ModerationAction - unpublish | ban | dismiss, the three answers to one report
// - ACTION_DONE_LABELS - what the row says once an action went through
// - ModerationState - queue fetch state union (loading / forbidden / error / ready)
// - reportOrganizers - organizer behind each event report, looked up once while the event is still published
// - ModerationView - presentational: one row per open report with its actions
// - ModerationPage - container: loads the queue, wires unpublish / ban / dismiss
// - ModerationEntry - profile tile that appears only for a viewer the backend lets into the queue
// END_MODULE_MAP

import { useCallback, useEffect, useState } from "react";
import type { Report, ReportReason, ReportSource, ReportTargetType } from "@max-events/api-contracts";
import { ApiError, apiClient } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useRoute } from "../routing/router";
import { AppButton, AppNavTiles, AppSection, AppState } from "../ui/primitives";

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: "Спам",
  abuse: "Оскорбления",
  inaccurate: "Недостоверно",
  inappropriate: "Неуместное",
  other: "Другое",
};

export const REPORT_TARGET_LABELS: Record<ReportTargetType, string> = {
  event: "Событие",
  place: "Место",
  feed_post: "Пост",
  micro_event: "Микро-событие",
};

export const REPORT_SOURCE_LABELS: Record<ReportSource, string> = { user: "жалоба", spot_check: "проверка модератора" };

export type ModerationAction = "unpublish" | "ban" | "dismiss";

export const ACTION_DONE_LABELS: Record<ModerationAction, string> = { unpublish: "Снято с публикации", ban: "Организатор забанен", dismiss: "Жалоба закрыта" };

export type ModerationState = { status: "loading" } | { status: "forbidden" } | { status: "error" } | { status: "ready"; reports: Report[] };

/**
 * Only an event report leads to an account, and only through the event itself. Unpublishing hides the
 * event (the backend answers 404 for it afterwards), so the lookup happens while the queue loads —
 * after a sanction it would be too late. A report whose organizer cannot be found gets no ban button.
 */
export async function reportOrganizers(reports: Report[], viewerId: string): Promise<Record<string, string>> {
  const events = reports.filter((report) => report.targetType === "event");
  const found = await Promise.all(
    events.map((report) =>
      apiClient.getEventDetails(report.targetId, viewerId).then(
        (details) => [report.id, details.organizer?.id ?? null] as const,
        () => [report.id, null] as const,
      ),
    ),
  );
  return Object.fromEntries(found.filter((pair): pair is readonly [string, string] => pair[1] !== null));
}

interface ModerationViewProps {
  state: ModerationState;
  busyId?: string | null;
  done?: Record<string, ModerationAction[]>;
  organizers?: Record<string, string>;
  failed?: boolean;
  onUnpublish?: (report: Report) => void;
  onBan?: (report: Report) => void;
  onDismiss?: (report: Report) => void;
}

export function ModerationView({ state, busyId = null, done = {}, organizers = {}, failed = false, onUnpublish = () => {}, onBan = () => {}, onDismiss = () => {} }: ModerationViewProps) {
  // Not an error a regular user should read: the queue simply is not theirs, so the block disappears.
  if (state.status === "forbidden") return null;
  if (state.status === "loading") return <AppState>Загружаем жалобы…</AppState>;
  if (state.status === "error") return <AppState error>Не удалось загрузить очередь жалоб.</AppState>;
  return (
    <AppSection title="Жалобы">
      {state.reports.length === 0 ? (
        <p className="app-today-summary">Очередь пуста — открытых жалоб нет.</p>
      ) : (
        <ul className="app-participation-counters">
          {state.reports.map((report) => (
            <li key={report.id} className="app-moderation-row">
              <span className="app-card-title">
                {REPORT_TARGET_LABELS[report.targetType]}: {REPORT_REASON_LABELS[report.reason]}
              </span>
              <span className="app-card-subtitle">
                {REPORT_SOURCE_LABELS[report.source]} · {report.targetId}
              </span>
              {(done[report.id] ?? []).length > 0 && <span className="app-card-subtitle">{(done[report.id] ?? []).map((action) => ACTION_DONE_LABELS[action]).join(" · ")}</span>}
              <span className="app-moderation-actions">
                <AppButton size="small" tone="danger" disabled={busyId === report.id || (done[report.id] ?? []).includes("unpublish")} onClick={() => onUnpublish(report)} aria-label={`Снять с публикации: ${report.targetId}`}>
                  Снять с публикации
                </AppButton>
                {/* Only where an organizer was actually found: elsewhere the button would have nobody to ban. */}
                {organizers[report.id] !== undefined && (
                  <AppButton size="small" tone="danger" disabled={busyId === report.id || (done[report.id] ?? []).includes("ban")} onClick={() => onBan(report)} aria-label={`Забанить организатора: ${report.targetId}`}>
                    Забанить организатора
                  </AppButton>
                )}
                <AppButton size="small" tone="secondary" disabled={busyId === report.id} onClick={() => onDismiss(report)} aria-label={`Закрыть жалобу: ${report.targetId}`}>
                  Закрыть жалобу
                </AppButton>
              </span>
            </li>
          ))}
        </ul>
      )}
      {failed && <AppState error>Не удалось выполнить действие.</AppState>}
    </AppSection>
  );
}

export function ModerationPage() {
  const auth = useAuth();
  const userId = auth.status === "authenticated" ? auth.user.id : null;
  const [state, setState] = useState<ModerationState>({ status: "loading" });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, ModerationAction[]>>({});
  const [organizers, setOrganizers] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    let alive = true;
    apiClient.listOpenReports().then(
      (reports) => {
        if (!alive) return;
        setState({ status: "ready", reports });
        setFailed(false);
        reportOrganizers(reports, userId ?? "").then((found) => {
          if (alive) setOrganizers(found);
        });
      },
      (reason: unknown) => {
        // 403 is the backend saying "not a moderator", which is a state, not a failure.
        if (alive) setState({ status: reason instanceof ApiError && reason.status === 403 ? "forbidden" : "error" });
      },
    );
    return () => {
      alive = false;
    };
  }, [reloads, userId]);

  /**
   * A sanction leaves the report open: unpublishing and banning are separate answers, and closing the
   * report is the moderator's own third button. Otherwise the first press would take the queue row
   * away and with it the chance to also ban the organizer behind it.
   */
  const act = useCallback((report: Report, run: Promise<unknown>, action: ModerationAction) => {
    setBusyId(report.id);
    setFailed(false);
    run.then(
      () => {
        setBusyId(null);
        setDone((current) => ({ ...current, [report.id]: [...(current[report.id] ?? []), action] }));
      },
      () => {
        setBusyId(null);
        setFailed(true);
      },
    );
  }, []);

  return (
    <ModerationView
      state={state}
      busyId={busyId}
      done={done}
      organizers={organizers}
      failed={failed}
      onUnpublish={(report) => act(report, apiClient.unpublishTarget({ targetType: report.targetType, targetId: report.targetId }), "unpublish")}
      onBan={(report) => {
        const organizerId = organizers[report.id];
        if (organizerId !== undefined) act(report, apiClient.banOrganizer(organizerId), "ban");
      }}
      onDismiss={(report) =>
        act(
          report,
          apiClient.resolveReport(report.id).then(() => {
            setReloads((value) => value + 1);
          }),
          "dismiss",
        )
      }
    />
  );
}

export function ModerationEntry() {
  const { navigate } = useRoute();
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    // The same probe as the screen: only a moderator gets a list instead of a 403, and only then a tile.
    apiClient.listOpenReports().then(
      (reports) => {
        if (alive) setOpen(reports.length);
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, []);

  if (open === null) return null;
  return <AppNavTiles items={[{ icon: "alert", label: open === 0 ? "Жалобы" : `Жалобы · ${open}`, onClick: () => navigate({ name: "moderation" }) }]} />;
}
