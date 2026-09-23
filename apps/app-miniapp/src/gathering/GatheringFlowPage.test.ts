import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AVAILABILITY_LABELS, GatheringFlowView, type GatheringFlowState } from "./GatheringFlowPage";
import { friendAvailability, mockEvents } from "../api/mock";
import { FRIENDS_GRAPH_EMPTY_TEXT } from "../friends/friends-empty";

const friends = friendAvailability();

const readyState = (overrides: Partial<Extract<GatheringFlowState, { status: "ready" }>> = {}): GatheringFlowState => ({
  status: "ready",
  eventTitle: mockEvents[0].title,
  defaultMeetingAt: mockEvents[0].startsAt.slice(0, 16),
  friends,
  ...overrides,
});

const noop = () => {};

function viewHtml(state: GatheringFlowState, over: { selected?: string[]; meetingAt?: string; submitting?: boolean; failed?: boolean } = {}): string {
  return renderToStaticMarkup(
    createElement(GatheringFlowView, {
      state,
      selected: over.selected ?? [],
      meetingAt: over.meetingAt ?? "",
      submitting: over.submitting ?? false,
      failed: over.failed ?? false,
      onToggle: noop,
      onMeetingAt: noop,
      onLaunch: noop,
    }),
  );
}

describe("GatheringFlowView", () => {
  it("explains an empty friend picker instead of an empty box above a dead button", () => {
    const html = viewHtml(readyState({ friends: [] }), { meetingAt: "2026-09-19T19:00" });

    expect(html).toContain(FRIENDS_GRAPH_EMPTY_TEXT);
    expect(html).toContain("Собрать компанию");
  });

  it("renders every friend with their availability label before the launch", () => {
    const html = viewHtml(readyState(), { meetingAt: "2026-09-19T19:00" });

    expect(html).toContain("Собрать компанию");
    expect(html).toContain(mockEvents[0].title);
    for (const friend of friends) {
      expect(html).toContain(friend.friend.name);
      expect(html).toContain(AVAILABILITY_LABELS[friend.availability]);
    }
    expect(html).toContain("Запустить сбор");
  });

  it("marks exactly the selected friends via aria-pressed", () => {
    const html = viewHtml(readyState(), { selected: [friends[0].friend.id, friends[2].friend.id], meetingAt: "2026-09-19T19:00" });

    expect(html.match(/aria-pressed="true"/g)).toHaveLength(2);
    expect(html).toContain(`aria-pressed="false"`);
  });

  it("disables the launch CTA without a selected friend or a meeting time", () => {
    const noFriends = viewHtml(readyState(), { meetingAt: "2026-09-19T19:00" });
    const noTime = viewHtml(readyState(), { selected: [friends[0].friend.id] });
    const launchable = viewHtml(readyState(), { selected: [friends[0].friend.id], meetingAt: "2026-09-19T19:00" });

    expect(noFriends).toContain("disabled");
    expect(noTime).toContain("disabled");
    expect(launchable).not.toContain("disabled");
  });

  it("defaults the meeting time to the event start and renders a datetime input", () => {
    const html = viewHtml(readyState(), { meetingAt: mockEvents[0].startsAt.slice(0, 16) });

    expect(html).toContain('type="datetime-local"');
    expect(html).toContain(`value="${mockEvents[0].startsAt.slice(0, 16)}"`);
    expect(html).toContain("Когда встречаемся");
  });

  it("renders the submitting state and the launch failure hint", () => {
    const submitting = viewHtml(readyState(), { selected: [friends[0].friend.id], meetingAt: "2026-09-19T19:00", submitting: true });
    const failed = viewHtml(readyState(), { selected: [friends[0].friend.id], meetingAt: "2026-09-19T19:00", failed: true });

    expect(submitting).toContain("Запускаем…");
    expect(failed).toContain("Не удалось запустить сбор.");
  });

  it("renders loading and error states", () => {
    expect(viewHtml({ status: "loading" })).toContain("Загрузка…");
    expect(viewHtml({ status: "error" })).toContain("Не удалось загрузить друзей.");
  });
});
