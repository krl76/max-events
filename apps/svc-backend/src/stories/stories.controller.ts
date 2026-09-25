// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for stories — list, create.
// SCOPE: GET/POST /stories; both behind the global auth guard.
// DEPENDS: @nestjs/common, zod, @max-events/api-contracts, ../auth/auth.guard
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - StoriesController - list/create
// END_MODULE_MAP

import { BadRequestException, Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { CreateStoryWriteSchema, StoryPollVoteWriteSchema, type Story } from "@max-events/api-contracts";
import { CurrentUser } from "../auth/auth.guard";
import { UserEntity } from "../users/user.entity";
import { StoriesService } from "./stories.service";

@Controller("stories")
export class StoriesController {
  constructor(@Inject(StoriesService) private readonly stories: StoriesService) {}

  @Get()
  list(@CurrentUser() user: UserEntity): Promise<Story[]> {
    return this.stories.list(user.id);
  }

  @Post()
  async create(@CurrentUser() user: UserEntity, @Body() body: unknown): Promise<Story> {
    const parsed = CreateStoryWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid story payload");
    return this.stories.create(user.id, parsed.data);
  }

  @Post(":id/poll")
  async vote(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown): Promise<Story> {
    const parsed = StoryPollVoteWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid story payload");
    return this.stories.vote(user.id, id, parsed.data.optionIndex);
  }
}
