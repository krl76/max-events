import { describe, expect, it } from "vitest";
import type { Repository } from "typeorm";
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

function createService() {
  const stories = createStoreRepo();
  const service = new StoriesService(stories as unknown as Repository<StoryEntity>);
  return { service, stories };
}

describe("StoriesService", () => {
  it("creates a story for the author and returns the contract shape", async () => {
    const { service } = createService();
    const created = await service.create(author, "data:image/png;base64,abc");
    expect(created.userId).toBe(author);
    expect(created.imageUrl).toBe("data:image/png;base64,abc");
    expect(created.id).toMatch(/^00000000-0000-4000-8000-/);
    expect(created.createdAt).not.toHaveLength(0);
  });

  it("lists stories freshest first", async () => {
    const { service, stories } = createService();
    stories.store.push(
      { id: "00000000-0000-4000-8000-0000000000f1", userId: author, imageUrl: "old", createdAt: new Date("2026-09-15T10:00:00Z") },
      { id: "00000000-0000-4000-8000-0000000000f2", userId: other, imageUrl: "new", createdAt: new Date("2026-09-16T10:00:00Z") },
    );
    const listed = await service.list();
    expect(listed.map((story) => story.imageUrl)).toEqual(["new", "old"]);
  });
});
