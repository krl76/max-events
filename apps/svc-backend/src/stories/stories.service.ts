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

import { Inject, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { StorySchema, type Story } from "@max-events/api-contracts";
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
    allowed.add(userId);
    const rows = (await this.stories.find({ order: { createdAt: "DESC" } })).filter((row) => row.createdAt.getTime() > cutoff.getTime() && allowed.has(row.userId));
    const groups = new Map<string, StoryEntity[]>();
    for (const row of rows) {
      const bucket = groups.get(row.userId) ?? [];
      bucket.push(row);
      groups.set(row.userId, bucket);
    }
    return [...groups.values()].flatMap((group) => group.map(toStoryDto));
  }

  async create(userId: string, imageUrl: string): Promise<Story> {
    const saved = await this.stories.save(this.stories.create({ userId, imageUrl }));
    return toStoryDto(saved);
  }
}

export function toStoryDto(row: StoryEntity): Story {
  return StorySchema.parse({
    id: row.id,
    userId: row.userId,
    imageUrl: row.imageUrl,
    createdAt: row.createdAt.toISOString(),
  });
}
