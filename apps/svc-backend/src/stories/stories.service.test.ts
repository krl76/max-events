import { describe, expect, it } from "vitest";
import type { Repository } from "typeorm";
import type { FriendsService } from "../friends/friends.service";
import { StoryEntity } from "./story.entity";
import { StoriesService } from "./stories.service";

const author = "00000000-0000-4000-8000-00000000000a";
const other = "00000000-0000-4000-8000-00000000000b";

function createStoreRepo(initial: StoryEntity[] = []) {
  const store = [...initial];
  let seq = 0;
  return {
    store,
    create: (fields: Partial<StoryEntity>) => ({ ...fields }) as StoryEntity,
    find: async (opts: { order?: { createdAt?: "ASC" | "DESC" } } = {}) => {
      const rows = [...store];
      if (opts.order?.createdAt) {
        const direction = opts.order.createdAt === "DESC" ? -1 : 1;
        rows.sort((a, b) => direction * (a.createdAt.getTime() - b.createdAt.getTime()));
      }
      return rows;
    },
    findOneBy: async (where: Record<string, string>) => store.find((row) => Object.entries(where).every(([key, value]) => (row as unknown as Record<string, string>)[key] === value)) ?? null,
    save: async (entity: StoryEntity) => {
      if (!store.includes(entity)) {
        entity.id ??= `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
        entity.createdAt ??= new Date(Date.now() + seq * 1000);
        store.push(entity);
      }
      return entity;
    },
  };
}

function createService(friendIds: string[] = []) {
  const stories = createStoreRepo();
  const friends = { friendIds: async () => new Set(friendIds) } as unknown as FriendsService;
  const service = new StoriesService(stories as unknown as Repository<StoryEntity>, friends);
  return { service, stories };
}

describe("StoriesService", () => {
  it("creates a story for the author and returns the contract shape", async () => {
    const { service } = createService();
    const created = await service.create(author, { imageUrl: "data:image/png;base64,abc", audience: "close-friends", sticker: { eventId: "00000000-0000-4000-8000-0000000000e1", title: "Джаз", subtitle: "Парк · 14:00", seatsLeft: 4 }, poll: { question: "Когда?", options: ["14:00", "17:00"], answer: 0 } });
    expect(created.audience).toBe("close-friends");
    expect(created.sticker?.seatsLeft).toBe(4);
    expect(created.userId).toBe(author);
    expect(created.imageUrl).toBe("data:image/png;base64,abc");
    expect(created.id).toMatch(/^00000000-0000-4000-8000-/);
    expect(created.createdAt).not.toHaveLength(0);
  });

  it("lists own and friends' stories from the last 24 hours, freshest author first", async () => {
    const { service, stories } = createService([other]);
    const now = new Date("2026-09-16T12:00:00Z");
    stories.store.push({ id: "00000000-0000-4000-8000-0000000000f1", userId: author, imageUrl: "own", createdAt: new Date("2026-09-16T09:00:00Z") } as StoryEntity, { id: "00000000-0000-4000-8000-0000000000f2", userId: other, imageUrl: "friend", createdAt: new Date("2026-09-16T10:00:00Z") } as StoryEntity, { id: "00000000-0000-4000-8000-0000000000f3", userId: "00000000-0000-4000-8000-0000000000cc", imageUrl: "stranger", audience: "city", createdAt: new Date("2026-09-16T11:00:00Z") } as StoryEntity);
    const listed = await service.list(author, now);
    expect(listed.map((story) => story.imageUrl)).toEqual(["stranger", "friend", "own"]);
  });

  it("keeps a just-created own story and drops one older than 24 hours", async () => {
    const { service, stories } = createService();
    const now = new Date("2026-09-16T12:00:00Z");
    stories.store.push({ id: "00000000-0000-4000-8000-0000000000f1", userId: author, imageUrl: "expired", createdAt: new Date("2026-09-15T11:59:00Z") }, { id: "00000000-0000-4000-8000-0000000000f2", userId: author, imageUrl: "fresh", createdAt: new Date("2026-09-15T12:01:00Z") });
    const listed = await service.list(author, now);
    expect(listed.map((story) => story.imageUrl)).toEqual(["fresh"]);
  });
});
