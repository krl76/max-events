import { afterEach, describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GatheringStatusView, gatheringSummary, type GatheringStatusState } from "./GatheringStatusPage";
import { createMockGathering, mockEvents, mockFriendIds, resetMockGatherings } from "../api/mock";

const MEETING_AT = "2026-09-19T18:00:00.000Z";

function readyState(eventIndex: number, friendIndexes: number[]): GatheringStatusState {
  const gathering = createMockGathering({ eventId: mockEvents[eventIndex].id, friendIds: friendIndexes.map((index) => mockFriendIds[index]), proposedMeetingAt: MEETING_AT });
  if (!gathering) throw new Error("fixture gathering was rejected by the mock");
  return { status: "ready", gathering };
}

describe("gatheringSummary", () => {
  afterEach(() => {
    resetMockGatherings();
  });

  it("counts me plus the accepted invitees out of everyone invited", () => {
    const gathering = createMockGathering({ eventId: mockEvents[0].id, friendIds: [mockFriendIds[0], mockFriendIds[1], mockFriendIds[2], mockFriendIds[3]], proposedMeetingAt: MEETING_AT })!;

    expect(gatheringSummary(gathering)).toBe("Ты + 2 из 4");
  });

  it("is zero-based without acceptances", () => {
    const gathering = createMockGathering({ eventId: mockEvents[0].id, friendIds: [mockFriendIds[3], mockFriendIds[6]], proposedMeetingAt: MEETING_AT })!;

    expect(gatheringSummary(gathering)).toBe("Ты + 0 из 2");
  });
});

describe("GatheringStatusView", () => {
  afterEach(() => {
    resetMockGatherings();
  });

  it("renders every invitee answer and the summary from the API payload", () => {
    const html = renderToStaticMarkup(createElement(GatheringStatusView, { state: readyState(0, [1, 2, 3]) }));

    expect(html).toContain(mockEvents[0].title);
    expect(html).toContain("Дима Кузнецов");
    expect(html).toContain("подтвердил");
    expect(html).toContain("Катя Орлова");
    expect(html).toContain("смотрит");
    expect(html).toContain("Пётр Новиков");
    expect(html).toContain("занят");
    expect(html).toContain("Ты + 1 из 3");
  });

  it("renders loading and error states", () => {
    expect(renderToStaticMarkup(createElement(GatheringStatusView, { state: { status: "loading" } }))).toContain("Загрузка…");
    expect(renderToStaticMarkup(createElement(GatheringStatusView, { state: { status: "error" } }))).toContain("Не удалось загрузить сбор.");
  });

  it("renders the chat button only when the gathering has a chat link", () => {
    const withChat = renderToStaticMarkup(createElement(GatheringStatusView, { state: readyState(0, [0, 1]) }));
    expect(withChat).toContain("В чат сбора");

    const gathering = createMockGathering({ eventId: mockEvents[0].id, friendIds: [mockFriendIds[0]], proposedMeetingAt: MEETING_AT });
    if (!gathering) throw new Error("fixture gathering was rejected by the mock");
    const withoutChat = renderToStaticMarkup(createElement(GatheringStatusView, { state: { status: "ready", gathering: { ...gathering, chatLink: null } } }));
    expect(withoutChat).not.toContain("В чат сбора");
  });

  it("shows the answer buttons to an invitee and highlights the current answer", () => {
    const html = renderToStaticMarkup(createElement(GatheringStatusView, { state: readyState(0, [1, 2, 3]), myUserId: mockFriendIds[1] }));

    expect(html).toMatch(/<ion-button[^>]*aria-pressed[^>]*>Иду<\/ion-button>/);
    expect(html).not.toMatch(/<ion-button[^>]*aria-pressed[^>]*>Занят<\/ion-button>/);
    expect(html.match(/aria-pressed/g)).toHaveLength(1);
  });

  it("marks the declined answer as current instead", () => {
    const html = renderToStaticMarkup(createElement(GatheringStatusView, { state: readyState(0, [1, 2, 3]), myUserId: mockFriendIds[3] }));

    expect(html).not.toMatch(/<ion-button[^>]*aria-pressed[^>]*>Иду<\/ion-button>/);
    expect(html).toMatch(/<ion-button[^>]*aria-pressed[^>]*>Занят<\/ion-button>/);
  });

  it("hides the answer buttons from the host and without a known user", () => {
    const host = renderToStaticMarkup(createElement(GatheringStatusView, { state: readyState(0, [1, 2, 3]), myUserId: "e0000000-0000-4000-8000-0000000000ff" }));
    expect(host).not.toContain("Иду");
    expect(host).not.toContain("Занят");

    const anonymous = renderToStaticMarkup(createElement(GatheringStatusView, { state: readyState(0, [1, 2, 3]) }));
    expect(anonymous).not.toContain("Иду");
    expect(anonymous).not.toContain("Занят");
  });

  it("renders the response failure state", () => {
    const html = renderToStaticMarkup(createElement(GatheringStatusView, { state: readyState(0, [1, 2, 3]), myUserId: mockFriendIds[1], failed: true }));
    expect(html).toContain("Не удалось отправить ответ.");
  });
});
