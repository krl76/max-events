// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for personal lists — summaries, items with events, add/remove event.
// SCOPE: GET /lists, GET /lists/:id, GET/POST /lists/:id/items, DELETE /lists/:id/items/:itemId; CurrentUser identity.
// DEPENDS: @nestjs/common, @max-events/api-contracts, ../auth/auth.guard, ./lists.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ListsController - /lists read and item mutations
// END_MODULE_MAP

import { BadRequestException, Body, Controller, Delete, Get, Inject, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { AddListItemWriteSchema, IdSchema, type ListItem, type ListItemCard, type ListScreen, type ListSummary } from "@max-events/api-contracts";
import { CurrentUser } from "../auth/auth.guard";
import { UserEntity } from "../users/user.entity";
import { ListsService } from "./lists.service";

@Controller("lists")
export class ListsController {
  constructor(@Inject(ListsService) private readonly lists: ListsService) {}

  @Get()
  async list(@CurrentUser() user: UserEntity, @Query("eventId") eventId?: string): Promise<ListSummary[]> {
    let savedEventId: string | null = null;
    if (eventId !== undefined && eventId !== "") {
      const parsed = IdSchema.safeParse(eventId);
      if (!parsed.success) throw new BadRequestException("Invalid list query");
      savedEventId = parsed.data;
    }
    return this.lists.list(user.id, savedEventId);
  }

  @Get(":id/items")
  async items(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string): Promise<ListItemCard[]> {
    return this.lists.itemsFor(user.id, id);
  }

  @Get(":id")
  async get(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string): Promise<ListScreen> {
    return this.lists.get(user.id, id);
  }

  @Post(":id/items")
  async add(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown): Promise<ListItem> {
    const eventId = body !== null && typeof body === "object" && !Array.isArray(body) ? (body as { eventId?: unknown }).eventId : undefined;
    const parsed = AddListItemWriteSchema.safeParse({ eventId });
    if (!parsed.success) throw new BadRequestException("Invalid list payload");
    return this.lists.addEvent(user.id, id, parsed.data.eventId);
  }

  @Delete(":id/items/:itemId")
  async remove(
    @CurrentUser() user: UserEntity,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("itemId", ParseUUIDPipe) itemId: string,
  ): Promise<ListItem> {
    return this.lists.removeItem(user.id, id, itemId);
  }
}
