import { afterEach, describe, expect, it } from "vitest";
import { VoteSchema } from "@max-events/api-contracts";
import { ApiClient } from "./client";
import { castMockBallot, createMockVote, installMockApi, MOCK_FOREIGN_VOTE_ID, MOCK_VOTE_ID, mockEvents, mockFriendIds, resetMockVotes } from "./mock";

describe("vote mock endpoints", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
    resetMockVotes();
  });

  const client = () => new ApiClient("/api");

  it("serves the seeded deep-link vote with the server-computed winner and tallies", async () => {
    restore = installMockApi();

    const vote = await client().getVote(MOCK_VOTE_ID);

    expect(VoteSchema.safeParse(vote).success).toBe(true);
    const winner = vote.options.find((option) => option.event.id === vote.winnerEventId);
    expect(winner).toBeDefined();
    expect(winner!.votes).toBe(Math.max(...vote.options.map((option) => option.votes)));
    expect(vote.participants.length).toBeGreaterThan(0);
  });

  it("answers 404 for an unknown vote and 403 for a vote the demo user is not part of", async () => {
    restore = installMockApi();

    await expect(client().getVote("d7000000-0000-4000-8000-000000000099")).rejects.toMatchObject({ name: "ApiError", status: 404 });
    await expect(client().getVote(MOCK_FOREIGN_VOTE_ID)).rejects.toMatchObject({ name: "ApiError", status: 403 });
  });

  it("creates a vote with a sent chat card and reads it back via the typed client", async () => {
    restore = installMockApi();
    const api = client();

    const created = await api.createVote({ title: "Куда идем в пятницу?", eventIds: [mockEvents[0].id, mockEvents[1].id], participantIds: [mockFriendIds[0]] });
    expect(created.chatLink).not.toBeNull();
    expect(created.winnerEventId).toBeNull();
    expect(created.options.map((option) => option.event.id)).toEqual([mockEvents[0].id, mockEvents[1].id]);

    const loaded = await api.getVote(created.id);
    expect(loaded).toEqual(created);
  });

  it("rejects invalid creations: duplicate events, a single event, unknown event, non-friend or host participants", async () => {
    restore = installMockApi();
    const api = client();

    await expect(api.createVote({ title: "t", eventIds: [mockEvents[0].id, mockEvents[0].id], participantIds: [mockFriendIds[0]] })).rejects.toMatchObject({ status: 400 });
    await expect(api.createVote({ title: "t", eventIds: [mockEvents[0].id], participantIds: [mockFriendIds[0]] })).rejects.toMatchObject({ status: 400 });
    await expect(api.createVote({ title: "t", eventIds: [mockEvents[0].id, "c0000000-0000-4000-8000-000000000000"], participantIds: [mockFriendIds[0]] })).rejects.toMatchObject({ status: 404 });
    await expect(api.createVote({ title: "t", eventIds: [mockEvents[0].id, mockEvents[1].id], participantIds: ["a0000000-0000-4000-8000-0000000000ff"] })).rejects.toMatchObject({ status: 400 });
    await expect(api.createVote({ title: "t", eventIds: [mockEvents[0].id, mockEvents[1].id], participantIds: ["a0000000-0000-4000-8000-000000000001"] })).rejects.toMatchObject({ status: 400 });
  });

  it("casts a ballot, flips the winner, and replaces the ballot on a repeated vote", async () => {
    restore = installMockApi();
    const api = client();

    const before = await api.getVote(MOCK_VOTE_ID);
    const initialWinner = before.winnerEventId;
    const challenger = before.options.find((option) => option.event.id !== initialWinner)!;

    const afterFirst = await api.castBallot(MOCK_VOTE_ID, challenger.event.id);
    expect(afterFirst.options.find((option) => option.event.id === challenger.event.id)!.votes).toBe(challenger.votes + 1);

    const other = afterFirst.options.find((option) => option.event.id !== challenger.event.id)!;
    const afterSecond = await api.castBallot(MOCK_VOTE_ID, other.event.id);
    const challengerAfter = afterSecond.options.find((option) => option.event.id === challenger.event.id)!;
    const otherAfter = afterSecond.options.find((option) => option.event.id === other.event.id)!;
    expect(challengerAfter.votes).toBe(challenger.votes);
    expect(otherAfter.votes).toBe(other.votes + 1);
    expect(afterSecond.options.reduce((sum, option) => sum + option.votes, 0)).toBe(before.options.reduce((sum, option) => sum + option.votes, 0) + 1);
  });

  it("rejects ballots for an unknown option and for a foreign vote", async () => {
    restore = installMockApi();
    const api = client();

    await expect(api.castBallot(MOCK_VOTE_ID, mockEvents[3].id)).rejects.toMatchObject({ status: 400 });
    await expect(api.castBallot(MOCK_FOREIGN_VOTE_ID, mockEvents[0].id)).rejects.toMatchObject({ status: 403 });
    await expect(api.castBallot("d7000000-0000-4000-8000-000000000099", mockEvents[0].id)).rejects.toMatchObject({ status: 404 });
  });
});

describe("vote mock store", () => {
  afterEach(() => {
    resetMockVotes();
  });

  it("computes no winner while nobody voted", () => {
    const created = createMockVote({ title: "t", eventIds: [mockEvents[0].id, mockEvents[1].id], participantIds: [mockFriendIds[0]] });
    expect(created).not.toBe("invalid");
    expect(created).not.toBe("no_event");
    if (typeof created === "string") return;

    expect(created.winnerEventId).toBeNull();
    expect(created.options.every((option) => option.votes === 0)).toBe(true);
  });

  it("mirrors the winner rule: max votes, and a replaced ballot moves the tally", () => {
    const created = createMockVote({ title: "t", eventIds: [mockEvents[0].id, mockEvents[1].id], participantIds: [mockFriendIds[0]] });
    if (typeof created === "string") throw new Error("unexpected create failure");

    const voted = castMockBallot(created.id, mockEvents[1].id);
    if (typeof voted === "string") throw new Error("unexpected ballot failure");
    expect(voted.winnerEventId).toBe(mockEvents[1].id);

    const replaced = castMockBallot(created.id, mockEvents[0].id);
    if (typeof replaced === "string") throw new Error("unexpected ballot failure");
    expect(replaced.winnerEventId).toBe(mockEvents[0].id);
    expect(replaced.options.find((option) => option.event.id === mockEvents[1].id)!.votes).toBe(0);
  });
});
