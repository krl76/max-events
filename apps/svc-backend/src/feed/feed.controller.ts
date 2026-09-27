// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for the feed wall.
// SCOPE: GET /feed (?eventId or ?placeId wall), GET /feed/cards, GET /feed/:id, POST /feed, POST /feed/:id/like, POST /feed/:id/comments.
// DEPENDS: @nestjs/common, @max-events/api-contracts, ../auth/auth.guard, ./feed.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - FeedController - list/create/like/comment
// - requireId - optional uuid query parameter or 400
// END_MODULE_MAP

import { BadRequestException, Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { AddFeedCommentWriteSchema, CreateFeedPostWriteSchema, FeedDraftWriteSchema, type BookingWithSeats, type FeedCard, type FeedDraftSaved, type FeedPost } from "@max-events/api-contracts";
import { CurrentUser } from "../auth/auth.guard";
import { UserEntity } from "../users/user.entity";
import { FeedService } from "./feed.service";

export function requireId(value: string | undefined, message: string): string | undefined {
  if (value === undefined || value === "") return undefined;
  if (!/^[0-9a-f-]{36}$/i.test(value)) throw new BadRequestException(message);
  return value;
}

@Controller("feed")
export class FeedController {
  constructor(@Inject(FeedService) private readonly feed: FeedService) {}

  @Get()
  list(@CurrentUser() user: UserEntity, @Query("eventId") eventId?: string, @Query("placeId") placeId?: string, @Query("limit") queryLimit?: string, @Query("offset") queryOffset?: string): Promise<FeedPost[]> {
    const event = requireId(eventId, "Invalid eventId");
    const place = requireId(placeId, "Invalid placeId");
    if (event && place) throw new BadRequestException("Filter the feed by eventId or placeId, not both");
    const limit = queryLimit === undefined || queryLimit === "" ? 50 : Number(queryLimit);
    const offset = queryOffset === undefined || queryOffset === "" ? 0 : Number(queryOffset);
    if (!Number.isInteger(limit) || limit < 1 || !Number.isInteger(offset) || offset < 0) throw new BadRequestException("Invalid feed query");
    return this.feed.list(user.id, { eventId: event, placeId: place }, limit, offset);
  }

  @Get("cards")
  listCards(@CurrentUser() user: UserEntity): Promise<FeedCard[]> {
    return this.feed.listCards(user.id);
  }

  @Get(":id")
  get(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string): Promise<FeedPost> {
    return this.feed.get(user.id, id);
  }

  @Post()
  async create(@CurrentUser() user: UserEntity, @Body() body: unknown): Promise<FeedPost> {
    const parsed = CreateFeedPostWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid feed post payload");
    return this.feed.create(user.id, parsed.data);
  }

  @Post("drafts")
  async saveDraft(@CurrentUser() user: UserEntity, @Body() body: unknown): Promise<FeedDraftSaved> {
    const parsed = FeedDraftWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid feed draft payload");
    return this.feed.saveDraft(user.id, parsed.data);
  }

  @Post(":id/join")
  join(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string): Promise<BookingWithSeats> {
    return this.feed.join(user.id, id);
  }

  @Post(":id/like")
  toggleLike(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string): Promise<FeedPost> {
    return this.feed.toggleLike(user.id, id);
  }

  @Post("events/:eventId/repost")
  repostEvent(@CurrentUser() user: UserEntity, @Param("eventId", ParseUUIDPipe) eventId: string): Promise<FeedPost> {
    return this.feed.repostEvent(user.id, eventId);
  }

  @Post(":id/going")
  toggleGoing(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string): Promise<FeedPost> {
    return this.feed.toggleGoing(user.id, id);
  }

  @Post(":id/repost")
  repost(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string): Promise<FeedPost> {
    return this.feed.repostPost(user.id, id);
  }

  @Post(":id/comments")
  async addComment(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown): Promise<FeedPost> {
    const parsed = AddFeedCommentWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid comment payload");
    return this.feed.addComment(user.id, id, parsed.data.text, parsed.data.parentId ?? null);
  }
}
