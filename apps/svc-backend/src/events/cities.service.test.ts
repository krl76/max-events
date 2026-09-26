import { describe, expect, it } from "vitest";
import type { Repository } from "typeorm";
import type { Place } from "@max-events/api-contracts";
import type { PlacesService } from "../places/places.service";
import { CitiesService } from "./cities.service";
import { EventEntity } from "./event.entity";

function createService(opts: { events?: EventEntity[]; places?: Place[] } = {}) {
  const events = {
    find: async () => opts.events ?? [],
  } as unknown as Repository<EventEntity>;
  const places = {
    list: async () => opts.places ?? [],
  } as unknown as PlacesService;
  return new CitiesService(events, places);
}

describe("CitiesService", () => {
  it("returns a sorted unique directory and an empty catalog as []", async () => {
    await expect(createService().list()).resolves.toEqual([]);
    const cities = await createService({
      events: [{ city: "Казань", published: true } as EventEntity, { city: "Москва", published: true } as EventEntity, { city: "Москва", published: true } as EventEntity],
      places: [{ city: "Сочи" } as Place, { city: "Казань" } as Place],
    }).list();
    expect(cities).toEqual(["Казань", "Москва", "Сочи"]);
  });
});
