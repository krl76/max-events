import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { CreateEventSchema, type Event, type Place } from "@max-events/api-contracts";
import { OrganizationEntity } from "../organizations/organization.entity";
import type { EventsService } from "../events/events.service";
import type { PlacesService } from "../places/places.service";
import { OrganizerController } from "./organizer.controller";

const organization = { id: "00000000-0000-4000-8000-0000000000c1", organizerUserId: "00000000-0000-4000-8000-00000000000a" } as OrganizationEntity;
const event = CreateEventSchema.parse({
  title: "Джаз в парке",
  category: "afisha",
  city: "Москва",
  startsAt: "2026-09-12T19:00:00+03:00",
});
const eventDto = { id: "00000000-0000-4000-8000-0000000000e1", ...event, chatLink: null, promoted: false } as Event;

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
    const promo = { create: async () => ({}), list: async () => [], setEarlyAccess: async () => ({ bookingOpensAt: "" }), listBookings: async () => [], createCampaign: async () => ({}), listCampaigns: async () => [] };
    const promotions = { create: async () => ({}), list: async () => [], recordPayment: async () => ({}) };
    const payments = { salesReport: async () => ({ eventId: eventDto.id, rows: [], grossRub: 0, commissionRub: 0, netRub: 0 }) };
    const bookingCalls: { organizerId?: string; bookingId?: string } = {};
    const bookings = {
      cancel: async (_userId: string, bookingId: string, options?: { organizerId?: string }) => {
        bookingCalls.bookingId = bookingId;
        bookingCalls.organizerId = options?.organizerId;
        return { id: bookingId, status: "cancelled" };
      },
    };
    const organizations = { getSetup: async () => ({ organizationId: "e1" }), updateSetup: async () => ({ organizationId: "e1" }), completeSetup: async () => ({ organizationId: "e1" }) };
    const controller = new OrganizerController(events, places, promo as never, promotions as never, payments as never, bookings as never, organizations as never);
    await expect(controller.listEvents(organization)).resolves.toEqual([eventDto]);
    await expect(controller.createEventDraft(organization, event)).resolves.toEqual(eventDto);
    expect(calls.create).toEqual({ draft: true });
    await expect(controller.publishEvent(organization, eventDto.id)).resolves.toEqual(eventDto);
    expect(calls.publish).toBe(eventDto.id);
    await expect(controller.createEventDraft(organization, { ...event, title: "" })).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.createPromo(organization, eventDto.id, { code: "" })).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.createCampaign(organization, eventDto.id, { type: "refer_a_friend", code: "", title: "x" })).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.createPromotion(organization, eventDto.id, { type: "boost" })).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.refundBooking(organization, eventDto.id, "00000000-0000-4000-8000-0000000000b1")).resolves.toMatchObject({ status: "cancelled" });
    expect(bookingCalls).toEqual({ bookingId: "00000000-0000-4000-8000-0000000000b1", organizerId: organization.organizerUserId });
    await expect(controller.updateSetup(organization, { activities: ["катание"] })).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.getSetup(organization)).resolves.toMatchObject({ organizationId: "e1" });
    await expect(controller.completeSetup(organization)).resolves.toMatchObject({ organizationId: "e1" });
  });
});
