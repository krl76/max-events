// START_MODULE_CONTRACT
// PURPOSE: City-walk endpoints of the api client: compose, list, reopen, mark a stop done, and delete.
// SCOPE: POST /walks, GET /walks, GET /walks/:id, PATCH /walks/:id/stops/:order, DELETE /walks/:id. No assistDay wrapper.
// DEPENDS: ./transport.js, @max-events/api-contracts
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - withWalks - ApiClient.composeCityWalk / listCityWalks / getCityWalk / setCityWalkStopDone / deleteCityWalk
// END_MODULE_MAP

import { CityWalkSchema } from "@max-events/api-contracts";
import type { CityWalk, ComposeCityWalkWrite } from "@max-events/api-contracts";
import type { ApiMixin } from "./transport";

export function withWalks<TBase extends ApiMixin>(Base: TBase) {
  return class WalkEndpoints extends Base {
    composeCityWalk(body: ComposeCityWalkWrite): Promise<CityWalk> {
      return this.request("/walks", CityWalkSchema, { body });
    }

    listCityWalks(): Promise<CityWalk[]> {
      return this.request("/walks", CityWalkSchema.array());
    }

    getCityWalk(id: string): Promise<CityWalk> {
      return this.request(`/walks/${id}`, CityWalkSchema);
    }

    setCityWalkStopDone(id: string, order: number, done: boolean): Promise<CityWalk> {
      return this.request(`/walks/${id}/stops/${order}`, CityWalkSchema, { method: "PATCH", body: { done } });
    }

    deleteCityWalk(id: string): Promise<void> {
      return this.requestVoid(`/walks/${id}`, { method: "DELETE" });
    }
  };
}
