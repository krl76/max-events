// START_MODULE_CONTRACT
// PURPOSE: Zod contract for the Organization account (separate organizer identity, login/password auth) and the organizer setup state of экран 44.
// SCOPE: Organization read shape; OrganizerSetup GET/PATCH/complete payloads. Organizer login/session contracts live in ./auth.js.
// DEPENDS: zod, ./primitives.js
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ORGANIZER_ACTIVITIES - «чем занимаетесь» values (not PlaceCategory)
// - OrganizerActivitySchema / OrganizerActivity
// - ORGANIZER_SETUP_STEPS - rail of экран 44: venue → payouts → event
// - OrganizerSetupStepSchema / OrganizerSetupStep
// - ORGANIZER_PAYOUT_MODES - external payment link or none; in-app live charges do not exist
// - OrganizerPayoutModeSchema / OrganizerPayoutMode
// - OrganizationSchema - organization account (id, name, contacts, activities)
// - Organization - organization account type
// - OrganizerSetupVenueSchema / OrganizerSetupVenue
// - OrganizerSetupPayoutsSchema / OrganizerSetupPayouts
// - OrganizerSetupSchema / OrganizerSetup
// - UpdateOrganizerSetupSchema / UpdateOrganizerSetup
// END_MODULE_MAP

import { z } from "zod";
import { IdSchema, TimestampSchema } from "./primitives.js";

export const ORGANIZER_ACTIVITIES = ["events", "slots", "tours", "sport", "volunteering"] as const;
export const OrganizerActivitySchema = z.enum(ORGANIZER_ACTIVITIES);
export type OrganizerActivity = z.infer<typeof OrganizerActivitySchema>;

export const ORGANIZER_SETUP_STEPS = ["venue", "payouts", "event"] as const;
export const OrganizerSetupStepSchema = z.enum(ORGANIZER_SETUP_STEPS);
export type OrganizerSetupStep = z.infer<typeof OrganizerSetupStepSchema>;

/**
 * How the venue takes money. There is no «through Afisha» mode: PAYMENT_PROVIDER is
 * sandbox|none (live is rejected), so in-app charges never run in production. Paid events
 * use Event.paymentUrl. Bank requisites are not a field of this product.
 */
export const ORGANIZER_PAYOUT_MODES = ["external", "none"] as const;
export const OrganizerPayoutModeSchema = z.enum(ORGANIZER_PAYOUT_MODES);
export type OrganizerPayoutMode = z.infer<typeof OrganizerPayoutModeSchema>;

export const OrganizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  contacts: z.string().nullable(),
  activities: z.array(OrganizerActivitySchema).default([]),
});
export type Organization = z.infer<typeof OrganizationSchema>;

export const OrganizerSetupVenueSchema = z.object({
  placeId: IdSchema.nullable(),
  title: z.string().max(200),
  address: z.string().max(300),
  city: z.string().max(200),
});
export type OrganizerSetupVenue = z.infer<typeof OrganizerSetupVenueSchema>;

export const OrganizerSetupPayoutsSchema = z.object({
  mode: OrganizerPayoutModeSchema,
  paymentUrl: z.string().url().nullable(),
  contacts: z.string().max(300).nullable(),
});
export type OrganizerSetupPayouts = z.infer<typeof OrganizerSetupPayoutsSchema>;

export const OrganizerSetupSchema = z.object({
  organizationId: IdSchema,
  step: OrganizerSetupStepSchema,
  completedAt: TimestampSchema.nullable(),
  venue: OrganizerSetupVenueSchema,
  activities: z.array(OrganizerActivitySchema),
  payouts: OrganizerSetupPayoutsSchema,
});
export type OrganizerSetup = z.infer<typeof OrganizerSetupSchema>;

export const UpdateOrganizerSetupSchema = z.object({
  step: OrganizerSetupStepSchema.optional(),
  venue: OrganizerSetupVenueSchema.partial().optional(),
  activities: z.array(OrganizerActivitySchema).optional(),
  payouts: OrganizerSetupPayoutsSchema.partial().optional(),
});
export type UpdateOrganizerSetup = z.infer<typeof UpdateOrganizerSetupSchema>;
