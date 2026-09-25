import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FriendSchema } from "@max-events/api-contracts";
import { ApiClient } from "./client";
import { friendSuggestions, installMockApi, mockFriends, mockOnboardingContacts, resetMockFollows, resetMockProfiles } from "./mock";

describe("onboarding friend suggestions mock endpoint", () => {
  let restore: (() => void) | null = null;

  beforeEach(() => {
    restore = installMockApi();
  });

  afterEach(() => {
    restore?.();
    restore = null;
    resetMockFollows();
    resetMockProfiles();
  });

  it("offers the twelve contacts of the design, starting with the friend fixtures", () => {
    expect(mockOnboardingContacts).toHaveLength(12);
    expect(mockOnboardingContacts.slice(0, mockFriends.length)).toEqual(mockFriends);
    for (const contact of mockOnboardingContacts) expect(FriendSchema.safeParse(contact)).toMatchObject({ success: true });
  });

  it("serves every contact with a hint and three already followed", async () => {
    const suggestions = await new ApiClient("/api").listFriendSuggestions();

    expect(suggestions).toEqual(friendSuggestions());
    expect(suggestions).toHaveLength(12);
    expect(suggestions.filter((item) => item.followed)).toHaveLength(3);
    expect(suggestions[0].hint).toBe("12 общих планов");
    expect(suggestions.every((item) => item.hint !== null)).toBe(true);
  });

  it("replaces the followed set rather than adding to it", async () => {
    const client = new ApiClient("/api");
    const target = mockOnboardingContacts[11].id;

    const followed = await client.followFriends([target]);

    expect(followed).toEqual([target]);
    expect((await client.listFriendSuggestions()).filter((item) => item.followed).map((item) => item.friend.id)).toEqual([target]);
  });

  it("accepts following nobody and rejects someone who is not a contact", async () => {
    const client = new ApiClient("/api");

    await expect(client.followFriends([])).resolves.toEqual([]);
    await expect(client.followFriends(["a0000000-0000-4000-8000-0000000000ff"])).rejects.toMatchObject({ status: 404 });
  });

  it("stores the city and interests the last step writes", async () => {
    const client = new ApiClient("/api");

    const profile = await client.updateProfile({ city: "Казань", interests: ["Концерты", "Спорт", "Театр"] });

    expect(profile.city).toBe("Казань");
    expect(profile.interests).toEqual(["Концерты", "Спорт", "Театр"]);
    expect((await client.getProfile()).city).toBe("Казань");
  });
});
