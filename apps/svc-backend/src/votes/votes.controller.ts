// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for shared event votes.
// SCOPE: POST/GET /votes, GET /votes/:id, POST /votes/:id/ballots.
// DEPENDS: @nestjs/common, @max-events/api-contracts, ../auth, ./votes.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - VotesController - vote CRUD and ballots
// END_MODULE_MAP

import { BadRequestException, Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { CreateVoteWriteSchema, VoteBallotWriteSchema, type Vote } from "@max-events/api-contracts";
import { CurrentUser } from "../auth/auth.guard";
import { UserEntity } from "../users/user.entity";
import { VotesService } from "./votes.service";

@Controller("votes")
export class VotesController {
  constructor(@Inject(VotesService) private readonly votes: VotesService) {}

  @Get()
  list(@CurrentUser() user: UserEntity): Promise<Vote[]> {
    return this.votes.list(user.id);
  }

  @Post()
  async create(@CurrentUser() user: UserEntity, @Body() body: unknown): Promise<Vote> {
    const parsed = CreateVoteWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid vote payload");
    return this.votes.create(user.id, parsed.data);
  }

  @Get(":id")
  get(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string): Promise<Vote> {
    return this.votes.get(user.id, id);
  }

  @Post(":id/ballots")
  async cast(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown): Promise<Vote> {
    const parsed = VoteBallotWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid vote payload");
    return this.votes.castBallot(user.id, id, parsed.data.eventId);
  }
}
