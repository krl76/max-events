import { describe, expect, it } from "vitest";
import { CreateVoteWriteSchema, VoteBallotWriteSchema, VoteSchema } from "./vote.js";

const eventA = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d8f";
const eventB = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d90";
const friendId = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d91";

const validVote = {
  id: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d92",
  hostUserId: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d93",
  title: "Куда идем в пятницу?",
  chatLink: null,
  participants: [{ id: friendId, name: "Дима", avatarUrl: null }],
  options: [
    {
      event: { id: eventA, title: "Джаз", category: "afisha", city: "Москва", startsAt: "2026-09-18T19:00:00+03:00" },
      votes: 1,
    },
  ],
  winnerEventId: eventA,
  createdAt: "2026-09-12T10:00:00+03:00",
  updatedAt: "2026-09-12T10:00:00+03:00",
};

describe("VoteSchema", () => {
  it("defaults myBallotEventId to null when the field is absent", () => {
    expect(VoteSchema.parse(validVote).myBallotEventId).toBeNull();
  });

  it("keeps the viewer's ballot event id when present", () => {
    expect(VoteSchema.parse({ ...validVote, myBallotEventId: eventB }).myBallotEventId).toBe(eventB);
  });

  it("rejects a non-uuid myBallotEventId", () => {
    expect(VoteSchema.safeParse({ ...validVote, myBallotEventId: "not-an-id" }).success).toBe(false);
  });
});

describe("CreateVoteWriteSchema", () => {
  it("defaults the Friday title and requires two unique events", () => {
    const parsed = CreateVoteWriteSchema.parse({ eventIds: [eventA, eventB], participantIds: [friendId] });
    expect(parsed.title).toBe("Куда идем в пятницу?");
    expect(parsed.eventIds).toEqual([eventA, eventB]);
    expect(CreateVoteWriteSchema.parse({ eventIds: [eventA, eventB] }).participantIds).toEqual([]);
    expect(CreateVoteWriteSchema.safeParse({ eventIds: [eventA], participantIds: [friendId] }).success).toBe(false);
    expect(CreateVoteWriteSchema.safeParse({ eventIds: [eventA, eventA], participantIds: [friendId] }).success).toBe(false);
    expect(CreateVoteWriteSchema.safeParse({ eventIds: [eventA, eventB], participantIds: [] }).success).toBe(true);
  });
});

describe("VoteBallotWriteSchema", () => {
  it("requires an event id", () => {
    expect(VoteBallotWriteSchema.parse({ eventId: eventA }).eventId).toBe(eventA);
    expect(VoteBallotWriteSchema.safeParse({}).success).toBe(false);
  });
});
