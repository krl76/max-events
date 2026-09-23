// START_MODULE_CONTRACT
// PURPOSE: Discovery endpoints of the api client: the today digest, the «Куда пойдём?» wizard, the nearby timeline with its free-window leisure chains and the NL assistant.
// SCOPE: GET /today, GET /whereto, GET /nearby[/free], POST /assist[/day].
// DEPENDS: ./transport.js, @max-events/api-contracts
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - LeisureQuery - free-window leisure payload (hours 1..8, mood, coordinates)
// - withDiscover - ApiClient.getToday / getWhereto / getNearbyTimeline / getLeisureOptions / assistQuery / assistDay
// END_MODULE_MAP

import { AssistDayResponseSchema, AssistResponseSchema, LeisureOptionSchema, NearbyTimelineSchema, TodayResponseSchema, WheretoResponseSchema } from "@max-events/api-contracts";
import type { AssistDayResponse, AssistResponse, LeisureMood, LeisureOption, NearbyTimeline, TodayResponse, WheretoQuery, WheretoResponse } from "@max-events/api-contracts";
import type { ApiMixin } from "./transport";

/** Free-window leisure query: hours 1..8 plus the mood. */
export interface LeisureQuery {
  hours: number;
  mood: LeisureMood;
  latitude: number;
  longitude: number;
}

export function withDiscover<TBase extends ApiMixin>(Base: TBase) {
  return class DiscoverEndpoints extends Base {
    getToday(origin: { latitude: number; longitude: number } | null = null): Promise<TodayResponse> {
      const query = origin === null ? "" : `?${new URLSearchParams({ lat: String(origin.latitude), lng: String(origin.longitude) }).toString()}`;
      return this.request(`/today${query}`, TodayResponseSchema);
    }

    getWhereto(query: WheretoQuery): Promise<WheretoResponse> {
      const params = new URLSearchParams({ company: query.company, mood: query.mood, budget: query.budget });
      return this.request(`/whereto?${params.toString()}`, WheretoResponseSchema);
    }

    getNearbyTimeline(latitude: number, longitude: number): Promise<NearbyTimeline> {
      const query = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude) });
      return this.request(`/nearby?${query.toString()}`, NearbyTimelineSchema);
    }

    getLeisureOptions(query: LeisureQuery): Promise<LeisureOption[]> {
      const params = new URLSearchParams({ hours: String(query.hours), mood: query.mood, latitude: String(query.latitude), longitude: String(query.longitude) });
      return this.request(`/nearby/free?${params.toString()}`, LeisureOptionSchema.array());
    }

    assistQuery(query: string): Promise<AssistResponse> {
      return this.request("/assist", AssistResponseSchema, { body: { query } });
    }

    assistDay(query: string, save?: boolean): Promise<AssistDayResponse> {
      return this.request("/assist/day", AssistDayResponseSchema, { body: { query, ...(save === undefined ? {} : { save }) } });
    }
  };
}
