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
// - SmartAlertSettingsSchema - per-type smart-alert toggles
// - SmartAlertSettings - smart-alert prefs type
// - DEFAULT_SMART_ALERTS - all types on
// - PrivacySettingsSchema - visit history and route visibility
// - PrivacySettings - privacy type
// - DEFAULT_PRIVACY - visible to friends
// - PROFILE_BIO_MAX - Instagram-like bio length
// - ProfileMediaUrlSchema - avatar/cover: image data URL until #477, or https
// - ProfileSchema - user profile with city, interests, alerts, privacy, recommendations, bio and cover
// - Profile - profile type
// - UpdateProfileSchema - profile edit payload (nested partial smartAlerts/privacy, optional bio/cover/avatar)
// - UpdateProfile - profile edit type
// END_MODULE_MAP

import { z } from "zod";
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

export const SmartAlertSettingsSchema = z.object({
  leaveNow: z.boolean(),
  weather: z.boolean(),
  friendLeft: z.boolean(),
  listDigest: z.boolean(),
});
export type SmartAlertSettings = z.infer<typeof SmartAlertSettingsSchema>;

export const DEFAULT_SMART_ALERTS: SmartAlertSettings = {
  leaveNow: true,
  weather: true,
  friendLeft: true,
  listDigest: true,
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
