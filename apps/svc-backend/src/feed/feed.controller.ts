// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for the feed wall.
// SCOPE: GET/POST /feed, POST /feed/:id/like, POST /feed/:id/comments.
// DEPENDS: @nestjs/common, @max-events/api-contracts, ../auth/auth.guard, ./feed.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - FeedController - list/create/like/comment
// END_MODULE_MAP

import { BadRequestException, Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { AddFeedCommentWriteSchema, CreateFeedPostWriteSchema, type FeedPost } from "@max-events/api-contracts";
import { CurrentUser } from "../auth/auth.guard";
import { UserEntity } from "../users/user.entity";
import { FeedService } from "./feed.service";

@Controller("feed")
export class FeedController {
  constructor(@Inject(FeedService) private readonly feed: FeedService) {}

  @Get()
  list(@CurrentUser() user: UserEntity, @Query("eventId") eventId?: string, @Query("limit") queryLimit?: string, @Query("offset") queryOffset?: string): Promise<FeedPost[]> {
    if (eventId !== undefined && eventId !== "") {
      const parsed = /^[0-9a-f-]{36}$/i.test(eventId);
      if (!parsed) throw new BadRequestException("Invalid eventId");
    }
    const limit = queryLimit === undefined || queryLimit === "" ? 50 : Number(queryLimit);
    const offset = queryOffset === undefined || queryOffset === "" ? 0 : Number(queryOffset);
    if (!Number.isInteger(limit) || limit < 1 || !Number.isInteger(offset) || offset < 0) throw new BadRequestException("Invalid feed query");
    return this.feed.list(user.id, eventId || undefined, limit, offset);
  }

  @Post()
  async create(@CurrentUser() user: UserEntity, @Body() body: unknown): Promise<FeedPost> {
    const parsed = CreateFeedPostWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid feed post payload");
    return this.feed.create(user.id, parsed.data);
  }

  @Post(":id/like")
  toggleLike(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string): Promise<FeedPost> {
    return this.feed.toggleLike(user.id, id);
  }

  @Post(":id/comments")
  async addComment(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown): Promise<FeedPost> {
    const parsed = AddFeedCommentWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid comment payload");
    return this.feed.addComment(user.id, id, parsed.data.text);
  }
}
