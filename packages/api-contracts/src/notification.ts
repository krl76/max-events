// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for the in-app notifications inbox (экран 06/07): type, read state, linked action, quiet-hours-aware urgency.
// SCOPE: notification type/target enums, AppNotification entity, summary, answer write. Smart-alert toggles and quiet hours live on Profile.smartAlerts.
// DEPENDS: zod, ./primitives.js, ./friends.js
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - NOTIFICATION_TYPES / NotificationTypeSchema / NotificationType
// - NOTIFICATION_TARGETS / NotificationTargetSchema / NotificationTarget
// - NotificationLinkSchema / NotificationLink
// - NotificationActionToneSchema / NotificationActionTone
// - NotificationActionSchema / NotificationAction
// - AppNotificationSchema / AppNotification
// - NotificationsSummarySchema / NotificationsSummary
// - AnswerNotificationWriteSchema / AnswerNotificationWrite
// END_MODULE_MAP

import { z } from "zod";
import { FriendSchema } from "./friends.js";
import { IdSchema, TimestampSchema } from "./primitives.js";

export const NOTIFICATION_TYPES = ["leave-now", "weather", "friend-left", "list-digest", "seat-freed", "event-soon", "gathering-invite", "gathering-response", "vote", "plan-message", "friend-activity", "organizer-booking", "moderation", "achievement"] as const;
export const NotificationTypeSchema = z.enum(NOTIFICATION_TYPES);
export type NotificationType = z.infer<typeof NotificationTypeSchema>;

export const NOTIFICATION_TARGETS = ["event", "place", "plan", "map", "slot-booking", "slot-ticket", "bookings", "we-group", "vote", "gathering", "companions", "moderation", "organizer", "achievements"] as const;
export const NotificationTargetSchema = z.enum(NOTIFICATION_TARGETS);
export type NotificationTarget = z.infer<typeof NotificationTargetSchema>;

export const NotificationLinkSchema = z.object({
  target: NotificationTargetSchema,
  id: IdSchema.nullable(),
});
export type NotificationLink = z.infer<typeof NotificationLinkSchema>;

export const NotificationActionToneSchema = z.enum(["primary", "confirm", "secondary"]);
export type NotificationActionTone = z.infer<typeof NotificationActionToneSchema>;

export const NotificationActionSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(80),
  tone: NotificationActionToneSchema,
  link: NotificationLinkSchema.nullable(),
});
export type NotificationAction = z.infer<typeof NotificationActionSchema>;

export const AppNotificationSchema = z.object({
  id: IdSchema,
  type: NotificationTypeSchema,
  actor: FriendSchema.nullable().default(null),
  title: z.string().min(1).max(300),
  body: z.string().max(2000).default(""),
  quote: z.string().max(300).nullable().default(null),
  createdAt: TimestampSchema,
  readAt: TimestampSchema.nullable().default(null),
  link: NotificationLinkSchema.nullable().default(null),
  actions: z.array(NotificationActionSchema).default([]),
  deadlineAt: TimestampSchema.nullable().default(null),
  answeredActionId: z.string().max(80).nullable().default(null),
  urgent: z.boolean().default(false),
});
export type AppNotification = z.infer<typeof AppNotificationSchema>;

export const NotificationsSummarySchema = z.object({
  unreadCount: z.number().int().nonnegative(),
});
export type NotificationsSummary = z.infer<typeof NotificationsSummarySchema>;

export const AnswerNotificationWriteSchema = z.object({
  actionId: z.string().trim().min(1).max(80),
});
export type AnswerNotificationWrite = z.infer<typeof AnswerNotificationWriteSchema>;
