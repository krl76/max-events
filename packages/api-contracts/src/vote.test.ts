import { describe, expect, it } from "vitest";
import { CreateVoteWriteSchema, VoteBallotWriteSchema } from "./vote.js";

const eventA = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d8f";
const eventB = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d90";
const friendId = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d91";

describe("CreateVoteWriteSchema", () => {
  it("defaults the Friday title and requires two unique events plus a participant", () => {
    const parsed = CreateVoteWriteSchema.parse({ eventIds: [eventA, eventB], participantIds: [friendId] });
    expect(parsed.title).toBe("Куда идем в пятницу?");
    expect(parsed.eventIds).toEqual([eventA, eventB]);
    expect(CreateVoteWriteSchema.safeParse({ eventIds: [eventA], participantIds: [friendId] }).success).toBe(false);
    expect(CreateVoteWriteSchema.safeParse({ eventIds: [eventA, eventA], participantIds: [friendId] }).success).toBe(false);
    expect(CreateVoteWriteSchema.safeParse({ eventIds: [eventA, eventB], participantIds: [] }).success).toBe(false);
  });
});

describe("VoteBallotWriteSchema", () => {
  it("requires an event id", () => {
    expect(VoteBallotWriteSchema.parse({ eventId: eventA }).eventId).toBe(eventA);
    expect(VoteBallotWriteSchema.safeParse({}).success).toBe(false);
  });
});
