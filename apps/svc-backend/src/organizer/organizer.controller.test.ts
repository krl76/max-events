import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { CreateEventSchema, type Event, type Place } from "@max-events/api-contracts";
import { UserEntity } from "../users/user.entity";
import type { EventsService } from "../events/events.service";
import type { PlacesService } from "../places/places.service";
import { OrganizerController } from "./organizer.controller";

const user = { id: "00000000-0000-4000-8000-00000000000a" } as UserEntity;
const event = CreateEventSchema.parse({
  title: "Джаз в парке",
  category: "afisha",
  city: "Москва",
  startsAt: "2026-09-12T19:00:00+03:00",
});
const eventDto = { id: "00000000-0000-4000-8000-0000000000e1", ...event, chatLink: null } as Event;

describe("OrganizerController", () => {
  it("creates a draft event and publishes it", async () => {
    const calls: { create?: { draft?: boolean }; publish?: string } = {};
    const events = {
      listMine: async () => [eventDto],
      create: async (_payload: unknown, _userId: string, options?: { draft?: boolean }) => {
        calls.create = options;
        return eventDto;
      },
      publish: async (id: string) => {
        calls.publish = id;
        return eventDto;
      },
    } as unknown as EventsService;
    const places = { listMine: async () => [] as Place[], create: async () => ({ id: "p" }) as Place, publish: async () => ({ id: "p" }) as Place } as unknown as PlacesService;
    const controller = new OrganizerController(events, places);
    await expect(controller.listEvents(user)).resolves.toEqual([eventDto]);
    await expect(controller.createEventDraft(user, event)).resolves.toEqual(eventDto);
    expect(calls.create).toEqual({ draft: true });
    await expect(controller.publishEvent(user, eventDto.id)).resolves.toEqual(eventDto);
    expect(calls.publish).toBe(eventDto.id);
    await expect(controller.createEventDraft(user, { ...event, title: "" })).rejects.toBeInstanceOf(BadRequestException);
  });
});
