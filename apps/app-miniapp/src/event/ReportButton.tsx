// START_MODULE_CONTRACT
// PURPOSE: "Пожаловаться" control for the event/place/feed pages: preset reasons, mock submission and the post-moderation states (sent / already sent).
// SCOPE: Presentational ReportMenu plus the ReportButton container that submits reports via apiClient; a 409 duplicate is mapped to the "already reported" state.
// DEPENDS: ../api/client.js (ApiError, apiClient, REPORT_REASONS, ReportReason), ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - REPORT_REASON_LABELS - ru labels of the report reason presets
// - ReportMenu - presentational: reason preset buttons or the submitted state
// - ReportButton - container: opens the menu, submits the report for an event/place/feed post target, maps 409 to the already-reported state
// END_MODULE_MAP

import { useCallback, useState } from "react";
import { ApiError, apiClient, REPORT_REASONS, type ReportReason } from "../api/client";
import { ActionIcon } from "../ui/icons";
import { AppChip } from "../ui/primitives";

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: "Спам или реклама",
  abuse: "Оскорбления",
  inaccurate: "Неверная информация о событии",
  inappropriate: "Неуместный контент",
  other: "Другое",
};

export function ReportMenu({ onReport, sending, done }: { onReport: (reason: ReportReason) => void; sending: boolean; done: string | null }) {
  if (done !== null) return <p className="app-review-sent">{done}</p>;
  return (
    <div className="app-report-reasons">
      {REPORT_REASONS.map((reason) => (
        <AppChip key={reason} disabled={sending} onClick={() => onReport(reason)}>
          {REPORT_REASON_LABELS[reason]}
        </AppChip>
      ))}
    </div>
  );
}

export function ReportButton({ target, userId, mode = "inline" }: { target: { eventId: string } | { placeId: string } | { feedPostId: string }; userId: string; mode?: "inline" | "dialog" }) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const report = useCallback(
    (reason: ReportReason) => {
      setSending(true);
      apiClient
        .createReport({ userId, ...target, reason })
        .then(() => setDone("Жалоба отправлена. Мы её проверим."))
        .catch((error: unknown) => {
          if (error instanceof ApiError && error.status === 409) setDone("Жалоба уже отправлена.");
        })
        .finally(() => setSending(false));
    },
    [target, userId],
  );

  if (mode === "dialog") {
    return (
      <>
        <button type="button" className="app-post-more" aria-label="Пожаловаться" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
          <ActionIcon name="dots" size={20} />
        </button>
        {open && (
          <div className="app-me-pop" role="dialog" aria-modal="true" aria-label="Пожаловаться">
            <button type="button" className="app-me-pop-scrim" aria-label="Закрыть" onClick={() => setOpen(false)} />
            <div className="app-me-pop-card">
              <h2 className="app-me-pop-title">Пожаловаться</h2>
              <ReportMenu onReport={report} sending={sending} done={done} />
              <button type="button" className="app-me-pop-action app-me-pop-action--ghost" onClick={() => setOpen(false)}>
                Закрыть
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <section className="app-event">
      <div className="app-event-body">
        {done === null && !open ? (
          <button type="button" className="app-report-button" onClick={() => setOpen(true)}>
            Пожаловаться
          </button>
        ) : (
          <ReportMenu onReport={report} sending={sending} done={done} />
        )}
      </div>
    </section>
  );
}
