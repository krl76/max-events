import { readFileSync } from "node:fs";
import { HttpException, NotFoundException } from "@nestjs/common";
import type { ComposeCityWalkWrite } from "@max-events/api-contracts";
import { describe, expect, it } from "vitest";
import { CityWalkEntity } from "./city-walk.entity";
import { WalksService, type CandidateRanker, type ListedPlace, type PlaceLister, type WalkStore, type WikidataLookup } from "./walks.service";

const parkA = "11111111-1111-4111-8111-111111111111";
const parkB = "22222222-2222-4222-8222-222222222222";
const userA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const userB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const write: ComposeCityWalkWrite = {
  city: "Москва",
  durationMinutes: 180,
  budgetMode: "any",
  budgetRub: null,
  interests: ["parks"],
  excludeKeys: [],
};

function place(id: string, title: string): ListedPlace {
  return { id, title, address: `${title}, Москва`, category: "park", latitude: id === parkA ? 55.75 : 55.7502, longitude: id === parkA ? 37.62 : 37.6202 };
}

class MemoryStore implements WalkStore {
  readonly rows: CityWalkEntity[] = [];

  async save(row: CityWalkEntity): Promise<CityWalkEntity> {
    const index = this.rows.findIndex((item) => item.id === row.id);
    if (index >= 0) this.rows[index] = row;
    else this.rows.push(row);
    return row;
  }

  async find(options: { where: { userId: string }; order: { createdAt: "DESC" } }): Promise<CityWalkEntity[]> {
    return this.rows.filter((row) => row.userId === options.where.userId);
  }

  async findOne(options: { where: { id: string; userId: string } }): Promise<CityWalkEntity | null> {
    return this.rows.find((row) => row.id === options.where.id && row.userId === options.where.userId) ?? null;
  }
}

function service(store: MemoryStore, places: readonly ListedPlace[], rank: CandidateRanker, lookup: WikidataLookup): WalksService {
  const lister: PlaceLister = { list: async () => places };
  return new WalksService(store, lister, rank, lookup);
}

describe("WalksService", () => {
  it("saves a catalog walk when wikidata fails", async () => {
    const store = new MemoryStore();
    const lookup: WikidataLookup = async () => {
      throw new Error("timeout");
    };
    const walk = await service(store, [place(parkA, "Парк Горького"), place(parkB, "Нескучный сад")], { rankCandidateIds: async (items) => items.map((item) => item.id) }, lookup).compose(userA, write);
    expect(walk.sourceLabel).toBe("catalog");
    expect(walk.stops).toHaveLength(2);
    expect(walk.stops.every((stop) => stop.sourceUrl.startsWith("app://places/"))).toBe(true);
    expect(store.rows).toHaveLength(1);
    expect(store.rows[0]?.userId).toBe(userA);
    expect(store.rows[0]?.payload.id).toBe(walk.id);
  });

  it("rejects a walk with fewer than two sights", async () => {
    const lookup: WikidataLookup = async () => [];
    const pending = service(new MemoryStore(), [place(parkA, "Парк Горького")], { rankCandidateIds: async (items) => items.map((item) => item.id) }, lookup).compose(userA, write);
    await expect(pending).rejects.toBeInstanceOf(HttpException);
    await expect(pending).rejects.toMatchObject({ status: 422 });
    try {
      await pending;
    } catch (error) {
      if (!(error instanceof HttpException)) throw error;
      expect(error.getResponse()).toEqual({ code: "no_sights" });
    }
  });

  it("ignores a rank id that is not a candidate", async () => {
    const lookup: WikidataLookup = async () => [];
    const walk = await service(new MemoryStore(), [place(parkA, "Парк Горького"), place(parkB, "Нескучный сад")], { rankCandidateIds: async () => ["foreign-id", parkB, parkA] }, lookup).compose(userA, write);
    expect(walk.stops.map((stop) => stop.placeId)).not.toContain("foreign-id");
    expect(walk.stops.map((stop) => stop.title)).toEqual(expect.arrayContaining(["Парк Горького", "Нескучный сад"]));
  });

  it("does not return another user's walk", async () => {
    const store = new MemoryStore();
    const lookup: WikidataLookup = async () => [];
    const walks = service(store, [place(parkA, "Парк Горького"), place(parkB, "Нескучный сад")], { rankCandidateIds: async (items) => items.map((item) => item.id) }, lookup);
    const saved = await walks.compose(userA, write);
    await expect(walks.get(userB, saved.id)).rejects.toBeInstanceOf(NotFoundException);
    expect(await walks.list(userB)).toEqual([]);
    expect(await walks.list(userA)).toEqual([saved]);
  });

  it("marks one stop done without a check-in", async () => {
    const store = new MemoryStore();
    const lookup: WikidataLookup = async () => [];
    const walks = service(store, [place(parkA, "Парк Горького"), place(parkB, "Нескучный сад")], { rankCandidateIds: async (items) => items.map((item) => item.id) }, lookup);
    const saved = await walks.compose(userA, write);
    const marked = await walks.setDone(userA, saved.id, 1, true);
    expect(marked.stops.find((stop) => stop.order === 1)?.done).toBe(true);
    expect(marked.stops.find((stop) => stop.order === 2)?.done).toBe(false);
    await expect(walks.setDone(userB, saved.id, 1, true)).rejects.toBeInstanceOf(NotFoundException);
    await expect(walks.setDone(userA, saved.id, 9, true)).rejects.toBeInstanceOf(NotFoundException);
    const source = readFileSync(new URL("./walks.controller.ts", import.meta.url), "utf8");
    expect(source).toContain("setDone");
    expect(source).not.toContain("check-in");
    expect(source).not.toContain("checkins");
  });

  it("does not import check-in", () => {
    const source = readFileSync(new URL("./walks.service.ts", import.meta.url), "utf8");
    expect(source).not.toContain("check-in");
    expect(source).not.toContain("checkins");
  });
});
