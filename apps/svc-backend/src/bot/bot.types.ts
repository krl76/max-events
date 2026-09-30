// START_MODULE_CONTRACT
// PURPOSE: Zod schemas and TS types for the inbound MAX Bot API surface — updates, messages, callbacks, and the outbound body/keyboard the bot sends.
// SCOPE: Parsing of webhook/long-poll update envelopes (bot_started, message_created, message_callback) into a normalized BotInbound; NewMessageBody / Button / attachment shapes used when sending; no HTTP, no storage.
// DEPENDS: zod
// LINKS: M-SVC-BACKEND, https://dev.max.ru/docs-api
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - MaxUser - { user_id, first_name, username } the bot sees on every update
// - BotInboundKind - "start" | "text" | "callback": the three things a person can send the bot
// - BotInbound - normalized update: kind, maxUserId, chatId, text/callbackPayload/callbackId/startPayload, userName
// - parseUpdates - validate a webhook body ({ updates: [...] } or a bare array) into BotInbound[]; malformed entries are dropped, never thrown
// - BotButton - one inline keyboard button (callback / message / open_app / link / request_contact / request_geo_location)
// - BotKeyboard - buttons grouped into rows (array of arrays), as MAX renders them
// - BotImageAttachment - { type: "image", payload: { url } } — an external image the bot paints
// - BotMessageBody - NewMessageBody subset the bot sends: text, optional attachments (image + inline_keyboard), optional format
// - botText - plain text body
// - botRich - body with text plus image and/or keyboard attachments, dropping empties
// - BotCommand - { name, description } for PATCH /me/commands
// - MAX_UPDATE_TYPES - the event types the bot subscribes to
// END_MODULE_MAP

import { z } from "zod";

/** A MAX user as the bot sees it. user_id is the same numeric id mini-app initData carries. */
export const MaxUserSchema = z.object({
  user_id: z.number().int(),
  first_name: z.string().nullish(),
  username: z.string().nullish(),
});
export type MaxUser = z.infer<typeof MaxUserSchema>;

/** MessageBody.text as delivered: a plain string for everything the bot sends and reads. */
const MessageBodySchema = z.object({
  text: z.string().nullish(),
});

/** recipient.chat_id — where a dialog message lives; null for group/channel rows we ignore. */
const RecipientSchema = z.object({
  chat_id: z.number().int().nullish(),
  chat_type: z.string().nullish(),
});

const MessageSchema = z.object({
  sender: MaxUserSchema.nullish(),
  recipient: RecipientSchema.nullish(),
  body: MessageBodySchema.nullish(),
});

/** callback.payload is the button data; callback_id identifies the press for POST /answers. */
const CallbackSchema = z.object({
  callback_id: z.string().nullish(),
  payload: z.string().nullish(),
  user: MaxUserSchema.nullish(),
});

/**
 * One update row. MAX discriminates on update_type; the bot only acts on three.
 * Everything else (edits, removals, chat membership) parses and is ignored.
 */
const UpdateSchema = z.object({
  update_type: z.string(),
  chat_id: z.number().int().nullish(),
  user: MaxUserSchema.nullish(),
  payload: z.string().nullish(),
  message: MessageSchema.nullish(),
  callback: CallbackSchema.nullish(),
});

/** The webhook body is `{ updates: [...] }` on delivery and a bare array in some long-poll shapes. */
const WebhookBodySchema = z.union([z.object({ updates: z.array(UpdateSchema) }), z.array(UpdateSchema)]);

export type BotInboundKind = "start" | "text" | "callback";

export type BotInbound = {
  kind: BotInboundKind;
  /** The numeric MAX user id; matches users.maxUserId. */
  maxUserId: string;
  userName: string | null;
  /** Dialog chat id when MAX gave one; used for the typing indicator. */
  chatId: number | null;
  /** recipient.chat_type: dialog | chat | channel. The bot answers dialogs only. */
  chatType: string | null;
  /** Raw text for kind "text"; empty for the others. */
  text: string;
  /** Button payload for kind "callback"; empty otherwise. */
  callbackPayload: string;
  /** Press identifier for kind "callback", echoed to POST /answers; empty otherwise. */
  callbackId: string;
  /** Deep-link payload carried by bot_started (?startapp= that launched the bot); empty otherwise. */
  startPayload: string;
};

function userIdOf(update: z.infer<typeof UpdateSchema>): string | null {
  const direct = update.user?.user_id;
  const fromMessage = update.message?.sender?.user_id;
  const fromCallback = update.callback?.user?.user_id;
  const id = direct ?? fromMessage ?? fromCallback;
  return typeof id === "number" ? String(id) : null;
}

function nameOf(update: z.infer<typeof UpdateSchema>): string | null {
  const user = update.user ?? update.message?.sender ?? update.callback?.user;
  const name = user?.first_name;
  return typeof name === "string" && name.trim() !== "" ? name.trim() : null;
}

function chatIdOf(update: z.infer<typeof UpdateSchema>): number | null {
  const direct = update.chat_id;
  const fromMessage = update.message?.recipient?.chat_id;
  const id = typeof direct === "number" ? direct : fromMessage;
  return typeof id === "number" ? id : null;
}

function chatTypeOf(update: z.infer<typeof UpdateSchema>): string | null {
  const type = update.message?.recipient?.chat_type;
  return typeof type === "string" ? type : null;
}

function toInbound(update: z.infer<typeof UpdateSchema>): BotInbound | null {
  const maxUserId = userIdOf(update);
  if (maxUserId === null) return null;
  const base = { maxUserId, userName: nameOf(update), chatId: chatIdOf(update), chatType: chatTypeOf(update), text: "", callbackPayload: "", callbackId: "", startPayload: "" };
  if (update.update_type === "bot_started") {
    const payload = typeof update.payload === "string" ? update.payload : "";
    return { ...base, kind: "start", startPayload: payload };
  }
  if (update.update_type === "message_created") {
    const text = update.message?.body?.text;
    return { ...base, kind: "text", text: typeof text === "string" ? text : "" };
  }
  if (update.update_type === "message_callback") {
    const payload = typeof update.callback?.payload === "string" ? update.callback.payload : "";
    const callbackId = typeof update.callback?.callback_id === "string" ? update.callback.callback_id : "";
    return { ...base, kind: "callback", callbackPayload: payload, callbackId };
  }
  return null;
}

/**
 * Validate a delivery into the inbound rows the bot acts on. A bad envelope yields nothing rather
 * than throwing: MAX counts a non-200 as a failed delivery and retries for hours, so the controller
 * always answers 200 and the parser only ever drops what it cannot use.
 */
export function parseUpdates(body: unknown): BotInbound[] {
  const parsed = WebhookBodySchema.safeParse(body);
  if (!parsed.success) return [];
  const rows = Array.isArray(parsed.data) ? parsed.data : parsed.data.updates;
  const inbound: BotInbound[] = [];
  for (const row of rows) {
    const normalized = toInbound(row);
    if (normalized) inbound.push(normalized);
  }
  return inbound;
}

/** Inline keyboard button. `type` selects which of the other fields MAX reads. */
export type BotButton = { type: "callback"; text: string; payload: string } | { type: "message"; text: string } | { type: "open_app"; text: string; web_app: string; payload?: string } | { type: "link"; text: string; url: string } | { type: "request_contact"; text: string } | { type: "request_geo_location"; text: string };

/** Buttons grouped into rows; MAX renders one row per inner array. */
export type BotKeyboard = BotButton[][];

export type BotImageAttachment = { type: "image"; payload: { url: string } };

export type BotInlineKeyboardAttachment = { type: "inline_keyboard"; payload: { buttons: BotKeyboard } };

export type BotAttachment = BotImageAttachment | BotInlineKeyboardAttachment;

/** The NewMessageBody subset the bot sends. `format: "markdown"` lets MAX render **bold** in text. */
export type BotMessageBody = {
  text: string;
  attachments?: BotAttachment[];
  format?: "markdown";
};

export function botText(text: string): BotMessageBody {
  return { text };
}

/**
 * Build a send body from text plus images and a keyboard, dropping empties so MAX never gets a
 * zero-row keyboard or a blank image attachment (both of which it rejects). Up to 12 images: MAX's
 * documented cap; the keyboard is a separate attachment after them.
 */
export function botRich(text: string, options: { image?: string | null; images?: Array<string | null | undefined>; keyboard?: BotKeyboard | null; markdown?: boolean } = {}): BotMessageBody {
  const attachments: BotAttachment[] = [];
  const seen = new Set<string>();
  for (const raw of [...(options.images ?? []), options.image]) {
    const url = raw?.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    attachments.push({ type: "image", payload: { url } });
    if (attachments.length >= 12) break;
  }
  const keyboard = options.keyboard?.filter((row) => row.length > 0) ?? [];
  if (keyboard.length > 0) attachments.push({ type: "inline_keyboard", payload: { buttons: keyboard } });
  return { text, ...(attachments.length > 0 ? { attachments } : {}), ...(options.markdown ? { format: "markdown" as const } : {}) };
}

export type BotCommand = { name: string; description: string };

/** The events the bot subscribes to: a first hello, every typed message, and every button press. */
export const MAX_UPDATE_TYPES = ["bot_started", "message_created", "message_callback"] as const;
