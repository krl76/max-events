// START_MODULE_CONTRACT
// PURPOSE: Encode and decode the compact callback payloads the bot puts on inline-keyboard buttons, so a press carries its whole context back without server-side session state.
// SCOPE: botPayload/parseBotPayload over a fixed command vocabulary (menu, today, whereto chain, plans, bookings, help, book confirm/yes, waitlist, open event). The whereto chain accumulates its answers in the payload itself: step names the next question ("company" asks the first, "mood" carries the company, "budget" carries both, "go" carries all three and triggers the search). startAppPayload builds the miniapp start_param for open_app buttons, which MAX constrains to ^[\w-]*$ — exactly the prefix-id shape the miniapp router already reads.
// DEPENDS: none
// LINKS: M-SVC-BACKEND, https://dev.max.ru/docs-api/use-cases/sending-messages/keyboard
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - BotCommandId - the vocabulary of callback commands
// - BotPayload - parsed command: id plus the context it carries (event id, whereto answers)
// - WheretoCompany / WheretoMood / WheretoBudget - answer vocabularies, matching WheretoQuerySchema values
// - WheretoStep - which question a whereto payload is asking next: company | mood | budget | go
// - botPayload - build a payload string from a BotPayload
// - parseBotPayload - read a payload string back, null when it is not one of ours
// - startAppPayload - the miniapp start_param for an open_app button (word chars and hyphens only)
// - WHERETO_COMPANIES / WHERETO_MOODS / WHERETO_BUDGETS - the closed answer lists
// END_MODULE_MAP

/** Callback commands the bot understands. Anything else parses to null and is ignored. */
export type BotCommandId = BotPayload["id"];

/** Answer vocabularies — the exact values WheretoQuerySchema accepts. */
export type WheretoCompany = "alone" | "friends" | "partner" | "kids";
export type WheretoMood = "active" | "calm" | "unusual";
export type WheretoBudget = "free" | "under_3000" | "any";

/** Which question a whereto payload asks next; "go" means every answer is in and the search runs. */
export type WheretoStep = "company" | "mood" | "budget" | "go";

export type BotPayload = { id: "menu" | "today" | "plans" | "bookings" | "help" } | { id: "whereto"; step: "company" } | { id: "whereto"; step: "mood"; company: WheretoCompany } | { id: "whereto"; step: "budget"; company: WheretoCompany; mood: WheretoMood } | { id: "whereto"; step: "go"; company: WheretoCompany; mood: WheretoMood; budget: WheretoBudget } | { id: "confirm-book" | "book" | "waitlist"; eventId: string };

export const WHERETO_COMPANIES: readonly WheretoCompany[] = ["alone", "friends", "partner", "kids"];
export const WHERETO_MOODS: readonly WheretoMood[] = ["active", "calm", "unusual"];
export const WHERETO_BUDGETS: readonly WheretoBudget[] = ["free", "under_3000", "any"];

/** MAX allows 1024 characters on a callback payload; the chain is at most ~50, so this only rejects a hand-crafted one. */
const PAYLOAD_MAX = 1024;

const SEP = ":";

export function botPayload(payload: BotPayload): string {
  switch (payload.id) {
    case "menu":
    case "today":
    case "plans":
    case "bookings":
    case "help":
      return payload.id;
    case "whereto":
      if (payload.step === "company") return `whereto${SEP}company`;
      if (payload.step === "mood") return `whereto${SEP}mood${SEP}${payload.company}`;
      if (payload.step === "budget") return `whereto${SEP}budget${SEP}${payload.company}${SEP}${payload.mood}`;
      return `whereto${SEP}go${SEP}${payload.company}${SEP}${payload.mood}${SEP}${payload.budget}`;
    case "confirm-book":
    case "book":
    case "waitlist":
      return `${payload.id}${SEP}${payload.eventId}`;
  }
}

/** A UUID is word chars and hyphens; anything else is not an id this product ever mints. */
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isCompany(value: string): value is WheretoCompany {
  return (WHERETO_COMPANIES as readonly string[]).includes(value);
}

function isMood(value: string): value is WheretoMood {
  return (WHERETO_MOODS as readonly string[]).includes(value);
}

function isBudget(value: string): value is WheretoBudget {
  return (WHERETO_BUDGETS as readonly string[]).includes(value);
}

export function parseBotPayload(raw: string): BotPayload | null {
  const payload = raw.trim();
  if (payload === "" || payload.length > PAYLOAD_MAX) return null;
  const parts = payload.split(SEP);
  const id = parts[0];
  if (id === "menu" || id === "today" || id === "plans" || id === "bookings" || id === "help") {
    return parts.length === 1 ? { id } : null;
  }
  if (id === "whereto") return parseWhereto(parts.slice(1));
  if (id === "confirm-book" || id === "book" || id === "waitlist") {
    const eventId = parts[1];
    return parts.length === 2 && eventId !== undefined && UUID_SHAPE.test(eventId) ? { id, eventId } : null;
  }
  return null;
}

/** Strict per step: a payload that names a step must also carry exactly that step's answers. */
function parseWhereto(parts: string[]): BotPayload | null {
  const step = parts[0];
  if (step === "company") return parts.length === 1 ? { id: "whereto", step } : null;
  if (step === "mood") {
    const company = parts[1];
    return parts.length === 2 && company !== undefined && isCompany(company) ? { id: "whereto", step, company } : null;
  }
  if (step === "budget") {
    const [company, mood] = [parts[1], parts[2]];
    return parts.length === 3 && company !== undefined && mood !== undefined && isCompany(company) && isMood(mood) ? { id: "whereto", step, company, mood } : null;
  }
  if (step === "go") {
    const [company, mood, budget] = [parts[1], parts[2], parts[3]];
    return parts.length === 4 && company !== undefined && mood !== undefined && budget !== undefined && isCompany(company) && isMood(mood) && isBudget(budget) ? { id: "whereto", step, company, mood, budget } : null;
  }
  return null;
}

/**
 * The start_param an open_app button carries. MAX constrains open_app payloads to `^[\w-]*$`, and the
 * miniapp router reads exactly this `prefix-id` shape (event-, plan-, booking-, list-, place-, and the
 * bare words `onboarding` / `calendar`), so bot and app agree on one spelling without a table.
 */
export function startAppPayload(prefix: "event" | "plan" | "booking" | "list" | "place" | "onboarding" | "calendar", id?: string): string {
  if (prefix === "onboarding" || prefix === "calendar") return prefix;
  const value = (id ?? "").trim();
  return value === "" ? "" : `${prefix}-${value.replace(/[^\w-]/g, "")}`;
}
