// START_MODULE_CONTRACT
// PURPOSE: Feed wall — create posts, toggle likes, add comments, list newest-first optionally filtered by event.
// SCOPE: toFeedPost includes author, likesCount, likedByMe for the requester, comments.
// DEPENDS: typeorm, @max-events/api-contracts, events/users
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - FeedService - list/create/toggleLike/addComment
// END_MODULE_MAP

import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, QueryFailedError, Repository } from "typeorm";
import type { CreateFeedPostWrite, FeedPost } from "@max-events/api-contracts";
import { EventEntity } from "../events/event.entity";
import { toFriendDto } from "../friends/friends.service";
import { UserEntity } from "../users/user.entity";
import { UsersService } from "../users/users.service";
import { FeedCommentEntity, FeedLikeEntity, FeedPostEntity } from "./feed-post.entity";

@Injectable()
export class FeedService {
  constructor(
    @InjectRepository(FeedPostEntity) private readonly posts: Repository<FeedPostEntity>,
    @InjectRepository(FeedLikeEntity) private readonly likes: Repository<FeedLikeEntity>,
    @InjectRepository(FeedCommentEntity) private readonly comments: Repository<FeedCommentEntity>,
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @Inject(UsersService) private readonly publishers: UsersService,
  ) {}

  async list(viewerId: string, eventId?: string, limit = 50, offset = 0): Promise<FeedPost[]> {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = Math.max(offset, 0);
    const where = eventId ? { eventId, published: true as const } : { published: true as const };
    const rows = await this.posts.find({ where, order: { createdAt: "DESC", id: "DESC" }, take, skip });
    return this.toDtoMany(rows, viewerId);
  }

  async create(userId: string, payload: CreateFeedPostWrite): Promise<FeedPost> {
    await this.publishers.assertCanPublish(userId);
    const event = await this.events.findOneBy({ id: payload.eventId });
    if (!event || event.published === false) throw new NotFoundException("Event not found");
    const saved = await this.posts.save(this.posts.create({ authorUserId: userId, eventId: payload.eventId, text: payload.text, published: true }));
    return this.toDto(saved, userId);
  }

  async toggleLike(userId: string, postId: string): Promise<FeedPost> {
    const post = await this.requirePost(postId);
    const existing = await this.likes.findOneBy({ postId, userId });
    if (existing) await this.likes.remove(existing);
    else {
      try {
        await this.likes.save(this.likes.create({ postId, userId }));
      } catch (error) {
        if (!(error instanceof QueryFailedError && error.driverError?.code === "23505")) throw error;
      }
    }
    return this.toDto(post, userId);
  }

  async addComment(userId: string, postId: string, text: string): Promise<FeedPost> {
    const post = await this.requirePost(postId);
    await this.comments.save(this.comments.create({ postId, authorUserId: userId, text }));
    return this.toDto(post, userId);
  }

  async unpublish(id: string): Promise<void> {
    const post = await this.posts.findOneBy({ id });
    if (!post) throw new NotFoundException("Feed post not found");
    post.published = false;
    await this.posts.save(post);
  }

  private async requirePost(id: string): Promise<FeedPostEntity> {
    const post = await this.posts.findOneBy({ id });
    if (!post || post.published === false) throw new NotFoundException("Feed post not found");
    return post;
  }

  private async toDto(post: FeedPostEntity, viewerId: string): Promise<FeedPost> {
    const [dto] = await this.toDtoMany([post], viewerId);
    if (!dto) throw new NotFoundException("Author not found");
    return dto;
  }

  private async toDtoMany(posts: FeedPostEntity[], viewerId: string): Promise<FeedPost[]> {
    if (posts.length === 0) return [];
    const postIds = posts.map((row) => row.id);
    const userIds = [...new Set(posts.flatMap((row) => [row.authorUserId]))];
    const [authors, likeRows, commentRows] = await Promise.all([
      this.users.find({ where: { id: In(userIds) } }),
      this.likes.find({ where: { postId: In(postIds) } }),
      this.comments.find({ where: { postId: In(postIds) } }),
    ]);
    const commentAuthorIds = [...new Set(commentRows.map((row) => row.authorUserId))];
    const commentAuthors = commentAuthorIds.length === 0 ? [] : await this.users.find({ where: { id: In(commentAuthorIds) } });
    const userById = new Map([...authors, ...commentAuthors].map((row) => [row.id, row]));
    return posts.flatMap((post) => {
      const author = userById.get(post.authorUserId);
      if (!author) return [];
      const likes = likeRows.filter((row) => row.postId === post.id);
      const comments = commentRows
        .filter((row) => row.postId === post.id)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .flatMap((row) => {
          const commentAuthor = userById.get(row.authorUserId);
          return commentAuthor ? [{ id: row.id, author: toFriendDto(commentAuthor), text: row.text }] : [];
        });
      return [{ id: post.id, author: toFriendDto(author), eventId: post.eventId, text: post.text, likesCount: likes.length, likedByMe: likes.some((row) => row.userId === viewerId), comments }];
    });
  }
}
