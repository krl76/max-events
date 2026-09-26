// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for the Booking domain entity (user registration for an event).
// SCOPE: BookingStatus enum, Booking/CreateBooking/BookingWithSeats schemas and inferred types.
// DEPENDS: zod, ./primitives.js
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - BookingStatusSchema - closed booking status enum (active/cancelled)
// - BookingStatus - booking status type
// - BookingSchema - full booking entity
// - Booking - full booking type
// - CreateBookingSchema - booking creation payload (user + event, optional source)
// - CreateBooking - booking creation payload type
// - RescheduleBookingWriteSchema - PATCH /bookings/:id body (move onto another event)
// - RescheduleBookingWrite - reschedule payload type
// - BookingWithSeatsSchema - booking mutation response with remaining free seats
// - BookingWithSeats - booking mutation response type
// END_MODULE_MAP

import { z } from "zod";
import { PaymentSchema } from "./payment.js";
import { IdSchema, TimestampSchema } from "./primitives.js";

export const BookingStatusSchema = z.enum(["active", "cancelled"]);
export type BookingStatus = z.infer<typeof BookingStatusSchema>;

export const BookingSchema = z.object({
  id: IdSchema,
  userId: IdSchema,
  eventId: IdSchema,
  status: BookingStatusSchema.default("active"),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type Booking = z.infer<typeof BookingSchema>;

export const CreateBookingSchema = BookingSchema.omit({
  id: true,
  status: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  promoCode: z.string().min(1).max(40).nullish(),
  referralCode: z.string().min(1).max(40).nullish(),
  source: z.enum(["chats", "feed", "search"]).optional(),
});
export type CreateBooking = z.infer<typeof CreateBookingSchema>;

export const RescheduleBookingWriteSchema = z.object({
  eventId: IdSchema,
});
export type RescheduleBookingWrite = z.infer<typeof RescheduleBookingWriteSchema>;

export const BookingWithSeatsSchema = BookingSchema.extend({
  freeSeats: z.number().int().nonnegative().nullable(),
  chatLink: z.string().nullable().default(null),
  payment: PaymentSchema.nullable().default(null),
});
export type BookingWithSeats = z.infer<typeof BookingWithSeatsSchema>;
