// START_MODULE_CONTRACT
// PURPOSE: Unique city names from published events and places for the search filter.
// SCOPE: list() unions Event.city and Place.city; never hardcodes Москва.
// DEPENDS: typeorm, places
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - CitiesService - list unique sorted cities
// END_MODULE_MAP

import { Inject, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PlacesService } from "../places/places.service";
import { EventEntity } from "./event.entity";

@Injectable()
export class CitiesService {
  constructor(
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    @Inject(PlacesService) private readonly places: PlacesService,
  ) {}

  async list(): Promise<string[]> {
    const [events, places] = await Promise.all([this.events.find({ where: { published: true } }), this.places.list({ offset: 0 })]);
    const cities = new Set<string>();
    for (const row of events) if (row.city) cities.add(row.city);
    for (const row of places) if (row.city) cities.add(row.city);
    return [...cities].sort((a, b) => a.localeCompare(b, "ru"));
  }
}
