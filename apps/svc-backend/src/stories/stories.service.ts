// START_MODULE_CONTRACT
// PURPOSE: Stories — minimal create/list for the stories rail, no TTL.
// SCOPE: list returns every story freshest first; create stores a story for the given author.
// DEPENDS: typeorm, @max-events/api-contracts
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - StoriesService - create/list
// - toStoryDto - entity to the Story contract
// END_MODULE_MAP

import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { StorySchema, type Story } from "@max-events/api-contracts";
import { StoryEntity } from "./story.entity";

@Injectable()
export class StoriesService {
  constructor(@InjectRepository(StoryEntity) private readonly stories: Repository<StoryEntity>) {}

  async list(): Promise<Story[]> {
    const rows = await this.stories.find({ order: { createdAt: "DESC" } });
    return rows.map(toStoryDto);
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
