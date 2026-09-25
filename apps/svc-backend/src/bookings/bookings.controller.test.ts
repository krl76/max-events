import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { BookingWithSeats } from "@max-events/api-contracts";
import { UserEntity } from "../users/user.entity";
import { BookingsController } from "./bookings.controller";
import type { BookingsService } from "./bookings.service";

const user = { id: "00000000-0000-4000-8000-00000000000a" } as UserEntity;
const eventId = "00000000-0000-4000-8000-0000000000e1";
const booking: BookingWithSeats = {
  id: "00000000-0000-4000-8000-0000000000b1",
  userId: user.id,
  eventId,
  status: "active",
  createdAt: "2026-09-01T07:00:00.000Z",
  updatedAt: "2026-09-01T07:00:00.000Z",
  freeSeats: 0,
  chatLink: null,
  payment: null,
};

function createController() {
  const calls: { create?: { userId: string; eventId: string }; cancel?: { userId: string; bookingId: string }; pay?: string } = {};
  const service = {
    create: async (userId: string, bookedEventId: string) => {
      calls.create = { userId, eventId: bookedEventId };
      return booking;
    },
    cancel: async (userId: string, bookingId: string) => {
      calls.cancel = { userId, bookingId };
      return { ...booking, status: "cancelled" as const, freeSeats: 1 };
    },
    ensurePayment: async (_userId: string, bookingId: string) => {
      calls.pay = bookingId;
      return booking;
    },
    reschedule: async (_userId: string, _bookingId: string, nextEventId: string) => ({ ...booking, eventId: nextEventId }),
  } as unknown as BookingsService;
  return { calls, controller: new BookingsController(service) };
}

describe("BookingsController", () => {
  it("rejects an invalid payload and a userId that is not the current user", async () => {
    const { controller } = createController();
    await expect(controller.create(user, { userId: user.id, eventId: "not-a-uuid" })).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.create(user, { userId: "00000000-0000-4000-8000-00000000000b", eventId })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("creates a booking for the authenticated user", async () => {
    const { calls, controller } = createController();
    await expect(controller.create(user, { userId: user.id, eventId })).resolves.toEqual(booking);
    expect(calls.create).toEqual({ userId: user.id, eventId });
  });

  it("cancels a booking for the authenticated user", async () => {
    const { calls, controller } = createController();
    await expect(controller.cancel(user, booking.id)).resolves.toMatchObject({ status: "cancelled", freeSeats: 1 });
    expect(calls.cancel).toEqual({ userId: user.id, bookingId: booking.id });
  });

  it("charges an existing booking", async () => {
    const { calls, controller } = createController();
    await expect(controller.pay(user, booking.id)).resolves.toEqual(booking);
    expect(calls.pay).toBe(booking.id);
  });

  it("forwards a reschedule and rejects a body without an event id", async () => {
    const { controller } = createController();
    await expect(controller.reschedule(user, booking.id, { eventId: "00000000-0000-4000-8000-0000000000e2" })).resolves.toMatchObject({ eventId: "00000000-0000-4000-8000-0000000000e2" });
    await expect(controller.reschedule(user, booking.id, {})).rejects.toBeInstanceOf(BadRequestException);
  });
});
