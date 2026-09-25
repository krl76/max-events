import { afterEach, describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { VoteScreen } from "../api/client";
import { castMockBallot, getMockVote, MOCK_VOTE_ID, mockDemoUser, resetMockVotes } from "../api/mock";
import { pluralRu } from "../catalog/format";
import { VoteView, voteBallotsCast, voteMineNote, votePendingNote, votePercent, voteProgressLabel, type VoteState } from "./VotePage";

const noop = () => {};

afterEach(() => {
  resetMockVotes();
});

function seededVote(): VoteScreen {
  const vote = getMockVote(MOCK_VOTE_ID);
  if (typeof vote === "string") throw new Error("seeded vote missing");
  return vote;
}

function render(over: { state?: VoteState; ownId?: string | null; myChoice?: string | null; revoting?: boolean; closing?: boolean; failed?: boolean } = {}): string {
  return renderToStaticMarkup(
    createElement(VoteView, {
      state: over.state ?? { status: "ready", vote: seededVote() },
      ownId: over.ownId === undefined ? mockDemoUser.id : over.ownId,
      myChoice: over.myChoice ?? null,
      voting: false,
      closing: over.closing ?? false,
      revoting: over.revoting ?? false,
      failed: over.failed ?? false,
      onBack: noop,
      onVote: noop,
      onRevote: noop,
      onClose: noop,
      onChat: noop,
      onOpenEvent: noop,
    }),
  );
}

describe("vote tally labels", () => {
  it("counts ballots and turns them into whole percents", () => {
    const vote = seededVote();

    expect(voteBallotsCast(vote)).toBe(vote.options.reduce((sum, option) => sum + option.votes, 0));
    expect(votePercent(2, 4)).toBe(50);
    expect(votePercent(1, 4)).toBe(25);
    expect(votePercent(1, 3)).toBe(33);
    expect(votePercent(0, 0)).toBe(0);
  });

  it("writes the roster progress the way the design counts it", () => {
    expect(voteProgressLabel(4, 5)).toBe("Проголосовали 4 из 5");
  });
});

describe("voteMineNote", () => {
  it("names the option the viewer voted for and stays silent without a ballot", () => {
    expect(voteMineNote(seededVote())).toBeNull();

    const voted = castMockBallot(MOCK_VOTE_ID, seededVote().options[1].event.id);
    if (typeof voted === "string") throw new Error("unexpected ballot failure");
    expect(voteMineNote(voted)).toBe(`Ты проголосовал за «${voted.options[1].event.title}»`);
  });
});

describe("votePendingNote", () => {
  it("names everyone but the viewer who has not voted yet", () => {
    const vote = seededVote();
    const note = votePendingNote(vote, mockDemoUser.id);

    const pending = vote.voters.filter((voter) => !vote.votedUserIds.includes(voter.id) && voter.id !== mockDemoUser.id);
    expect(pending.length).toBeGreaterThan(0);
    expect(note).not.toBeNull();
    for (const voter of pending) expect(note).toContain(voter.name.split(" ")[0]);
    expect(note).toContain("Напомнить можно в чате MAX.");
  });

  it("says nothing once everyone but the viewer voted", () => {
    const vote = seededVote();
    const everyone: VoteScreen = { ...vote, votedUserIds: vote.voters.map((voter) => voter.id) };

    expect(votePendingNote(everyone, mockDemoUser.id)).toBeNull();
  });
});

describe("VoteView", () => {
  it("puts the question in its own topbar and counts who already voted", () => {
    const vote = seededVote();
    const html = render();

    expect(html).toContain(vote.title);
    expect(html).toContain(voteProgressLabel(vote.votedUserIds.length, vote.voters.length));
    expect(html).toContain("Чат");
  });

  it("shows the api-provided leader once, with its tally", () => {
    const vote = seededVote();
    const leader = vote.options.find((option) => option.event.id === vote.winnerEventId);
    if (leader === undefined) throw new Error("seeded winner missing");
    const html = render();

    expect(html.match(/app-poll-lead-label/g)).toHaveLength(1);
    expect(html).toContain("Лидирует");
    expect(html).toContain(leader.event.title);
    expect(html).toContain(`${leader.votes} ${pluralRu(leader.votes, "голос", "голоса", "голосов")}`);
  });

  it("breaks the ballots down per option with counts and shares", () => {
    const vote = seededVote();
    const cast = voteBallotsCast(vote);
    const html = render();

    expect(html).toContain("Все варианты");
    for (const option of vote.options) {
      expect(html).toContain(option.event.title);
      expect(html).toContain(`${votePercent(option.votes, cast)}%`);
    }
  });

  it("marks the viewer's own ballot and offers to change it", () => {
    const voted = castMockBallot(MOCK_VOTE_ID, seededVote().options[2].event.id);
    if (typeof voted === "string") throw new Error("unexpected ballot failure");
    const html = render({ state: { status: "ready", vote: voted } });

    expect(html).toContain("твой голос");
    expect(html).toContain("app-poll-result--mine");
    expect(html).toContain("Изменить");
    // проголосовавший смотрит раскладку, а не список кнопок — пока не нажал «Изменить»
    expect(html).toContain('<div class="app-poll-result"');

    const again = render({ state: { status: "ready", vote: voted }, revoting: true });
    expect(again).not.toContain('<div class="app-poll-result"');
  });

  it("offers «Завершить» to the host only, and only while the vote is open", () => {
    const vote = seededVote();

    expect(render({ ownId: vote.hostUserId })).toContain("Завершить");
    expect(render({ ownId: mockDemoUser.id })).not.toContain("Завершить");
  });

  it("draws the finished vote with its winner and no more ballots", () => {
    const closed: VoteScreen = { ...seededVote(), status: "closed", closedAt: "2026-09-15T12:00:00+03:00" };
    const html = render({ state: { status: "ready", vote: closed }, ownId: closed.hostUserId });

    expect(html).toContain("Победил");
    expect(html).not.toContain("Лидирует");
    expect(html).toContain("Голосование завершено");
    expect(html).not.toContain("Завершить");
    expect(html).toContain('<div class="app-poll-result"');
  });

  it("renders the loading, not-found, forbidden, error and ballot-failure states", () => {
    expect(render({ state: { status: "loading" } })).toContain("Загрузка");
    expect(render({ state: { status: "notfound" } })).toContain("Голосование не найдено.");
    expect(render({ state: { status: "forbidden" } })).toContain("Голосование недоступно.");
    expect(render({ state: { status: "error" } })).toContain("Не удалось загрузить голосование.");

    const failed = render({ failed: true });
    expect(failed).toContain("app-state--error");
    expect(failed).toContain("Не удалось отправить голос.");
  });
});
