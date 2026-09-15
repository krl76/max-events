// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for User (MAX messenger identity) and Profile (city, interests).
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
// - ProfileSchema - user profile with default city and interests
// - Profile - profile type
// - UpdateProfileSchema - profile edit payload
// - UpdateProfile - profile edit type
// END_MODULE_MAP

import { z } from "zod";
import { IdSchema, TimestampSchema } from "./primitives.js";

export const UserSchema = z.object({
  id: IdSchema,
  maxUserId: z.string().min(1).max(64),
  firstName: z.string().min(1).max(100),
  lastName: z.string().max(100).nullable().default(null),
  avatarUrl: z.string().url().nullable().default(null),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type User = z.infer<typeof UserSchema>;

export const CreateUserSchema = UserSchema.omit({ id: true, createdAt: true, updatedAt: true });
export type CreateUser = z.infer<typeof CreateUserSchema>;

export const ProfileSchema = z.object({
  userId: IdSchema,
  city: z.string().min(1),
  interests: z.array(z.string().min(1)).default([]),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const UpdateProfileSchema = ProfileSchema.omit({ userId: true }).partial();
export type UpdateProfile = z.infer<typeof UpdateProfileSchema>;
