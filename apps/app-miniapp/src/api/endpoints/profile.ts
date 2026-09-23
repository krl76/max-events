// START_MODULE_CONTRACT
// PURPOSE: Profile endpoints of the api client: the viewer's own profile, their visit history, achievements, my-city and taste graph.
// SCOPE: GET/PATCH /profile, GET /users/:id/visit-stats|achievements|my-city, GET /taste[/after-me]; the MyCityPayload aggregate lives here.
// DEPENDS: ./transport.js, @max-events/api-contracts
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - MyCityPayload - my-city screen aggregate: summary counters + memory points
// - withProfile - ApiClient.getProfile / updateProfile / getVisitStats / getAchievements / getMyCity / getTaste / getAfterMe
// END_MODULE_MAP

import { AchievementSchema, AfterMeResponseSchema, MemoryPointSchema, MyCitySummarySchema, ProfileSchema, TasteProfileSchema, VisitStatsSchema } from "@max-events/api-contracts";
import type { Achievement, AfterMeResponse, MemoryPoint, MyCitySummary, Profile, TasteProfile, UpdateProfile, VisitStats } from "@max-events/api-contracts";
import type { ApiMixin, ZodSchema } from "./transport";

/** My-city screen aggregate: summary counters and the personal memory points. */
export interface MyCityPayload {
  summary: MyCitySummary;
  points: MemoryPoint[];
}

const MyCityPayloadSchema: ZodSchema<MyCityPayload> = {
  safeParse(data: unknown) {
    if (typeof data !== "object" || data === null) return { success: false as const, error: "expected a my-city payload" };
    const raw = data as Record<string, unknown>;
    const summary = MyCitySummarySchema.safeParse(raw.summary);
    if (!summary.success || !Array.isArray(raw.points)) return { success: false as const, error: "invalid my-city payload" };
    const points: MemoryPoint[] = [];
    for (const item of raw.points) {
      const parsed = MemoryPointSchema.safeParse(item);
      if (!parsed.success) return { success: false as const, error: parsed.error };
      points.push(parsed.data);
    }
    return { success: true as const, data: { summary: summary.data, points } };
  },
};

export function withProfile<TBase extends ApiMixin>(Base: TBase) {
  return class ProfileEndpoints extends Base {
    getProfile(): Promise<Profile> {
      return this.request("/profile", ProfileSchema);
    }

    updateProfile(payload: UpdateProfile): Promise<Profile> {
      return this.request("/profile", ProfileSchema, { method: "PATCH", body: payload });
    }

    getVisitStats(userId: string): Promise<VisitStats> {
      return this.request(`/users/${userId}/visit-stats`, VisitStatsSchema);
    }

    getAchievements(userId: string): Promise<Achievement[]> {
      return this.request(`/users/${userId}/achievements`, AchievementSchema.array());
    }

    getMyCity(userId: string): Promise<MyCityPayload> {
      return this.request(`/users/${userId}/my-city`, MyCityPayloadSchema);
    }

    getTaste(): Promise<TasteProfile> {
      return this.request("/taste", TasteProfileSchema);
    }

    getAfterMe(): Promise<AfterMeResponse> {
      return this.request("/taste/after-me", AfterMeResponseSchema);
    }
  };
}
