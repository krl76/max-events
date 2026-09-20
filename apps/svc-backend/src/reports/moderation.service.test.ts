import { NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { EventsService } from "../events/events.service";
import type { FeedService } from "../feed/feed.service";
import type { MicroEventsService } from "../microevents/micro-events.service";
import type { PlacesService } from "../places/places.service";
import type { UsersService } from "../users/users.service";
import { ModerationService } from "./moderation.service";

function createService(overrides: { microEvents?: MicroEventsService } = {}) {
  const unpublished: string[] = [];
  const banned: string[] = [];
  const events = { unpublish: async (id: string) => unpublished.push(`event:${id}`) } as unknown as EventsService;
  const places = { unpublish: async (id: string) => unpublished.push(`place:${id}`) } as unknown as PlacesService;
  const feed = { unpublish: async (id: string) => unpublished.push(`feed_post:${id}`) } as unknown as FeedService;
  const microEvents = overrides.microEvents ?? ({ unpublish: async (id: string) => unpublished.push(`micro_event:${id}`) } as unknown as MicroEventsService);
  const users = { banFromPublishing: async (id: string) => banned.push(id) } as unknown as UsersService;
  return { service: new ModerationService(events, places, feed, microEvents, users), unpublished, banned };
}

describe("ModerationService", () => {
  it("unpublishes every post-moderated target type and bans organizers", async () => {
    const { service, unpublished, banned } = createService();
    await service.unpublish("event", "00000000-0000-4000-8000-0000000000e1");
    await service.unpublish("place", "00000000-0000-4000-8000-0000000000a1");
    await service.unpublish("feed_post", "00000000-0000-4000-8000-0000000000f1");
    await service.unpublish("micro_event", "00000000-0000-4000-8000-0000000000c1");
    await service.banOrganizer("00000000-0000-4000-8000-00000000000a");
    expect(unpublished).toEqual(["event:00000000-0000-4000-8000-0000000000e1", "place:00000000-0000-4000-8000-0000000000a1", "feed_post:00000000-0000-4000-8000-0000000000f1", "micro_event:00000000-0000-4000-8000-0000000000c1"]);
    expect(banned).toEqual(["00000000-0000-4000-8000-00000000000a"]);
  });

  it("surfaces a sanction against a target that is already gone", async () => {
    const { service } = createService({
      microEvents: {
        unpublish: async () => {
          throw new NotFoundException("Micro-event not found");
        },
      } as unknown as MicroEventsService,
    });
    await expect(service.unpublish("micro_event", "00000000-0000-4000-8000-0000000000c9")).rejects.toBeInstanceOf(NotFoundException);
  });
});
