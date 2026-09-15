// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for MAX authentication (initData in, authenticated User out).
// SCOPE: AuthRequest (raw MAX initData string) and AuthResponse (authenticated user).
// DEPENDS: zod, ./user.js
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - AuthRequestSchema - login payload carrying the raw MAX initData string
// - AuthRequest - login payload type
// - AuthResponseSchema - authenticated session response (reuses UserSchema from F3)
// - AuthResponse - authenticated session response type
// END_MODULE_MAP

import { z } from "zod";
import { UserSchema } from "./user.js";

export const AuthRequestSchema = z.object({
  initData: z.string().min(1),
});
export type AuthRequest = z.infer<typeof AuthRequestSchema>;

export const AuthResponseSchema = z.object({
  user: UserSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
