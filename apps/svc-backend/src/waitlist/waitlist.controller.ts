// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for the event waitlist.
// SCOPE: POST /waitlist (join), POST /waitlist/:id/confirm.
// DEPENDS: @nestjs/common, @max-events/api-contracts, ../auth/auth.guard, ./waitlist.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - WaitlistController - join and confirm
// END_MODULE_MAP

import { BadRequestException, Body, Controller, Inject, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { JoinWaitlistWriteSchema, type WaitlistEntry } from "@max-events/api-contracts";
import { CurrentUser } from "../auth/auth.guard";
import { UserEntity } from "../users/user.entity";
import { WaitlistService } from "./waitlist.service";

@Controller("waitlist")
export class WaitlistController {
  constructor(@Inject(WaitlistService) private readonly waitlist: WaitlistService) {}

  @Post()
  async join(@CurrentUser() user: UserEntity, @Body() body: unknown): Promise<WaitlistEntry> {
    const parsed = JoinWaitlistWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid waitlist payload");
    return this.waitlist.join(user.id, parsed.data.eventId);
  }

  @Post(":id/confirm")
  confirm(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string): Promise<WaitlistEntry> {
    return this.waitlist.confirm(user.id, id);
  }
}
