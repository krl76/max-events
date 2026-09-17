// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for catalog subscriptions — list/create/delete for CurrentUser.
// SCOPE: GET/POST /subscriptions, DELETE /subscriptions/:id.
// DEPENDS: @nestjs/common, @max-events/api-contracts, ../auth/auth.guard, ./subscriptions.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - SubscriptionsController - /subscriptions CRUD
// END_MODULE_MAP

import { BadRequestException, Body, Controller, Delete, Get, Inject, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { CreateSubscriptionSchema, type Subscription } from "@max-events/api-contracts";
import { CurrentUser } from "../auth/auth.guard";
import { UserEntity } from "../users/user.entity";
import { SubscriptionsService } from "./subscriptions.service";

@Controller("subscriptions")
export class SubscriptionsController {
  constructor(@Inject(SubscriptionsService) private readonly subscriptions: SubscriptionsService) {}

  @Get()
  async list(@CurrentUser() user: UserEntity): Promise<Subscription[]> {
    return this.subscriptions.list(user.id);
  }

  @Post()
  async create(@CurrentUser() user: UserEntity, @Body() body: unknown): Promise<Subscription> {
    const parsed = CreateSubscriptionSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid subscription payload");
    return this.subscriptions.create(user.id, parsed.data);
  }

  @Delete(":id")
  async remove(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string): Promise<Subscription> {
    return this.subscriptions.remove(user.id, id);
  }
}
