import { NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { Repository } from "typeorm";
import { EventEntity } from "../events/event.entity";
import { UserEntity } from "../users/user.entity";
import { FeedCommentEntity, FeedLikeEntity, FeedPostEntity } from "./feed-post.entity";
import { FeedService } from "./feed.service";

const now = new Date("2026-09-12T10:00:00Z");
const userId = "00000000-0000-4000-8000-00000000000a";
const eventId = "00000000-0000-4000-8000-0000000000e1";

function createStoreRepo<T extends { id?: string }>(initial: T[] = []) {
  const store = [...initial];
  let seq = 0;
  return {
    store,
    create: (fields: Partial<T>) => ({ ...fields, createdAt: now }) as unknown as T,
    find: async (opts: { where?: Record<string, string> } = {}) => {
      const where = opts.where ?? {};
      return store.filter((row) => Object.entries(where).every(([key, value]) => (row as Record<string, unknown>)[key] === value));
    },
    findOneBy: async (where: Record<string, string>) => store.find((row) => Object.entries(where).every(([key, value]) => (row as Record<string, unknown>)[key] === value)) ?? null,
    save: async (entity: T) => {
      if (!store.includes(entity)) {
        entity.id ??= `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
        store.push(entity);
      }
      return entity;
    },
    remove: async (entity: T) => {
      const index = store.indexOf(entity);
      if (index >= 0) store.splice(index, 1);
      return entity;
    },
  };
}

function createService() {
  const posts = createStoreRepo<FeedPostEntity>();
  const likes = createStoreRepo<FeedLikeEntity>();
  const comments = createStoreRepo<FeedCommentEntity>();
  const events = createStoreRepo<EventEntity>([{ id: eventId } as EventEntity]);
  const users = createStoreRepo<UserEntity>([{ id: userId, firstName: "Анна", lastName: "Соколова", avatarUrl: null } as UserEntity]);
  const service = new FeedService(posts as unknown as Repository<FeedPostEntity>, likes as unknown as Repository<FeedLikeEntity>, comments as unknown as Repository<FeedCommentEntity>, events as unknown as Repository<EventEntity>, users as unknown as Repository<UserEntity>);
  return { service, likes };
}

describe("FeedService", () => {
  it("publishes a post immediately and lists it newest first", async () => {
    const { service } = createService();
    const created = await service.create(userId, { eventId, text: "Как прошло — огонь" });
    expect(created.text).toBe("Как прошло — огонь");
    expect(created.author.name).toBe("Анна Соколова");
    expect(created.likesCount).toBe(0);
    const listed = await service.list(userId, eventId);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(created.id);
  });

  it("toggles a like and adds a comment", async () => {
    const { service } = createService();
    const created = await service.create(userId, { eventId, text: "фото" });
    const liked = await service.toggleLike(userId, created.id);
    expect(liked.likesCount).toBe(1);
    expect(liked.likedByMe).toBe(true);
    const unliked = await service.toggleLike(userId, created.id);
    expect(unliked.likesCount).toBe(0);
    const commented = await service.addComment(userId, created.id, "согласен");
    expect(commented.comments).toHaveLength(1);
    expect(commented.comments[0]?.text).toBe("согласен");
  });

  it("rejects a post for an unknown event", async () => {
    const { service } = createService();
    await expect(service.create(userId, { eventId: "00000000-0000-4000-8000-0000000000e9", text: "x" })).rejects.toBeInstanceOf(NotFoundException);
  });
});
