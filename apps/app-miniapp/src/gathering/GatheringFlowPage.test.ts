import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GatheringFlowView, gatheringFriends, type GatheringFlowState } from "./GatheringFlowPage";
import { friendAvailability, mockEvents } from "../api/mock";
import { FRIENDS_GRAPH_EMPTY_TEXT } from "../friends/friends-empty";
import { friendHandle } from "../ui/friend-handle";

const friends = friendAvailability();

const readyState = (overrides: Partial<Extract<GatheringFlowState, { status: "ready" }>> = {}): GatheringFlowState => ({
  status: "ready",
  eventTitle: mockEvents[0].title,
  defaultMeetingAt: mockEvents[0].startsAt.slice(0, 16),
  friends,
  ...overrides,
});

const noop = () => {};

function viewHtml(state: GatheringFlowState, over: { selected?: string[]; meetingAt?: string; submitting?: boolean; failed?: boolean; picking?: boolean } = {}): string {
  return renderToStaticMarkup(
    createElement(GatheringFlowView, {
      state,
      selected: over.selected ?? [],
      meetingAt: over.meetingAt ?? "",
      submitting: over.submitting ?? false,
      failed: over.failed ?? false,
      picking: over.picking ?? false,
      onSelected: noop,
      onMeetingAt: noop,
      onLaunch: noop,
      onOpenPicker: noop,
      onClosePicker: noop,
    }),
  );
}

describe("gatheringFriends", () => {
  it("unwraps availability rows into the Friend list the picker expects", () => {
    expect(gatheringFriends(friends).map((friend) => friend.id)).toEqual(friends.map((row) => row.friend.id));
  });
});

describe("GatheringFlowView", () => {
  it("explains an empty friend picker instead of an empty box above a dead button", () => {
    const html = viewHtml(readyState({ friends: [] }), { meetingAt: "2026-09-19T19:00" });

    expect(html).toContain(FRIENDS_GRAPH_EMPTY_TEXT);
    expect(html).toContain("Собрать компанию");
    expect(html).toContain("Пригласить в MAX");
    expect(html).not.toContain("Выбрать людей");
  });

  it("opens people from the FriendPicker sheet: search, avatar and nick in one column", () => {
    const html = viewHtml(readyState(), { picking: true, meetingAt: "2026-09-19T19:00" });

    expect(html).toContain("Кого позвать");
    expect(html).toContain("Имя друга");
    expect(html).toContain('aria-label="Поиск по имени"');
    expect(html).toContain("app-fpick-list");
    for (const row of friends) {
      expect(html).toContain(row.friend.name);
      expect(html).toContain(`@${friendHandle(row.friend)}`);
    }
  });

  it("shows selected people as a column of avatar and nick, with a way to reopen the sheet", () => {
    const first = friends[0].friend;
    const html = viewHtml(readyState(), { selected: [first.id], meetingAt: "2026-09-19T19:00" });

    expect(html).toContain(first.name);
    expect(html).toContain(`@${friendHandle(first)}`);
    expect(html).toContain("Изменить");
    expect(html).not.toContain("app-gathering-friend");
  });

  it("disables the launch CTA without a meeting time and lets the host start without friends", () => {
    const noFriends = viewHtml(readyState(), { meetingAt: "2026-09-19T19:00" });
    const noTime = viewHtml(readyState(), { selected: [friends[0].friend.id] });
    const launchable = viewHtml(readyState(), { selected: [friends[0].friend.id], meetingAt: "2026-09-19T19:00" });
    const emptyGraph = viewHtml(readyState({ friends: [] }), { meetingAt: "2026-09-19T19:00" });

    expect(noFriends).toContain("Выбрать людей");
    expect(noTime).toContain("disabled");
    expect(launchable).not.toContain("disabled");
    expect(emptyGraph).toContain("Запустить сбор");
    expect(emptyGraph).toContain("Пригласить в MAX");
  });

  it("defaults the meeting time to the event start and opens the same calendar as other create screens", () => {
    const html = viewHtml(readyState(), { meetingAt: mockEvents[0].startsAt.slice(0, 16) });

    expect(html).not.toContain('type="datetime-local"');
    expect(html).toContain("Когда встречаемся");
    expect(html).toContain("app-when-open");
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
