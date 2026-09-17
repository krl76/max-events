// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for shared collections.
// SCOPE: POST/GET /collections, members, items, share.
// DEPENDS: @nestjs/common, @max-events/api-contracts, ../auth/auth.guard
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - CollectionsController - create/list/get/members/items/share
// END_MODULE_MAP

import { BadRequestException, Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { AddCollectionItemWriteSchema, AddCollectionMemberWriteSchema, CreateCollectionWriteSchema, type CollectionScreen } from "@max-events/api-contracts";
import { CurrentUser } from "../auth/auth.guard";
import { UserEntity } from "../users/user.entity";
import { CollectionsService } from "./collections.service";

@Controller("collections")
export class CollectionsController {
  constructor(@Inject(CollectionsService) private readonly collections: CollectionsService) {}

  @Get()
  list(@CurrentUser() user: UserEntity): Promise<CollectionScreen[]> {
    return this.collections.listForUser(user.id);
  }

  @Post()
  async create(@CurrentUser() user: UserEntity, @Body() body: unknown): Promise<CollectionScreen> {
    const parsed = CreateCollectionWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid collection payload");
    return this.collections.create(user.id, parsed.data.title);
  }

  @Get(":id")
  get(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string): Promise<CollectionScreen> {
    return this.collections.get(user.id, id);
  }

  @Post(":id/members")
  async addMember(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown): Promise<CollectionScreen> {
    const parsed = AddCollectionMemberWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid member payload");
    return this.collections.addMember(user.id, id, parsed.data.userId);
  }

  @Post(":id/items")
  async addItem(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown): Promise<CollectionScreen> {
    const parsed = AddCollectionItemWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid item payload");
    return this.collections.addItem(user.id, id, parsed.data);
  }

  @Post(":id/share")
  share(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string): Promise<CollectionScreen> {
    return this.collections.share(user.id, id);
  }
}
