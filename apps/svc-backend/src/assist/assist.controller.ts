// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for NL event assist.
// SCOPE: POST /assist and POST /assist/day with AssistQueryWriteSchema; POST /assist/chat with AssistChatWriteSchema.
// DEPENDS: @nestjs/common, @max-events/api-contracts, ../auth, ./assist.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - AssistController - POST /assist, POST /assist/day, POST /assist/chat
// END_MODULE_MAP

import { BadRequestException, Body, Controller, Inject, Post } from "@nestjs/common";
import { AssistChatWriteSchema, AssistQueryWriteSchema, type AssistChatResponse, type AssistDayResponse, type AssistResponse } from "@max-events/api-contracts";
import { CurrentUser } from "../auth/auth.guard";
import { UserEntity } from "../users/user.entity";
import { AssistService } from "./assist.service";

@Controller("assist")
export class AssistController {
  constructor(@Inject(AssistService) private readonly assist: AssistService) {}

  @Post()
  async suggest(@CurrentUser() user: UserEntity, @Body() body: unknown): Promise<AssistResponse> {
    const parsed = AssistQueryWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid assist payload");
    return this.assist.suggest(user.id, parsed.data.query);
  }

  @Post("day")
  async planDay(@CurrentUser() user: UserEntity, @Body() body: unknown): Promise<AssistDayResponse> {
    const parsed = AssistQueryWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid assist payload");
    return this.assist.planSaturday(user.id, parsed.data.query, parsed.data.save === true);
  }

  @Post("chat")
  async chat(@CurrentUser() user: UserEntity, @Body() body: unknown): Promise<AssistChatResponse> {
    const parsed = AssistChatWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid assist payload");
    return this.assist.chat(user.id, parsed.data);
  }
}
