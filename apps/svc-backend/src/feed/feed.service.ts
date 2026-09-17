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
import { Repository } from "typeorm";
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

  async list(viewerId: string, eventId?: string): Promise<FeedPost[]> {
    const rows = (eventId ? await this.posts.find({ where: { eventId } }) : await this.posts.find()).filter((row) => row.published !== false);
    rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return Promise.all(rows.map((row) => this.toDto(row, viewerId)));
  }

  async create(userId: string, payload: CreateFeedPostWrite): Promise<FeedPost> {
    await this.publishers.assertCanPublish(userId);
    const event = await this.events.findOneBy({ id: payload.eventId });
    if (!event) throw new NotFoundException("Event not found");
    const saved = await this.posts.save(this.posts.create({ authorUserId: userId, eventId: payload.eventId, text: payload.text, published: true }));
    return this.toDto(saved, userId);
  }

  async toggleLike(userId: string, postId: string): Promise<FeedPost> {
    const post = await this.requirePost(postId);
    const existing = await this.likes.findOneBy({ postId, userId });
    if (existing) await this.likes.remove(existing);
    else await this.likes.save(this.likes.create({ postId, userId }));
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
    const author = await this.users.findOneBy({ id: post.authorUserId });
    if (!author) throw new NotFoundException("Author not found");
    const likeRows = await this.likes.find({ where: { postId: post.id } });
    const commentRows = await this.comments.find({ where: { postId: post.id } });
    commentRows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const comments = [];
    for (const row of commentRows) {
      const commentAuthor = await this.users.findOneBy({ id: row.authorUserId });
      if (!commentAuthor) continue;
      comments.push({ id: row.id, author: toFriendDto(commentAuthor), text: row.text });
    }
    return {
      id: post.id,
      author: toFriendDto(author),
      eventId: post.eventId,
      text: post.text,
      likesCount: likeRows.length,
      likedByMe: likeRows.some((row) => row.userId === viewerId),
      comments,
    };
  }
}
