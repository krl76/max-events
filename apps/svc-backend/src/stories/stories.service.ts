// START_MODULE_CONTRACT
// PURPOSE: Stories — create/list for the stories rail with a 24h TTL.
// SCOPE: list returns own + friends' stories from the last 24h, grouped by author; create stores a story for the given author.
// DEPENDS: typeorm, @max-events/api-contracts
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - StoriesService - create/list
// - toStoryDto - entity to the Story contract
// - STORY_TTL_MS - stories expire 24 hours after creation; older ones leave the list
// END_MODULE_MAP

import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { StorySchema, type CreateStoryWrite, type Story } from "@max-events/api-contracts";
import { FriendsService } from "../friends/friends.service";
import { StoryEntity } from "./story.entity";

export const STORY_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class StoriesService {
  constructor(
    @InjectRepository(StoryEntity) private readonly stories: Repository<StoryEntity>,
    @Inject(FriendsService) private readonly friends: FriendsService,
  ) {}

  async list(userId: string, now = new Date()): Promise<Story[]> {
    const cutoff = new Date(now.getTime() - STORY_TTL_MS);
    const allowed = await this.friends.friendIds(userId);
    const close = await this.friends.authorsWhoMarkedClose(userId);
    const recent = (await this.stories.find({ order: { createdAt: "DESC" } })).filter((row) => row.createdAt.getTime() > cutoff.getTime());
    const visible = recent.filter((row) => canSeeStory(row, userId, allowed, close));
    const rows = visible;
    const groups = new Map<string, StoryEntity[]>();
    for (const row of rows) {
      const bucket = groups.get(row.userId) ?? [];
      bucket.push(row);
      groups.set(row.userId, bucket);
    }
    return [...groups.values()].flatMap((group) => group.map((row) => toStoryDto(row, userId)));
  }

  async create(userId: string, payload: CreateStoryWrite): Promise<Story> {
    const saved = await this.stories.save(
      this.stories.create({
        userId,
        imageUrl: payload.imageUrl,
        text: payload.text ?? "",
        sticker: payload.sticker ?? null,
        poll: payload.poll === null || payload.poll === undefined ? null : { question: payload.poll.question, options: payload.poll.options, votes: {} },
        audience: payload.audience ?? "friends",
        objects: payload.objects ?? [],
      }),
    );
    return toStoryDto(saved, userId);
  }

  async vote(userId: string, storyId: string, optionIndex: number): Promise<Story> {
    const row = await this.stories.findOneBy({ id: storyId });
    if (!row || !row.poll) throw new NotFoundException("Story not found");
    if (optionIndex < 0 || optionIndex >= row.poll.options.length) throw new BadRequestException("Invalid story payload");
    const allowed = await this.friends.friendIds(userId);
    const close = await this.friends.authorsWhoMarkedClose(userId);
    if (!canSeeStory(row, userId, allowed, close)) throw new NotFoundException("Story not found");
    const votes = { ...(row.poll.votes ?? {}) };
    votes[userId] = optionIndex;
    row.poll = { question: row.poll.question, options: row.poll.options, votes };
    await this.stories.save(row);
    return toStoryDto(row, userId);
  }
}

function canSeeStory(row: StoryEntity, viewerId: string, friends: Set<string>, close: Set<string>): boolean {
  if (row.userId === viewerId) return true;
  if (row.audience === "city") return true;
  if (row.audience === "close-friends") return close.has(row.userId);
  return friends.has(row.userId);
}

export function toStoryDto(row: StoryEntity, viewerId: string): Story {
  return StorySchema.parse({
    id: row.id,
    userId: row.userId,
    imageUrl: row.imageUrl,
    text: row.text ?? "",
    sticker: row.sticker ?? null,
    poll: row.poll ? presentPoll(row.poll, viewerId) : null,
    audience: row.audience ?? "friends",
    objects: row.objects ?? [],
    createdAt: row.createdAt.toISOString(),
  });
}

function presentPoll(poll: { question: string; options: string[]; votes?: Record<string, number> }, viewerId: string) {
  const votes = poll.votes ?? {};
  const counts = poll.options.map((_, index) => Object.values(votes).filter((choice) => choice === index).length);
  const mine = votes[viewerId];
  const answer = typeof mine === "number" && mine >= 0 && mine < poll.options.length ? mine : null;
  return { question: poll.question, options: poll.options, answer, counts };
}
