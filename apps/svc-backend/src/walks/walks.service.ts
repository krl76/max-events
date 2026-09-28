// START_MODULE_CONTRACT
// PURPOSE: Compose a city walk from published places or Wikidata and store it for one user.
// SCOPE: compose, list, and get. Unknown rank ids are dropped. Fewer than two sights is 422 no_sights.
// DEPENDS: @nestjs/common, @nestjs/typeorm, @max-events/api-contracts, ./fit-walk, ./wikidata-rows, ./city-walk.entity
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - WIKIDATA_LOOKUP - injection token for the city sight lookup
// - WalksService - compose and read city walks for the authenticated user
// END_MODULE_MAP

import { randomUUID } from "node:crypto";
import { HttpException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { CityWalkSchema, type CityWalk, type CityWalkStop, type ComposeCityWalkWrite, type WalkSourceLabel } from "@max-events/api-contracts";
import { LLM_PROVIDER } from "../assist/llm-provider";
import { PlacesService } from "../places/places.service";
import { CityWalkEntity } from "./city-walk.entity";
import { fitWalk } from "./fit-walk";
import type { CityWalkCandidate } from "./wikidata-rows";

export const WIKIDATA_LOOKUP = Symbol("WIKIDATA_LOOKUP");

export type WikidataLookup = (city: string, interests: readonly string[]) => Promise<CityWalkCandidate[]>;

export type WalkStore = {
  save(row: CityWalkEntity): Promise<CityWalkEntity>;
  find(options: { where: { userId: string }; order: { createdAt: "DESC" } }): Promise<CityWalkEntity[]>;
  findOne(options: { where: { id: string; userId: string } }): Promise<CityWalkEntity | null>;
};

export type ListedPlace = {
  readonly id: string;
  readonly title: string;
  readonly address: string;
  readonly category: string;
  readonly latitude: number;
  readonly longitude: number;
};

export type PlaceLister = {
  list(query: { city?: string; limit?: number; offset: number }): Promise<readonly ListedPlace[]>;
};

export type CandidateRanker = {
  rankCandidateIds(candidates: readonly { id: string; title: string }[]): Promise<string[]>;
};

type ComposePoint = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly address: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly sourceUrl: string;
  readonly placeId: string | null;
  readonly kind: "sight" | "food";
  readonly origin: "web" | "catalog";
};

@Injectable()
export class WalksService {
  constructor(
    @InjectRepository(CityWalkEntity) private readonly walks: WalkStore,
    @Inject(PlacesService) private readonly places: PlaceLister,
    @Inject(LLM_PROVIDER) private readonly llm: CandidateRanker,
    @Inject(WIKIDATA_LOOKUP) private readonly lookup: WikidataLookup,
  ) {}

  async compose(userId: string, write: ComposeCityWalkWrite): Promise<CityWalk> {
    const places = await this.places.list({ city: write.city, limit: 40, offset: 0 });
    const web = await this.lookup(write.city, write.interests).catch(() => []);
    const points = kept([...web.map((row) => fromWeb(row, write.city)), ...places.map((place) => fromPlace(place, write.city))], write.excludeKeys);
    const sights = points.filter((point) => point.kind === "sight");
    const foods = points.filter((point) => point.kind === "food");
    if (sights.length < 2) throw noSights();
    const ranked = reorder(sights, await this.llm.rankCandidateIds(sights.map((point) => ({ id: point.id, title: point.title }))).catch(() => sights.map((point) => point.id)));
    const fitted = fitWalk({
      stops: [...ranked, ...foods].map((point) => ({ id: point.id, title: point.title, latitude: point.latitude, longitude: point.longitude, kind: point.kind })),
      durationMinutes: write.durationMinutes,
      budgetMode: write.budgetMode,
      budgetRub: write.budgetRub,
    });
    const pool = new Map([...ranked, ...foods].map((point) => [point.id, point]));
    const chosen: ComposePoint[] = [];
    for (const stop of fitted.stops) {
      const point = pool.get(stop.id);
      if (point !== undefined) chosen.push(point);
    }
    if (chosen.length < 2) throw noSights();
    const createdAt = new Date().toISOString();
    const walk = CityWalkSchema.parse({
      id: randomUUID(),
      city: write.city,
      durationMinutes: write.durationMinutes,
      budgetMode: write.budgetMode,
      budgetRub: write.budgetRub,
      interests: write.interests,
      sourceLabel: labelFor(chosen),
      fitted: fitted.fitted,
      stops: chosen.map((point, index) => toStop(point, index + 1)),
      legs: fitted.legs,
      createdAt,
    });
    const row = new CityWalkEntity();
    row.id = walk.id;
    row.userId = userId;
    row.city = walk.city;
    row.payload = walk;
    row.createdAt = new Date(createdAt);
    await this.walks.save(row);
    return walk;
  }

  async list(userId: string): Promise<CityWalk[]> {
    const rows = await this.walks.find({ where: { userId }, order: { createdAt: "DESC" } });
    return [...rows].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime()).map((row) => row.payload);
  }

  async get(userId: string, id: string): Promise<CityWalk> {
    const row = await this.walks.findOne({ where: { id, userId } });
    if (row === null) throw new NotFoundException();
    return row.payload;
  }

  async setDone(userId: string, id: string, order: number, done: boolean): Promise<CityWalk> {
    const row = await this.walks.findOne({ where: { id, userId } });
    if (row === null) throw new NotFoundException();
    if (!row.payload.stops.some((stop) => stop.order === order)) throw new NotFoundException();
    const walk = CityWalkSchema.parse({
      ...row.payload,
      stops: row.payload.stops.map((stop) => (stop.order === order ? { ...stop, done } : stop)),
    });
    row.payload = walk;
    await this.walks.save(row);
    return walk;
  }
}

function noSights(): HttpException {
  return new HttpException({ code: "no_sights" }, 422);
}

function fromWeb(row: CityWalkCandidate, city: string): ComposePoint {
  return {
    id: row.sourceUrl,
    title: row.title,
    description: row.description.length > 0 ? row.description : `Место в городе ${city}.`,
    address: city,
    latitude: row.latitude,
    longitude: row.longitude,
    sourceUrl: row.sourceUrl,
    placeId: null,
    kind: "sight",
    origin: "web",
  };
}

function fromPlace(place: ListedPlace, city: string): ComposePoint {
  return {
    id: place.id,
    title: place.title,
    description: `Место в городе ${city}.`,
    address: place.address,
    latitude: place.latitude,
    longitude: place.longitude,
    sourceUrl: `app://places/${place.id}`,
    placeId: place.id,
    kind: place.category === "food" ? "food" : "sight",
    origin: "catalog",
  };
}

function kept(points: readonly ComposePoint[], keys: readonly string[]): ComposePoint[] {
  return points.filter((point) => !keys.includes(point.sourceUrl) && (point.placeId === null || !keys.includes(point.placeId)));
}

function reorder(sights: readonly ComposePoint[], order: readonly string[]): ComposePoint[] {
  const byId = new Map(sights.map((point) => [point.id, point]));
  const ranked: ComposePoint[] = [];
  for (const id of order) {
    const point = byId.get(id);
    if (point === undefined || ranked.includes(point)) continue;
    ranked.push(point);
  }
  for (const point of sights) {
    if (!ranked.includes(point)) ranked.push(point);
  }
  return ranked;
}

function labelFor(stops: readonly ComposePoint[]): WalkSourceLabel {
  if (stops.every((stop) => stop.origin === "web")) return "web";
  if (stops.every((stop) => stop.origin === "catalog")) return "catalog";
  return "mixed";
}

function toStop(point: ComposePoint, order: number): CityWalkStop {
  return {
    order,
    title: point.title,
    address: point.address,
    latitude: point.latitude,
    longitude: point.longitude,
    description: point.description,
    sourceUrl: point.sourceUrl,
    placeId: point.placeId,
    done: false,
  };
}
