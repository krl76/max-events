// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for the catalog city directory.
// SCOPE: GET /cities — unique published event and place cities, sorted; empty catalog is [].
// DEPENDS: @nestjs/common, ./cities.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - CitiesController - GET /cities
// END_MODULE_MAP

import { Controller, Get, Inject } from "@nestjs/common";
import type { Cities } from "@max-events/api-contracts";
import { CitiesService } from "./cities.service";

@Controller("cities")
export class CitiesController {
  constructor(@Inject(CitiesService) private readonly cities: CitiesService) {}

  @Get()
  list(): Promise<Cities> {
    return this.cities.list();
  }
}
