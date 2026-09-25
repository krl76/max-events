// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for User (MAX messenger identity) and Profile (city, interests, smart-alert prefs).
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
// - DEFAULT_SMART_ALERTS - all types on, quiet hours off, window 23:00–09:00
// - PrivacySettingsSchema - visit history and route visibility
// - PrivacySettings - privacy type
// - DEFAULT_PRIVACY - visible to friends
// - ProfileSchema - user profile with default city, interests, alerts, privacy and recommendations
// - Profile - profile type
// - UpdateProfileSchema - profile edit payload (nested partial smartAlerts/privacy)
// - UpdateProfile - profile edit type
// END_MODULE_MAP

import { z } from "zod";
import { IdSchema, TimestampSchema } from "./primitives.js";

export const UserSchema = z.object({
  id: IdSchema,
  maxUserId: z.string().min(1).max(64),
  firstName: z.string().min(1).max(100),
  lastName: z.string().max(100).nullable().default(null),
  username: z.string().max(64).nullable().default(null),
  avatarUrl: z.string().url().nullable().default(null),
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
});
export type Profile = z.infer<typeof ProfileSchema>;

export const UpdateProfileSchema = z.object({
  city: z.string().min(1).optional(),
  interests: z.array(z.string().min(1)).optional(),
  smartAlerts: SmartAlertSettingsSchema.partial().optional(),
  privacy: PrivacySettingsSchema.partial().optional(),
  recommendationsEnabled: z.boolean().optional(),
});
export type UpdateProfile = z.infer<typeof UpdateProfileSchema>;
