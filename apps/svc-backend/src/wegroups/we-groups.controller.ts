// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for «Мы» trip groups.
// SCOPE: POST/GET /we-groups, bind event/place, archive.
// DEPENDS: @nestjs/common, @max-events/api-contracts, ../auth
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - WeGroupsController - group lifecycle HTTP
// END_MODULE_MAP

import { BadRequestException, Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { AddWeGroupEventWriteSchema, AddWeGroupPhotoWriteSchema, AddWeGroupPlaceWriteSchema, CreateWeGroupWriteSchema, type ReviewPhoto, type WeGroupScreen, type WeGroupSummary } from "@max-events/api-contracts";
import { CurrentUser } from "../auth/auth.guard";
import { UserEntity } from "../users/user.entity";
import { WeGroupsService } from "./we-groups.service";

@Controller("we-groups")
export class WeGroupsController {
  constructor(@Inject(WeGroupsService) private readonly groups: WeGroupsService) {}

  @Post()
  async create(@CurrentUser() user: UserEntity, @Body() body: unknown): Promise<WeGroupScreen> {
    const parsed = CreateWeGroupWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid we-group payload");
    return this.groups.create(user.id, parsed.data);
  }

  @Get()
  list(@CurrentUser() user: UserEntity): Promise<WeGroupSummary[]> {
    return this.groups.listForUser(user.id);
  }

  @Get(":id/photos")
  photos(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string): Promise<ReviewPhoto[]> {
    return this.groups.photos(user.id, id);
  }

  @Post(":id/photos")
  async addPhoto(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown): Promise<WeGroupScreen> {
    const parsed = AddWeGroupPhotoWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid we-group payload");
    return this.groups.addPhoto(user.id, id, parsed.data.url);
  }

  @Get(":id")
  get(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string): Promise<WeGroupScreen> {
    return this.groups.get(user.id, id);
  }

  @Post(":id/events")
  async addEvent(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown): Promise<WeGroupScreen> {
    const parsed = AddWeGroupEventWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid we-group event payload");
    return this.groups.addEvent(user.id, id, parsed.data.eventId);
  }

  @Post(":id/places")
  async addPlace(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown): Promise<WeGroupScreen> {
    const parsed = AddWeGroupPlaceWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid we-group place payload");
    return this.groups.addPlace(user.id, id, parsed.data.placeId);
  }

  @Post(":id/archive")
  archive(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string): Promise<WeGroupScreen> {
    return this.groups.archive(user.id, id);
  }
}
