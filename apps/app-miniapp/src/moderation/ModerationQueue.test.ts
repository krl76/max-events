import { describe, expect, it } from "vitest";
import type { Report } from "@max-events/api-contracts";
import type { ModerationTarget } from "../api/client";
import { MODERATION_CONFIRM_COPY, REPORT_REASON_LABELS, claimsTitle, formatClaimWhen, groupModerationQueue, moderationStreamCounts, reasonSummary } from "./ModerationQueue";

const EVENT_ID = "c0000001-0000-4000-8000-000000000001";
const POST_ID = "30000000-0000-4000-8000-000000000001";

let seq = 0;

const report = (over: Partial<Report> = {}): Report => {
  seq += 1;
  return {
    id: `81000000-0000-4000-8000-${String(seq).padStart(12, "0")}`,
    userId: "a0000000-0000-4000-8000-0000000000b1",
    targetType: "event",
    targetId: EVENT_ID,
    reason: "inaccurate",
    status: "open",
    source: "user",
    createdAt: "2026-09-17T10:00:00+03:00",
    ...over,
  };
};

const target = (over: Partial<ModerationTarget> = {}): ModerationTarget => ({ targetType: "event", targetId: EVENT_ID, title: "Матч «Спартак» — «Динамо»", subtitle: "Москва", organizerId: "d0000001-0000-4000-8000-000000000001", organizerName: "Анна Соколова", reachCount: 14, ...over });

describe("groupModerationQueue", () => {
  it("makes one card per reported object and counts the rows behind it", () => {
    const groups = groupModerationQueue([report(), report({ reason: "other" }), report({ targetType: "feed_post", targetId: POST_ID, reason: "spam" })], [target(), target({ targetType: "feed_post", targetId: POST_ID, title: "«Приходите, места хватит всем»" })], "complaints");

    expect(groups).toHaveLength(2);
    // Busiest object first: three complaints about one event are one decision, not three.
    expect(groups[0]).toMatchObject({ targetId: EVENT_ID, count: 2, title: "Матч «Спартак» — «Динамо»" });
    expect(groups[1]).toMatchObject({ targetId: POST_ID, count: 1 });
  });

  it("keeps the two streams apart", () => {
    const rows = [report(), report({ source: "spot_check", targetType: "feed_post", targetId: POST_ID })];

    expect(groupModerationQueue(rows, [], "complaints").map((group) => group.targetId)).toEqual([EVENT_ID]);
    expect(groupModerationQueue(rows, [], "checks").map((group) => group.targetId)).toEqual([POST_ID]);
    expect(moderationStreamCounts(rows)).toEqual({ complaints: 1, checks: 1 });
  });

  it("still lists a card whose object could not be resolved, instead of dropping the queue row", () => {
    const [group] = groupModerationQueue([report()], [], "complaints");

    expect(group.title).toBe("Объект недоступен");
    expect(group.target).toBeNull();
  });
});

describe("reasonSummary", () => {
  it("says one reason when the rows agree and the two loudest when they do not", () => {
    expect(reasonSummary([report(), report()])).toBe(REPORT_REASON_LABELS.inaccurate);
    expect(reasonSummary([report(), report({ reason: "spam" }), report({ reason: "spam" })])).toBe(`${REPORT_REASON_LABELS.spam} · ${REPORT_REASON_LABELS.inaccurate}`);
  });
});

describe("claimsTitle", () => {
  it("spells the count out up to ten and falls back to the digit past it", () => {
    expect(claimsTitle(1, "user")).toBe("ОДНА ЖАЛОБА");
    expect(claimsTitle(3, "user")).toBe("ТРИ ЖАЛОБЫ");
    expect(claimsTitle(5, "user")).toBe("ПЯТЬ ЖАЛОБ");
    expect(claimsTitle(12, "user")).toBe("12 ЖАЛОБ");
  });

  it("names a spot check for what it is, not as a complaint", () => {
    expect(claimsTitle(1, "spot_check")).toBe("ВЫБОРОЧНАЯ ПРОВЕРКА");
  });
});

describe("formatClaimWhen", () => {
  const now = new Date("2026-09-18T12:00:00+03:00");

  it("reads today, yesterday and the date", () => {
    expect(formatClaimWhen("2026-09-18T14:20:00+03:00", now)).toBe("сегодня 14:20");
    expect(formatClaimWhen("2026-09-17T23:10:00+03:00", now)).toBe("вчера 23:10");
    expect(formatClaimWhen("2026-09-16T09:00:00+03:00", now)).toBe("16 сентября");
  });
});

describe("MODERATION_CONFIRM_COPY", () => {
  it("names the consequence of both irreversible actions before the verb that runs them", () => {
    for (const action of ["unpublish", "ban"] as const) {
      expect(MODERATION_CONFIRM_COPY[action].question).toMatch(/\?$/);
      expect(MODERATION_CONFIRM_COPY[action].consequence.length).toBeGreaterThan(40);
      expect(MODERATION_CONFIRM_COPY[action].verb).not.toBe(MODERATION_CONFIRM_COPY[action].open);
    }
  });
});
