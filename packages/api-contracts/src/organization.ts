// START_MODULE_CONTRACT
// PURPOSE: Zod contract for the Organization account (separate organizer identity, login/password auth).
// SCOPE: Organization read shape only; organizer login/session contracts live in ./auth.js.
// DEPENDS: zod
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - OrganizationSchema - organization account (id, name, contacts)
// - Organization - organization account type
// END_MODULE_MAP

import { z } from "zod";

export const OrganizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  contacts: z.string().nullable(),
});
export type Organization = z.infer<typeof OrganizationSchema>;
