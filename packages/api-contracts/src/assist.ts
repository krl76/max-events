// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for NL event assist and the MAX AI chat payload (not a stored chat).
// SCOPE: query write, parsed criteria, picks with explanations, response summary, Saturday day draft with typed plan card, chat write and chat response.
// DEPENDS: zod, ./event.js, ./plan.js
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - AssistWhenSchema - morning/afternoon/evening/any
// - AssistWhen - when type
// - AssistCompanySchema - company context
// - AssistCompany - company type
// - AssistGenreSchema - coarse genre
// - AssistGenre - genre type
// - AssistCriteriaSchema - structured NL parse
// - AssistCriteria - criteria type
// - AssistQueryWriteSchema - raw NL query
// - AssistQueryWrite - query write type
// - AssistChatRoleSchema - user or assistant turn
// - AssistChatTurnSchema - one transcript turn
// - AssistChatWriteSchema - chat message, transcript, and offered ids
// - AssistChatWrite - chat write type
// - AssistPickSchema - event plus explanation
// - AssistPick - pick type
// - AssistResponseSchema - summary, criteria, picks
// - AssistResponse - response type
// - AssistDayStopSchema - timed event on a generated day
// - AssistDayStop - day stop type
// - AssistDayResponseSchema - Saturday draft with typed PlanCard payload
// - AssistDayResponse - day response type
// - AssistGuideIdSchema - screens MAX may suggest
// - AssistGuideId - guide id
// - AssistChatResponseSchema - reply, picks, opened card, day, guides, or silence
// - AssistChatResponse - chat response type
// END_MODULE_MAP

import { z } from "zod";
import { EventSchema } from "./event.js";
import { PlanCardSchema } from "./plan.js";

export const AssistWhenSchema = z.enum(["morning", "afternoon", "evening", "any"]);
export type AssistWhen = z.infer<typeof AssistWhenSchema>;

export const AssistCompanySchema = z.enum(["alone", "friends", "partner", "kids"]);
export type AssistCompany = z.infer<typeof AssistCompanySchema>;

export const AssistGenreSchema = z.enum(["music", "sport", "outdoors", "any"]);
export type AssistGenre = z.infer<typeof AssistGenreSchema>;

export const AssistCriteriaSchema = z.object({
  when: AssistWhenSchema,
  budgetMaxRub: z.number().int().nonnegative().nullable(),
  company: AssistCompanySchema,
  genre: AssistGenreSchema,
});
export type AssistCriteria = z.infer<typeof AssistCriteriaSchema>;

export const AssistQueryWriteSchema = z.object({
  query: z.string().trim().min(1).max(500),
  save: z.boolean().optional(),
});
export type AssistQueryWrite = z.infer<typeof AssistQueryWriteSchema>;

export const AssistChatRoleSchema = z.enum(["user", "assistant"]);

export const AssistChatTurnSchema = z.object({
  role: AssistChatRoleSchema,
  text: z.string().trim().min(1).max(400),
});

export const AssistChatWriteSchema = z.object({
  message: z.string().trim().min(1).max(500),
  transcript: z.array(AssistChatTurnSchema).max(8).default([]),
  offeredEventIds: z.array(z.string().uuid()).max(4).default([]),
  save: z.boolean().optional(),
});
export type AssistChatWrite = z.infer<typeof AssistChatWriteSchema>;

export const AssistPickSchema = z.object({
  event: EventSchema,
  explanation: z.string().min(1).max(300),
});
export type AssistPick = z.infer<typeof AssistPickSchema>;

export const AssistResponseSchema = z.object({
  summary: z.string().min(1).max(400),
  criteria: AssistCriteriaSchema,
  items: z.array(AssistPickSchema).max(7),
});
export type AssistResponse = z.infer<typeof AssistResponseSchema>;

export const AssistDayStopSchema = z.object({
  at: z.string().min(1),
  event: EventSchema,
  explanation: z.string().min(1).max(300),
});
export type AssistDayStop = z.infer<typeof AssistDayStopSchema>;

export const AssistDayResponseSchema = z.object({
  summary: z.string().min(1).max(400),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  stops: z.array(AssistDayStopSchema).min(1).max(4),
  planDraft: z.object({
    eventId: z.string().uuid(),
    participantIds: z.array(z.string().uuid()),
    meetingPoint: z.string().min(1).max(300),
    meetingAt: z.string().min(1),
  }),
  plan: PlanCardSchema.nullable().default(null),
});
export type AssistDayResponse = z.infer<typeof AssistDayResponseSchema>;

export const AssistGuideIdSchema = z.enum(["search", "map", "swipe", "plans", "calendar", "friends", "lists", "story", "post", "nearby", "day-route", "profile", "companies", "micro"]);
export type AssistGuideId = z.infer<typeof AssistGuideIdSchema>;

export const AssistChatResponseSchema = z
  .object({
    silence: z.boolean(),
    fallback: z.boolean(),
    reply: z.string().trim().min(1).max(400).optional(),
    items: z.array(AssistPickSchema).max(4).optional(),
    openEventId: z.string().uuid().optional(),
    day: AssistDayResponseSchema.optional(),
    guides: z.array(AssistGuideIdSchema).max(4).optional(),
  })
  .superRefine((value, context) => {
    if (value.silence) {
      if (value.fallback || value.reply || value.items?.length || value.openEventId || value.day || value.guides?.length) {
        context.addIssue({ code: "custom", message: "silence carries no reply" });
      }
      return;
    }
    if (!value.reply) context.addIssue({ code: "custom", message: "reply required" });
    if (value.day && value.items?.length) context.addIssue({ code: "custom", message: "a day has no picks" });
    if (value.openEventId && !value.items?.some((pick) => pick.event.id === value.openEventId)) {
      context.addIssue({ code: "custom", message: "openEventId must be one of the cards" });
    }
  });
export type AssistChatResponse = z.infer<typeof AssistChatResponseSchema>;
