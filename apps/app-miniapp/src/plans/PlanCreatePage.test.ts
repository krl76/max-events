import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CreatePlanWriteSchema } from "@max-events/api-contracts";
import { PlanCreateView, planDraftReady, planRecurringRule, planRepeatLabel, wallClockToIso, type PlanDraft } from "./PlanCreatePage";
import { mockEvents, mockFriends } from "../api/mock";

const draft: PlanDraft = { event: mockEvents[0]!.title, meetingPoint: "у метро Смоленская", meetingAt: "2026-09-19T18:20", participantIds: [], repeat: "none", weekday: 4, nth: 1 };

const view = (over: Partial<PlanDraft> = {}, props: { submitting?: boolean; failed?: boolean } = {}) => renderToStaticMarkup(createElement(PlanCreateView, { draft: { ...draft, ...over }, events: mockEvents, places: [], friends: mockFriends, ...props, onDraft: () => {}, onToggleFriend: () => {}, onSubmit: () => {} }));

describe("planRecurringRule", () => {
  it("builds the rule the contract accepts, and nothing for a one-off", () => {
    expect(planRecurringRule({ repeat: "none", weekday: 4, nth: 1 })).toBeUndefined();
    expect(planRecurringRule({ repeat: "weekly", weekday: 4, nth: 1 })).toEqual({ type: "weekly_weekday", weekday: 4 });
    expect(planRecurringRule({ repeat: "monthly", weekday: 6, nth: 1 })).toEqual({ type: "monthly_nth_weekday", nth: 1, weekday: 6 });

    // The write payload has to survive the contract, rule and all.
    const payload = { eventId: mockEvents[0]!.id, participantIds: [], meetingPoint: "у метро", meetingAt: "2026-09-19T18:20:00+03:00", recurringRule: planRecurringRule({ repeat: "monthly", weekday: 6, nth: 1 })! };
    expect(CreatePlanWriteSchema.safeParse(payload)).toMatchObject({ success: true });
  });
});

describe("planRepeatLabel", () => {
  it("reads a rule back in words", () => {
    expect(planRepeatLabel(null)).toBeNull();
    expect(planRepeatLabel({ type: "weekly_weekday", weekday: 4 })).toBe("каждый четверг");
    expect(planRepeatLabel({ type: "monthly_nth_weekday", nth: 1, weekday: 6 })).toBe("в первую субботу месяца");
    // Gender and case follow the day: «каждую субботу», not «каждый субботу».
    expect(planRepeatLabel({ type: "weekly_weekday", weekday: 6 })).toBe("каждую субботу");
    expect(planRepeatLabel({ type: "weekly_weekday", weekday: 7 })).toBe("каждое воскресенье");
    expect(planRepeatLabel({ type: "monthly_nth_weekday", nth: 5, weekday: 4 })).toBe("в последний четверг месяца");
  });
});

describe("wallClockToIso", () => {
  it("turns the calendar value into an instant with a timezone", () => {
    const iso = wallClockToIso("2026-09-19T18:20");
    expect(iso).not.toBeNull();
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    expect(wallClockToIso("")).toBeNull();
  });
});

describe("planDraftReady", () => {
  it("wants an event from the list, a place and a time", () => {
    expect(planDraftReady(draft, mockEvents)).toBe(true);
    // A title nobody offered is not an event: the form cannot turn it into an eventId.
    expect(planDraftReady({ ...draft, event: "Какое-то своё" }, mockEvents)).toBe(false);
    expect(planDraftReady({ ...draft, meetingPoint: "   " }, mockEvents)).toBe(false);
    expect(planDraftReady({ ...draft, meetingAt: "" }, mockEvents)).toBe(false);
  });
});

describe("PlanCreateView", () => {
  it("asks for the event, the meeting and who is invited", () => {
    const html = view();

    expect(html).toContain("Событие");
    expect(html).toContain("Где встречаемся");
    expect(html).toContain("Когда встречаемся");
    expect(html).toContain("Пригласить друзей");
    expect(html).toContain("у метро Смоленская");
    expect(html).toContain("Создать план");
  });

  it("keeps the submit idle until the required fields are in", () => {
    const html = view({ event: "", meetingPoint: "", meetingAt: "" });

    expect(html).toContain("Заполните поля");
    expect(html).toContain("disabled");
  });

  it("offers the three repeat choices without a gray explanation, and address or map for the place", () => {
    const once = view();
    expect(once).toContain("Один раз");
    expect(once).toContain("Каждую неделю");
    expect(once).toContain("Раз в месяц");
    expect(once).not.toContain("Повторяется");
    expect(once).toContain("Адрес");
    expect(once).toContain("Карта");
    expect(once).toContain("app-me-tab-pill");

    const weekly = view({ repeat: "weekly" });
    expect(weekly).not.toContain("Повторяется");
    expect(weekly).not.toContain("Какая неделя месяца");
    expect(view({ repeat: "monthly", weekday: 6 })).not.toContain("Повторяется");
  });

  it("names the missing fields and reports a failure", () => {
    expect(view({ event: "Какое-то своё" })).toContain("Какое-то своё");
    expect(view()).toContain(mockEvents[0]!.title);
    expect(view({}, { submitting: true })).toContain("Создаём…");
    expect(view({}, { failed: true })).toContain("Не удалось создать план.");
  });
});
