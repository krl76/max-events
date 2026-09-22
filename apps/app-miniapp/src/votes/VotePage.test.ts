import { afterEach, describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { castMockBallot, getMockVote, MOCK_VOTE_ID, mockEvents, mockFriends, resetMockVotes } from "../api/mock";
import type { Vote } from "@max-events/api-contracts";
import { voteCreateReady, VoteCreateView, VoteView, type VoteState } from "./VotePage";
import { pluralRu } from "../catalog/format";

const noop = () => {};

afterEach(() => {
  resetMockVotes();
});

function seededVote(): Vote {
  const vote = getMockVote(MOCK_VOTE_ID);
  if (typeof vote === "string") throw new Error("seeded vote missing");
  return vote;
}

function viewHtml(over: { state?: VoteState; myChoice?: string | null; voting?: boolean; failed?: boolean; onShare?: () => void } = {}): string {
  return renderToStaticMarkup(createElement(VoteView, { state: over.state ?? { status: "ready", vote: seededVote() }, myChoice: over.myChoice ?? null, voting: over.voting ?? false, failed: over.failed ?? false, onVote: noop, onShare: over.onShare }));
}

describe("ru ballot counter label", () => {
  it("pluralizes the ballot counter in Russian", () => {
    expect(`1 ${pluralRu(1, "голос", "голоса", "голосов")}`).toBe("1 голос");
    expect(`2 ${pluralRu(2, "голос", "голоса", "голосов")}`).toBe("2 голоса");
    expect(`5 ${pluralRu(5, "голос", "голоса", "голосов")}`).toBe("5 голосов");
    expect(`11 ${pluralRu(11, "голос", "голоса", "голосов")}`).toBe("11 голосов");
    expect(`21 ${pluralRu(21, "голос", "голоса", "голосов")}`).toBe("21 голос");
  });
});

describe("VoteView", () => {
  it("renders the title, the option cards with counters and the chat hint", () => {
    const vote = seededVote();
    const html = viewHtml();

    expect(html).toContain(vote.title);
    expect(html).toContain("Отправлено в чат");
    expect(viewHtml({ onShare: noop })).toContain("Поделиться");
    expect(html).toContain("Участники:");
    for (const option of vote.options) {
      expect(html).toContain(option.event.title);
      expect(html).toContain(`${option.votes} ${pluralRu(option.votes, "голос", "голоса", "голосов")}`);
    }
  });

  it("highlights only the api-provided winner", () => {
    const vote = seededVote();
    const html = viewHtml();

    expect(vote.winnerEventId).not.toBeNull();
    expect(html.match(/app-vote-option--winner/g)).toHaveLength(1);
    expect(html).toContain("Лучший вариант");
  });

  it("marks the option the user voted for and keeps a re-vote possible", () => {
    const vote = seededVote();
    const mine = vote.options[1].event.id;
    const html = viewHtml({ myChoice: mine });

    expect(html).toContain("Твой голос");
    expect(html).not.toContain("disabled");
  });

  it("highlights «Твой голос» from the api-provided myBallotEventId on load", () => {
    const vote = seededVote();
    const voted = castMockBallot(vote.id, vote.options[2].event.id);
    if (typeof voted === "string") throw new Error("unexpected ballot failure");

    const html = viewHtml({ state: { status: "ready", vote: voted } });
    expect(voted.myBallotEventId).toBe(vote.options[2].event.id);
    expect(html).toContain("Твой голос");

    const withoutBallot = viewHtml({ state: { status: "ready", vote: { ...voted, myBallotEventId: null } } });
    expect(withoutBallot).not.toContain("Твой голос");
  });

  it("renders the forbidden state for a vote the user cannot access", () => {
    expect(viewHtml({ state: { status: "forbidden" } })).toContain("Голосование недоступно");
  });

  it("renders the not-found, error and ballot-failure states", () => {
    expect(viewHtml({ state: { status: "notfound" } })).toContain("Голосование не найдено");
    expect(viewHtml({ state: { status: "error" } })).toContain("Не удалось загрузить голосование");
    expect(viewHtml({ state: { status: "loading" } })).toContain("Загрузка");

    const failed = viewHtml({ failed: true });
    expect(failed).toContain("app-state--error");
    expect(failed).toContain("Не удалось отправить голос");
  });

  it("shows the fresh tally after a ballot", () => {
    const vote = seededVote();
    const target = vote.options[2];
    const next = castMockBallot(vote.id, target.event.id);
    if (typeof next === "string") throw new Error("unexpected ballot failure");
    const html = viewHtml({ state: { status: "ready", vote: next }, myChoice: target.event.id });

    expect(html).toContain(`${target.votes + 1} ${pluralRu(target.votes + 1, "голос", "голоса", "голосов")}`);
    expect(html).toContain("Твой голос");
  });
});

describe("voteCreateReady", () => {
  it("requires a title, at least two events and one friend", () => {
    expect(voteCreateReady("Куда идем?", ["e1", "e2"], ["f1"])).toBe(true);
    expect(voteCreateReady("  ", ["e1", "e2"], ["f1"])).toBe(false);
    expect(voteCreateReady("Куда идем?", ["e1"], ["f1"])).toBe(false);
    expect(voteCreateReady("Куда идем?", ["e1", "e2"], [])).toBe(false);
  });
});

describe("VoteCreateView", () => {
  function createHtml(over: { title?: string; selectedEvents?: string[]; selectedFriends?: string[]; submitting?: boolean; failed?: boolean } = {}): string {
    return renderToStaticMarkup(
      createElement(VoteCreateView, {
        events: mockEvents.slice(0, 3),
        friends: mockFriends.slice(0, 3),
        title: over.title ?? "Куда идем в пятницу?",
        selectedEvents: over.selectedEvents ?? mockEvents.slice(0, 3).map((event) => event.id),
        selectedFriends: over.selectedFriends ?? [],
        submitting: over.submitting ?? false,
        failed: over.failed ?? false,
        onTitle: noop,
        onToggleEvent: noop,
        onToggleFriend: noop,
        onSubmit: noop,
        onCancel: noop,
      }),
    );
  }

  it("renders the question field, the event and friend chips", () => {
    const html = createHtml();

    expect(html).toContain("Куда идем в пятницу?");
    for (const event of mockEvents.slice(0, 3)) expect(html).toContain(event.title);
    for (const friend of mockFriends.slice(0, 3)) expect(html).toContain(friend.name);
    expect(html).toContain("Назад к подборке");
  });

  it("disables submit until a friend is picked and reports a creation failure", () => {
    const notReady = createHtml();
    expect(notReady).toContain("disabled");

    const ready = createHtml({ selectedFriends: [mockFriends[0].id] });
    expect(ready).not.toContain("disabled");

    const failed = createHtml({ failed: true });
    expect(failed).toContain("app-state--error");
    expect(failed).toContain("Не удалось создать голосование");
  });
});
