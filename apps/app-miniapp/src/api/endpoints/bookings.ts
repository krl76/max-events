// START_MODULE_CONTRACT
// PURPOSE: Booking endpoints of the api client: the ticket booking with its in-app payment, the waitlist and the check-in.
// SCOPE: POST /bookings, POST /bookings/:id/payment, DELETE /bookings/:id, the /waitlist surface, POST /check-ins.
// DEPENDS: ./transport.js, @max-events/api-contracts
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - CreateCheckIn - check-in payload (user + exactly one of event/place)
// - withBookings - ApiClient.createBooking / payBooking / cancelBooking / joinWaitlist / getMyWaitlistEntry / confirmWaitlistOffer / declineWaitlistOffer / createCheckIn
// END_MODULE_MAP

import { BookingWithSeatsSchema, CheckInSchema, WaitlistEntrySchema } from "@max-events/api-contracts";
import type { BookingWithSeats, CheckIn, CreateBooking, WaitlistEntry } from "@max-events/api-contracts";
import { ApiError, type ApiMixin } from "./transport";

/** Check-in payload: the user plus exactly one of eventId/placeId; the userId field is a mock-only convenience ignored by the real backend (identity comes from the init-data token). */
export interface CreateCheckIn {
  userId: string;
  eventId?: string;
  placeId?: string;
}

export function withBookings<TBase extends ApiMixin>(Base: TBase) {
  return class BookingEndpoints extends Base {
    createBooking(payload: CreateBooking): Promise<BookingWithSeats> {
      return this.request("/bookings", BookingWithSeatsSchema, { body: payload });
    }

    payBooking(bookingId: string): Promise<BookingWithSeats> {
      return this.request(`/bookings/${bookingId}/payment`, BookingWithSeatsSchema, { method: "POST" });
    }

    cancelBooking(bookingId: string): Promise<BookingWithSeats> {
      return this.request(`/bookings/${bookingId}`, BookingWithSeatsSchema, { method: "DELETE" });
    }

    /** Join the event waitlist; the userId param is ignored server-side, identity comes from initData. */
    joinWaitlist(eventId: string, userId: string): Promise<WaitlistEntry> {
      return this.request(`/waitlist?userId=${encodeURIComponent(userId)}`, WaitlistEntrySchema, { body: { eventId } });
    }

    async getMyWaitlistEntry(eventId: string, userId: string): Promise<WaitlistEntry | null> {
      const query = new URLSearchParams({ eventId, userId });
      try {
        return await this.request(`/waitlist/me?${query.toString()}`, WaitlistEntrySchema);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    }

    confirmWaitlistOffer(entryId: string): Promise<WaitlistEntry> {
      return this.request(`/waitlist/${entryId}/confirm`, WaitlistEntrySchema, { method: "POST" });
    }

    declineWaitlistOffer(entryId: string): Promise<WaitlistEntry> {
      return this.request(`/waitlist/${entryId}/decline`, WaitlistEntrySchema, { method: "POST" });
    }

    createCheckIn(payload: CreateCheckIn): Promise<CheckIn> {
      return this.request("/check-ins", CheckInSchema, { body: payload });
    }
  };
}
