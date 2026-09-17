import { describe, expect, it } from "vitest";
import type { EventsService } from "../events/events.service";
import type { FeedService } from "../feed/feed.service";
import type { PlacesService } from "../places/places.service";
import type { UsersService } from "../users/users.service";
import { ModerationService } from "./moderation.service";

describe("ModerationService", () => {
  it("unpublishes events, places and feed posts and bans organizers", async () => {
    const unpublished: string[] = [];
    const banned: string[] = [];
    const events = { unpublish: async (id: string) => unpublished.push(`event:${id}`) } as unknown as EventsService;
    const places = { unpublish: async (id: string) => unpublished.push(`place:${id}`) } as unknown as PlacesService;
    const feed = { unpublish: async (id: string) => unpublished.push(`feed_post:${id}`) } as unknown as FeedService;
    const users = { banFromPublishing: async (id: string) => banned.push(id) } as unknown as UsersService;
    const service = new ModerationService(events, places, feed, users);
    await service.unpublish("event", "00000000-0000-4000-8000-0000000000e1");
    await service.unpublish("place", "00000000-0000-4000-8000-0000000000a1");
    await service.unpublish("feed_post", "00000000-0000-4000-8000-0000000000f1");
    await service.banOrganizer("00000000-0000-4000-8000-00000000000a");
    expect(unpublished).toEqual(["event:00000000-0000-4000-8000-0000000000e1", "place:00000000-0000-4000-8000-0000000000a1", "feed_post:00000000-0000-4000-8000-0000000000f1"]);
    expect(banned).toEqual(["00000000-0000-4000-8000-00000000000a"]);
  });
});
