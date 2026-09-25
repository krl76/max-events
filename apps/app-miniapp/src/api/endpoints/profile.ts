// START_MODULE_CONTRACT
// PURPOSE: Profile endpoints of the api client: the viewer's own profile, their visit history, achievements, my-city, taste graph, the profile counters and the app settings of экран 41.
// SCOPE: GET/PATCH /profile, GET /users/:id/visit-stats|achievements|my-city|counters|visited-places|posts, GET/PATCH /users/:id/app-settings, GET /taste[/after-me]; the MyCityPayload, ProfileCounters, VisitedPlace, ProfilePost and AppSettings aggregates live here.
// DEPENDS: ./transport.js, @max-events/api-contracts
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - MyCityPayload - my-city screen aggregate: summary counters + memory points
// - ProfileCounters - the three counters of экран 36 (events / places / companies); companiesCount is nullable because no service counts companies yet (#496)
// - VisitedPlace - one cell of the impressions grid: the place, its title and how many times the viewer was there
// - ProfilePost - one tile of the post grid: the post, the event it is about and the cover the tile is drawn with
// - AppSettings - the экран 41 preferences the Profile contract has no field for (search radius, quiet hours, map and company visibility, waitlist alerts, organizer mode, mini-app permissions)
// - UpdateAppSettings - partial AppSettings patch
// - withProfile - ApiClient.getProfile / updateProfile / getVisitStats / getAchievements / getMyCity / getTaste / getAfterMe / getProfileCounters / listVisitedPlaces / listUserPosts / getAppSettings / updateAppSettings
// END_MODULE_MAP

import { AchievementSchema, AfterMeResponseSchema, EventCategorySchema, MemoryPointSchema, MyCitySummarySchema, ProfileSchema, TasteProfileSchema, UserSchema, VisitStatsSchema } from "@max-events/api-contracts";
import type { Achievement, AfterMeResponse, EventCategory, MemoryPoint, MyCitySummary, Profile, TasteProfile, UpdateProfile, User, VisitStats } from "@max-events/api-contracts";
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
 * One tile of the post grid of экран 36. A wall post (FeedPost) carries the author, the text and the
 * comments; a tile needs none of those and does need what the post has no field for — the cover. There
 * are no photos of people in the product, so a tile without its own impression photo is drawn by
 * AppMedia from the category of the event the post is about, and the category has to travel with it.
 *
 * Nothing answers this today: GET /feed filters by eventId or placeId and by nothing else, so «посты
 * автора» has no query behind it on the backend. The shape and the path are the ones that endpoint
 * will take, mock-backed meanwhile — the same arrangement ProfileCounters above lives with.
 */
export interface ProfilePost {
  postId: string;
  eventId: string;
  /** Title of the event the post is about: the tile is too small for it, the accessible name is not. */
  eventTitle: string;
  /** What colours the tile without a photo: the category gradient AppMedia draws. */
  category: EventCategory;
  /** The author's own impression photo; null means the tile is the category cover. */
  photoUrl: string | null;
  likesCount: number;
  commentsCount: number;
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

const ProfilePostListSchema: ZodSchema<ProfilePost[]> = {
  safeParse(data: unknown) {
    if (!Array.isArray(data)) return { success: false as const, error: "expected profile posts" };
    const posts: ProfilePost[] = [];
    for (const item of data) {
      if (typeof item !== "object" || item === null) return { success: false as const, error: "invalid profile post" };
      const raw = item as Record<string, unknown>;
      const category = EventCategorySchema.safeParse(raw.category);
      if (!category.success) return { success: false as const, error: "invalid profile post category" };
      if (typeof raw.postId !== "string" || typeof raw.eventId !== "string" || typeof raw.eventTitle !== "string") return { success: false as const, error: "invalid profile post" };
      if (typeof raw.likesCount !== "number" || typeof raw.commentsCount !== "number") return { success: false as const, error: "invalid profile post counters" };
      if (raw.photoUrl !== null && typeof raw.photoUrl !== "string") return { success: false as const, error: "invalid profile post photo" };
      posts.push({ postId: raw.postId, eventId: raw.eventId, eventTitle: raw.eventTitle, category: category.data, photoUrl: raw.photoUrl, likesCount: raw.likesCount, commentsCount: raw.commentsCount });
    }
    return { success: true as const, data: posts };
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

    getUser(userId: string): Promise<User> {
      return this.request(`/users/${encodeURIComponent(userId)}`, UserSchema);
    }

    getUserProfile(userId: string): Promise<Profile> {
      return this.request(`/users/${encodeURIComponent(userId)}/profile`, ProfileSchema);
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

    /** The post grid of экран 36: what this person published, newest first. */
    listUserPosts(userId: string): Promise<ProfilePost[]> {
      return this.request(`/users/${userId}/posts`, ProfilePostListSchema);
    }

    getAppSettings(userId: string): Promise<AppSettings> {
      return this.request(`/users/${userId}/app-settings`, AppSettingsSchema);
    }

    updateAppSettings(userId: string, patch: UpdateAppSettings): Promise<AppSettings> {
      return this.request(`/users/${userId}/app-settings`, AppSettingsSchema, { method: "PATCH", body: patch });
    }
  };
}
