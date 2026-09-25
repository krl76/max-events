import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Report } from "@max-events/api-contracts";
import type { ModerationTarget } from "../api/client";
import { APP_STATE_COPY } from "../ui/primitives";
import { ModerationCaseView, ModerationQueueView, type ModerationState } from "./ModerationPage";
import { MODERATION_CONFIRM_COPY, MODERATION_IRREVERSIBLE_NOTE, REPORT_REASON_LABELS, REPORT_TARGET_LABELS, groupModerationQueue } from "./ModerationQueue";

const EVENT_ID = "c0000001-0000-4000-8000-000000000001";

let seq = 0;

const report = (over: Partial<Report> = {}): Report => {
  seq += 1;
  return { id: `81000000-0000-4000-8000-${String(seq).padStart(12, "0")}`, userId: "a0000000-0000-4000-8000-0000000000b1", targetType: "event", targetId: EVENT_ID, reason: "inaccurate", status: "open", source: "user", createdAt: "2026-09-17T10:00:00+03:00", ...over };
};

const target: ModerationTarget = { targetType: "event", targetId: EVENT_ID, title: "Матч «Спартак» — «Динамо»", subtitle: "Москва", organizerId: "d0000001-0000-4000-8000-000000000001", organizerName: "Анна Соколова", reachCount: 14 };

const queue = (state: ModerationState, stream: "complaints" | "checks" = "complaints") => renderToStaticMarkup(createElement(ModerationQueueView, { state, stream }));

const caseView = (props: { reports: Report[]; targets: ModerationTarget[]; confirm?: "unpublish" | "ban" | null }) =>
  renderToStaticMarkup(
    createElement(ModerationCaseView, {
      group: groupModerationQueue(props.reports, props.targets, props.reports[0].source === "user" ? "complaints" : "checks")[0],
      confirm: props.confirm ?? null,
      busy: false,
      done: [],
      failed: false,
      onConfirm: () => {},
      onRun: () => {},
      onOpenTarget: () => {},
      onBack: () => {},
    }),
  );

describe("ModerationQueueView", () => {
  it("answers a viewer outside the moderator list with the «не в списке» state, not with an error", () => {
    const html = queue({ status: "forbidden" });

    expect(html).toContain(APP_STATE_COPY["not-moderator"].text);
    expect(html).not.toContain("Не удалось");
  });

  it("shows the moderator badge, both stream counters and one card per reported object", () => {
    const html = queue({ status: "ready", reports: [report(), report({ reason: "other" }), report({ source: "spot_check", targetType: "place", targetId: "b0000005-0000-4000-8000-000000000005" })], targets: [target] });

    expect(html).toContain("Только для модераторов");
    expect(html).toContain("Жалобы");
    expect(html).toContain("Проверка");
    expect(html).toContain(target.title);
    // Одна карточка на объект: две жалобы про одно событие — одна строка очереди.
    expect(html.split(target.title)).toHaveLength(2);
    expect(html).toContain("2 жалобы");
  });

  it("keeps a spot check out of the complaints stream and labels it as a check", () => {
    const rows = [report(), report({ source: "spot_check", targetType: "place", targetId: "b0000005-0000-4000-8000-000000000005" })];
    const checks = queue({ status: "ready", reports: rows, targets: [] }, "checks");

    expect(checks).toContain("Выборочная проверка");
    expect(checks).toContain(REPORT_TARGET_LABELS.place);
    expect(checks).not.toContain(REPORT_TARGET_LABELS.event);
  });
});

describe("ModerationCaseView", () => {
  it("opens the object, lists every complaint behind it and offers the way out of each", () => {
    const html = caseView({ reports: [report(), report({ reason: "spam" })], targets: [target] });

    expect(html).toContain(target.title);
    expect(html).toContain("Анна Соколова");
    expect(html).toContain(REPORT_REASON_LABELS.spam);
    expect(html).toContain("ДВЕ ЖАЛОБЫ");
    expect(html).toContain("Открыть");
    expect(html).toContain(MODERATION_IRREVERSIBLE_NOTE);
  });

  it("never runs an irreversible action on the first press: the verb appears only inside the confirmation", () => {
    const closed = caseView({ reports: [report()], targets: [target] });

    expect(closed).toContain(MODERATION_CONFIRM_COPY.unpublish.open);
    expect(closed).not.toContain(MODERATION_CONFIRM_COPY.unpublish.question);

    const open = caseView({ reports: [report()], targets: [target], confirm: "unpublish" });
    expect(open).toContain(MODERATION_CONFIRM_COPY.unpublish.question);
    expect(open).toContain(MODERATION_CONFIRM_COPY.unpublish.consequence);
  });

  it("offers no ban where the object has no author to ban", () => {
    const html = caseView({ reports: [report({ targetType: "place", targetId: "b0000005-0000-4000-8000-000000000005" })], targets: [{ ...target, targetType: "place", targetId: "b0000005-0000-4000-8000-000000000005", organizerId: null, organizerName: null }] });

    expect(html).not.toContain(MODERATION_CONFIRM_COPY.ban.open);
    expect(html).toContain(MODERATION_CONFIRM_COPY.unpublish.open);
  });
});
