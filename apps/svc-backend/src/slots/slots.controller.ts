// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for venue slots.
// SCOPE: GET /slots, POST/GET/DELETE /slots/bookings[/:id], GET /slots/my.
// DEPENDS: @nestjs/common, ../auth, ./slots.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - SlotsController - slot board and bookings
// END_MODULE_MAP

import { BadRequestException, Body, Controller, Delete, Get, Inject, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { IdSchema } from "@max-events/api-contracts";
import { CurrentUser } from "../auth/auth.guard";
import { UserEntity } from "../users/user.entity";
import { SlotsService } from "./slots.service";

@Controller("slots")
export class SlotsController {
  constructor(@Inject(SlotsService) private readonly slots: SlotsService) {}

  @Get("my")
  mine(@CurrentUser() user: UserEntity) {
    return this.slots.mine(user.id);
  }

  @Get()
  async board(@CurrentUser() user: UserEntity, @Query("placeId") placeId?: string, @Query("date") date?: string) {
    const parsed = IdSchema.safeParse(placeId);
    if (!parsed.success) throw new BadRequestException("Invalid slot query");
    return this.slots.board(parsed.data, user.id, date === "" ? undefined : date);
  }

  @Post("bookings")
  async book(@CurrentUser() user: UserEntity, @Body() body: unknown) {
    const slotId = body !== null && typeof body === "object" ? (body as { slotId?: unknown }).slotId : undefined;
    const parsed = IdSchema.safeParse(slotId);
    if (!parsed.success) throw new BadRequestException("Invalid slot payload");
    const companionIds = Array.isArray((body as { companionIds?: unknown }).companionIds) ? ((body as { companionIds: unknown[] }).companionIds.filter((id) => typeof id === "string") as string[]) : [];
    const extraIds = Array.isArray((body as { extraIds?: unknown }).extraIds) ? ((body as { extraIds: unknown[] }).extraIds.filter((id) => typeof id === "string") as string[]) : [];
    return this.slots.book(user.id, parsed.data, companionIds, extraIds);
  }

  @Get("bookings/:id")
  getBooking(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string) {
    return this.slots.getBooking(user.id, id);
  }

  @Delete("bookings/:id")
  cancel(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string) {
    return this.slots.cancel(user.id, id);
  }

  @Post("waitlist")
  async joinWaitlist(@CurrentUser() user: UserEntity, @Body() body: unknown) {
    const slotId = body !== null && typeof body === "object" ? (body as { slotId?: unknown }).slotId : undefined;
    const parsed = IdSchema.safeParse(slotId);
    if (!parsed.success) throw new BadRequestException("Invalid waitlist payload");
    const seatsRaw = body !== null && typeof body === "object" ? (body as { seats?: unknown }).seats : undefined;
    const seats = typeof seatsRaw === "number" && Number.isInteger(seatsRaw) && seatsRaw > 0 ? seatsRaw : 1;
    return this.slots.joinWaitlist(user.id, parsed.data, seats);
  }

  @Delete("waitlist/:id")
  leaveWaitlist(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string) {
    return this.slots.leaveWaitlist(user.id, id);
  }

  @Get("bookings/:id/messages")
  listChat(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string) {
    return this.slots.listChat(user.id, id);
  }

  @Post("bookings/:id/messages")
  async addChat(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown) {
    const text = body !== null && typeof body === "object" ? (body as { text?: unknown }).text : undefined;
    if (typeof text !== "string") throw new BadRequestException("Invalid chat payload");
    return this.slots.addChat(user.id, id, text);
  }
}
