// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for composing and reading the current user's city walks.
// SCOPE: POST /walks, GET /walks, GET /walks/:id, PATCH /walks/:id/stops/:order, DELETE /walks/:id. The user id comes from the auth guard, never the body.
// DEPENDS: @nestjs/common, @max-events/api-contracts, ../auth/auth.guard, ../users/user.entity, ./walks.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - WalksController - compose, read, mark done, and delete for CurrentUser
// END_MODULE_MAP

import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Inject, NotFoundException, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common";
import { ComposeCityWalkWriteSchema, SetCityWalkStopDoneWriteSchema, type CityWalk } from "@max-events/api-contracts";
import { CurrentUser } from "../auth/auth.guard";
import { UserEntity } from "../users/user.entity";
import { WalksService } from "./walks.service";

@Controller("walks")
export class WalksController {
  constructor(@Inject(WalksService) private readonly walks: WalksService) {}

  @Post()
  compose(@CurrentUser() user: UserEntity, @Body() body: unknown): Promise<CityWalk> {
    const parsed = ComposeCityWalkWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid walk");
    return this.walks.compose(user.id, parsed.data);
  }

  @Get()
  list(@CurrentUser() user: UserEntity): Promise<CityWalk[]> {
    return this.walks.list(user.id);
  }

  @Get(":id")
  get(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string): Promise<CityWalk> {
    return this.walks.get(user.id, id);
  }

  @Patch(":id/stops/:order")
  setDone(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string, @Param("order") orderRaw: string, @Body() body: unknown): Promise<CityWalk> {
    const parsed = SetCityWalkStopDoneWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid walk");
    const order = Number(orderRaw);
    if (!Number.isInteger(order) || order < 1) throw new NotFoundException();
    return this.walks.setDone(user.id, id, order, parsed.data.done);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.walks.remove(user.id, id);
  }
}
