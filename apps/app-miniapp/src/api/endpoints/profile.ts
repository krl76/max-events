// START_MODULE_CONTRACT
// PURPOSE: Profile endpoints of the api client: the viewer's own profile, their visit history, achievements, my-city, taste graph, the profile counters and the app settings of экран 41.
// SCOPE: GET/PATCH /profile, GET /users/:id/visit-stats|achievements|my-city|counters|visited-places, GET/PATCH /users/:id/app-settings, GET /taste[/after-me]; the MyCityPayload, ProfileCounters, VisitedPlace and AppSettings aggregates live here.
// DEPENDS: ./transport.js, @max-events/api-contracts
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - MyCityPayload - my-city screen aggregate: summary counters + memory points
// - ProfileCounters - the three counters of экран 36 (events / places / companies); companiesCount is nullable because no service counts companies yet (#496)
// - VisitedPlace - one cell of the impressions grid: the place, its title and how many times the viewer was there
// - AppSettings - the экран 41 preferences the Profile contract has no field for (search radius, quiet hours, map and company visibility, waitlist alerts, organizer mode, mini-app permissions)
// - UpdateAppSettings - partial AppSettings patch
// - withProfile - ApiClient.getProfile / updateProfile / getVisitStats / getAchievements / getMyCity / getTaste / getAfterMe / getProfileCounters / listVisitedPlaces / getAppSettings / updateAppSettings
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

/**
 * The three counters of экран 36. Events and places restate the visit history; «компании» has no
 * counter in any service yet (#496), so it is nullable — a missing count prints nothing rather than
 * a zero that would read as an answer. Mock-backed behind the signature the endpoint will take.
 */
export interface ProfileCounters {
  userId: string;
  eventsCount: number;
  placesCount: number;
  companiesCount: number | null;
}

/** One cell of the impressions grid: where the viewer was and how many times (макет, экран 36: «Парк Горького · 12 визитов»). */
export interface VisitedPlace {
  placeId: string;
  title: string;
  visits: number;
}

/**
 * The экран 41 preferences the Profile contract has no field for. Everything the contract does carry
 * (city, interests, smartAlerts, privacy, recommendationsEnabled) stays on the profile and is written
 * with updateProfile; this aggregate is the rest, mock-backed behind the signature the endpoint will take.
 */
export interface AppSettings {
  userId: string;
  searchRadiusKm: number;
  showOnMap: boolean;
  lookingForCompany: boolean;
  seatFreed: boolean;
  quietHours: boolean;
  quietHoursFrom: string;
  quietHoursTo: string;
  organizerMode: boolean;
  geoAccess: boolean;
  contactsAccess: boolean;
}

export type UpdateAppSettings = Partial<Omit<AppSettings, "userId">>;

const ProfileCountersSchema: ZodSchema<ProfileCounters> = {
  safeParse(data: unknown) {
    if (typeof data !== "object" || data === null) return { success: false as const, error: "expected profile counters" };
    const raw = data as Record<string, unknown>;
    if (typeof raw.userId !== "string" || typeof raw.eventsCount !== "number" || typeof raw.placesCount !== "number") return { success: false as const, error: "invalid profile counters" };
    if (raw.companiesCount !== null && raw.companiesCount !== undefined && typeof raw.companiesCount !== "number") return { success: false as const, error: "invalid profile counters" };
    return { success: true as const, data: { userId: raw.userId, eventsCount: raw.eventsCount, placesCount: raw.placesCount, companiesCount: typeof raw.companiesCount === "number" ? raw.companiesCount : null } };
  },
};

const VisitedPlaceListSchema: ZodSchema<VisitedPlace[]> = {
  safeParse(data: unknown) {
    if (!Array.isArray(data)) return { success: false as const, error: "expected visited places" };
    const places: VisitedPlace[] = [];
    for (const item of data) {
      if (typeof item !== "object" || item === null) return { success: false as const, error: "invalid visited place" };
      const raw = item as Record<string, unknown>;
      if (typeof raw.placeId !== "string" || typeof raw.title !== "string" || typeof raw.visits !== "number") return { success: false as const, error: "invalid visited place" };
      places.push({ placeId: raw.placeId, title: raw.title, visits: raw.visits });
    }
    return { success: true as const, data: places };
  },
};

const AppSettingsSchema: ZodSchema<AppSettings> = {
  safeParse(data: unknown) {
    if (typeof data !== "object" || data === null) return { success: false as const, error: "expected app settings" };
    const raw = data as Record<string, unknown>;
    const booleans = ["showOnMap", "lookingForCompany", "seatFreed", "quietHours", "organizerMode", "geoAccess", "contactsAccess"] as const;
    if (typeof raw.userId !== "string" || typeof raw.searchRadiusKm !== "number" || typeof raw.quietHoursFrom !== "string" || typeof raw.quietHoursTo !== "string") return { success: false as const, error: "invalid app settings" };
    if (booleans.some((key) => typeof raw[key] !== "boolean")) return { success: false as const, error: "invalid app settings" };
    return {
      success: true as const,
      data: {
        userId: raw.userId,
        searchRadiusKm: raw.searchRadiusKm,
        showOnMap: raw.showOnMap as boolean,
        lookingForCompany: raw.lookingForCompany as boolean,
        seatFreed: raw.seatFreed as boolean,
        quietHours: raw.quietHours as boolean,
        quietHoursFrom: raw.quietHoursFrom,
        quietHoursTo: raw.quietHoursTo,
        organizerMode: raw.organizerMode as boolean,
        geoAccess: raw.geoAccess as boolean,
        contactsAccess: raw.contactsAccess as boolean,
      },
    };
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

    getProfileCounters(userId: string): Promise<ProfileCounters> {
      return this.request(`/users/${userId}/counters`, ProfileCountersSchema);
    }

    listVisitedPlaces(userId: string): Promise<VisitedPlace[]> {
      return this.request(`/users/${userId}/visited-places`, VisitedPlaceListSchema);
    }

    getAppSettings(userId: string): Promise<AppSettings> {
      return this.request(`/users/${userId}/app-settings`, AppSettingsSchema);
    }

    updateAppSettings(userId: string, patch: UpdateAppSettings): Promise<AppSettings> {
      return this.request(`/users/${userId}/app-settings`, AppSettingsSchema, { method: "PATCH", body: patch });
    }
  };
}
