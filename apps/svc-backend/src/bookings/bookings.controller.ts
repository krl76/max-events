// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for bookings — authenticated create and cancel under /api/bookings.
// SCOPE: POST /bookings (CreateBooking, userId must match CurrentUser), DELETE /bookings/:id returning BookingWithSeats.
// DEPENDS: @nestjs/common, @max-events/api-contracts, ../auth/auth.guard, ./bookings.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - BookingsController - /bookings create and cancel
// END_MODULE_MAP

import { BadRequestException, Body, Controller, Delete, ForbiddenException, Inject, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { CreateBookingSchema, type BookingWithSeats } from "@max-events/api-contracts";
import { CurrentUser } from "../auth/auth.guard";
import { UserEntity } from "../users/user.entity";
import { BookingsService } from "./bookings.service";

@Controller("bookings")
export class BookingsController {
  constructor(@Inject(BookingsService) private readonly bookings: BookingsService) {}

  @Post()
  async create(@CurrentUser() user: UserEntity, @Body() body: unknown): Promise<BookingWithSeats> {
    const parsed = CreateBookingSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid booking payload");
    if (parsed.data.userId !== user.id) throw new ForbiddenException("Cannot book for another user");
    return this.bookings.create(user.id, parsed.data.eventId, parsed.data.promoCode);
  }

  @Delete(":id")
  cancel(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string): Promise<BookingWithSeats> {
    return this.bookings.cancel(user.id, id);
  }
}
