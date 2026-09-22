import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Report } from "@max-events/api-contracts";
import { ACTION_DONE_LABELS, ModerationView, REPORT_REASON_LABELS, REPORT_TARGET_LABELS, type ModerationAction, type ModerationState } from "./ModerationPage";

const report = (over: Partial<Report> = {}): Report => ({
  id: "81000000-0000-4000-8000-000000000001",
  userId: "a0000000-0000-4000-8000-000000000001",
  targetType: "event",
  targetId: "c0000001-0000-4000-8000-000000000001",
  reason: "spam",
  status: "open",
  source: "user",
  createdAt: "2026-09-17T10:00:00+03:00",
  ...over,
});

const ORGANIZER_ID = "b0000000-0000-4000-8000-000000000001";

const view = (state: ModerationState, props: { busyId?: string | null; done?: Record<string, ModerationAction[]>; organizers?: Record<string, string>; failed?: boolean } = {}) => renderToStaticMarkup(createElement(ModerationView, { state, ...props }));

describe("ModerationView", () => {
  it("shows nothing at all to a viewer the backend refuses", () => {
    // Not an empty screen and not an error: for a regular user the queue does not exist.
    expect(view({ status: "forbidden" })).toBe("");
  });

  it("lists an open report with what it is about and how it can be answered", () => {
    const html = view({ status: "ready", reports: [report()] }, { organizers: { [report().id]: ORGANIZER_ID } });

    expect(html).toContain(REPORT_TARGET_LABELS.event);
    expect(html).toContain(REPORT_REASON_LABELS.spam);
    expect(html).toContain("жалоба");
    expect(html).toContain("Снять с публикации");
    expect(html).toContain("Забанить организатора");
    expect(html).toContain("Закрыть жалобу");
  });

  it("offers no ban where there is no organizer to ban, and marks a moderator's own check", () => {
    const html = view({ status: "ready", reports: [report({ targetType: "feed_post", source: "spot_check", reason: "inappropriate" })] });

    expect(html).toContain(REPORT_TARGET_LABELS.feed_post);
    expect(html).toContain("проверка модератора");
    // A post or a place has no organizer account behind it: the button would have nobody to ban.
    expect(html).not.toContain("Забанить организатора");
    expect(html).toContain("Снять с публикации");
    // Even an event report loses the ban button when the organizer behind it could not be resolved.
    expect(view({ status: "ready", reports: [report()] })).not.toContain("Забанить организатора");
  });

  it("reports the empty queue, the loading and the failures", () => {
    expect(view({ status: "ready", reports: [] })).toContain("Очередь пуста");
    expect(view({ status: "loading" })).toContain("Загружаем жалобы…");
    expect(view({ status: "error" })).toContain("Не удалось загрузить очередь жалоб.");
    expect(view({ status: "ready", reports: [report()] }, { failed: true })).toContain("Не удалось выполнить действие.");
    // While one report is being acted on, its own buttons stop accepting a second press.
    expect(view({ status: "ready", reports: [report()] }, { busyId: report().id })).toContain("disabled");
    // A sanction leaves the report in the queue and says so, so the other sanction is still reachable —
    // but the sanction already applied cannot be applied a second time.
    const acted = view({ status: "ready", reports: [report()] }, { done: { [report().id]: ["unpublish"] }, organizers: { [report().id]: ORGANIZER_ID } });
    expect(acted).toContain(ACTION_DONE_LABELS.unpublish);
    expect(acted).toContain('disabled="" aria-label="Снять с публикации');
    expect(acted).not.toContain('disabled="" aria-label="Забанить организатора');
    expect(view({ status: "ready", reports: [report()] })).not.toContain("disabled");
  });
});
