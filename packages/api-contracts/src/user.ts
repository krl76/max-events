// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for User (MAX messenger identity) and Profile (city, interests, bio, cover, smart-alert prefs).
// SCOPE: User/CreateUser/Profile/UpdateProfile schemas and inferred types.
// DEPENDS: zod, ./primitives.js
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - UserSchema - MAX-identified user entity
// - User - full user type
// - CreateUserSchema - user creation payload (server-side from validated initData)
// - CreateUser - user creation payload type
// - SmartAlertSettingsSchema - per-type smart-alert toggles plus quiet hours
// - SmartAlertSettings - smart-alert prefs type
// - QuietHoursTimeSchema - HH:MM window edge
// - QuietHoursTime - quiet-hours edge type
// - DEFAULT_SMART_ALERTS - all types on, quiet hours off, window 23:00–09:00
// - PrivacySettingsSchema - visit history and route visibility
// - PrivacySettings - privacy type
// - DEFAULT_PRIVACY - visible to friends
// - PROFILE_BIO_MAX - Instagram-like bio length
// - PROFILE_MEDIA_URL_MAX - longest avatar/cover reference a profile may carry
// - ProfileMediaUrlSchema - avatar/cover: image data URL until #477, or https
// - ProfileSchema - user profile with city, interests, alerts, privacy, recommendations, bio and cover
// - Profile - profile type
// - UpdateProfileSchema - profile edit payload (nested partial smartAlerts/privacy, optional bio/cover/avatar)
// - UpdateProfile - profile edit type
// - ProfileCountersSchema - events, places and companies behind the profile numbers (#543)
// - ProfileCounters - profile counters type
// - VisitedPlaceSchema - a place the user keeps returning to, with the number of visits
// - VisitedPlace - visited place type
// - ProfilePostSchema - one post of the profile grid
// - ProfilePost - profile post type
// - AppSettingsSchema - the settings screen: radius, visibility, alerts, quiet hours and access switches
// - AppSettings - app settings type
// - DEFAULT_APP_SETTINGS - what the settings are before anyone touches them
// - UpdateAppSettingsSchema - partial PATCH without field defaults
// - UpdateAppSettings - settings update type
// END_MODULE_MAP

import { z } from "zod";
import { EventCategorySchema } from "./event.js";
import { IdSchema, TimestampSchema } from "./primitives.js";

/**
 * Avatar and cover travel as a JPEG data URL until object storage lands (#477), the same budget
 * the feed photo uses. A real https URL, once there is somewhere to upload to, also fits.
 */
export const PROFILE_MEDIA_URL_MAX = 16_000;
const PROFILE_MEDIA_URL_PATTERN = /^(data:image\/|https:\/\/)/;
export const ProfileMediaUrlSchema = z.string().max(PROFILE_MEDIA_URL_MAX).regex(PROFILE_MEDIA_URL_PATTERN, "media must be an image data URL or an https URL");

export const PROFILE_BIO_MAX = 150;

export const UserSchema = z.object({
  id: IdSchema,
  maxUserId: z.string().min(1).max(64),
  firstName: z.string().min(1).max(100),
  lastName: z.string().max(100).nullable().default(null),
  username: z.string().max(64).nullable().default(null),
  avatarUrl: ProfileMediaUrlSchema.nullable().default(null),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type User = z.infer<typeof UserSchema>;

export const CreateUserSchema = UserSchema.omit({ id: true, createdAt: true, updatedAt: true });
export type CreateUser = z.infer<typeof CreateUserSchema>;

export const QuietHoursTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export type QuietHoursTime = z.infer<typeof QuietHoursTimeSchema>;

export const SmartAlertSettingsSchema = z.object({
  leaveNow: z.boolean(),
  weather: z.boolean(),
  friendLeft: z.boolean(),
  listDigest: z.boolean(),
  quietHoursEnabled: z.boolean(),
  quietHoursFrom: QuietHoursTimeSchema,
  quietHoursTo: QuietHoursTimeSchema,
});
export type SmartAlertSettings = z.infer<typeof SmartAlertSettingsSchema>;

export const DEFAULT_SMART_ALERTS: SmartAlertSettings = {
  leaveNow: true,
  weather: true,
  friendLeft: true,
  listDigest: true,
  quietHoursEnabled: false,
  quietHoursFrom: "23:00",
  quietHoursTo: "09:00",
};

export const PrivacySettingsSchema = z.object({
  visitHistory: z.enum(["friends", "hidden"]),
  routes: z.enum(["friends", "hidden"]),
});
export type PrivacySettings = z.infer<typeof PrivacySettingsSchema>;

export const DEFAULT_PRIVACY: PrivacySettings = {
  visitHistory: "friends",
  routes: "friends",
};

export const ProfileSchema = z.object({
  userId: IdSchema,
  city: z.string().min(1),
  interests: z.array(z.string().min(1)).default([]),
  smartAlerts: SmartAlertSettingsSchema.default({ ...DEFAULT_SMART_ALERTS }),
  privacy: PrivacySettingsSchema.default({ ...DEFAULT_PRIVACY }),
  recommendationsEnabled: z.boolean().default(true),
  bio: z.string().max(PROFILE_BIO_MAX).default(""),
  coverUrl: ProfileMediaUrlSchema.nullable().default(null),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const UpdateProfileSchema = z.object({
  city: z.string().min(1).optional(),
  interests: z.array(z.string().min(1)).optional(),
  smartAlerts: SmartAlertSettingsSchema.partial().optional(),
  privacy: PrivacySettingsSchema.partial().optional(),
  recommendationsEnabled: z.boolean().optional(),
  bio: z.string().max(PROFILE_BIO_MAX).optional(),
  coverUrl: ProfileMediaUrlSchema.nullable().optional(),
  avatarUrl: ProfileMediaUrlSchema.nullable().optional(),
});
export type UpdateProfile = z.infer<typeof UpdateProfileSchema>;

export const ProfileCountersSchema = z.object({
  userId: IdSchema,
  eventsCount: z.number().int().min(0),
  placesCount: z.number().int().min(0),
  companiesCount: z.number().int().min(0).nullable(),
});
export type ProfileCounters = z.infer<typeof ProfileCountersSchema>;

export const VisitedPlaceSchema = z.object({
  placeId: IdSchema,
  title: z.string().min(1),
  visits: z.number().int().min(1),
});
export type VisitedPlace = z.infer<typeof VisitedPlaceSchema>;

export const ProfilePostSchema = z.object({
  postId: IdSchema,
  eventId: IdSchema.nullable(),
  eventTitle: z.string().min(1),
  category: EventCategorySchema,
  photoUrl: z.string().nullable(),
  likesCount: z.number().int().min(0),
  commentsCount: z.number().int().min(0),
});
export type ProfilePost = z.infer<typeof ProfilePostSchema>;

export const AppSettingsSchema = z.object({
  userId: IdSchema,
  searchRadiusKm: z.number().positive().max(100),
  showOnMap: z.boolean(),
  lookingForCompany: z.boolean(),
  seatFreed: z.boolean(),
  quietHours: z.boolean(),
  quietHoursFrom: QuietHoursTimeSchema,
  quietHoursTo: QuietHoursTimeSchema,
  organizerMode: z.boolean(),
  geoAccess: z.boolean(),
  contactsAccess: z.boolean(),
});
export type AppSettings = z.infer<typeof AppSettingsSchema>;

export const DEFAULT_APP_SETTINGS: Omit<AppSettings, "userId"> = {
  searchRadiusKm: 5,
  showOnMap: true,
  lookingForCompany: false,
  seatFreed: true,
  quietHours: false,
  quietHoursFrom: "23:00",
  quietHoursTo: "09:00",
  organizerMode: false,
  geoAccess: true,
  contactsAccess: true,
};

/** Partial PATCH: no field defaults, so omitted keys stay omitted (zod 4). */
export const UpdateAppSettingsSchema = z.object({
  searchRadiusKm: z.number().positive().max(100).optional(),
  showOnMap: z.boolean().optional(),
  lookingForCompany: z.boolean().optional(),
  seatFreed: z.boolean().optional(),
  quietHours: z.boolean().optional(),
  quietHoursFrom: QuietHoursTimeSchema.optional(),
  quietHoursTo: QuietHoursTimeSchema.optional(),
  organizerMode: z.boolean().optional(),
  geoAccess: z.boolean().optional(),
  contactsAccess: z.boolean().optional(),
});
export type UpdateAppSettings = z.infer<typeof UpdateAppSettingsSchema>;
