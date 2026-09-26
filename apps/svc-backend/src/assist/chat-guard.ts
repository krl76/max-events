// START_MODULE_CONTRACT
// PURPOSE: Direct-insult and bare card-choice checks for MAX AI chat.
// SCOPE: isDirectInsult and offeredChoiceIndex. No logging and no catalog.
// DEPENDS: none
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - isDirectInsult - slur stem in the message
// - offeredChoiceIndex - visible-card index, or null when not only a choice
// END_MODULE_MAP

const INSULT_STEMS = ["хуй", "пизд", "еба", "ёба", "бля", "сука", "мудак", "fuck", "shit"] as const;

const FILLERS = new Set(["берём", "берем", "давай", "этот", "эту", "это", "открой"]);

const ORDINAL_INDEX: Record<string, number> = {
  первую: 0,
  первый: 0,
  вторую: 1,
  второй: 1,
  третью: 2,
  третий: 2,
  четвёртую: 3,
  четвертую: 3,
  четвёртый: 3,
  четвертый: 3,
  "1": 0,
  "2": 1,
  "3": 2,
  "4": 3,
  этот: 0,
  эту: 0,
  это: 0,
};

const REAL_ORDINAL_RE = /(?<![\p{L}\p{N}])(первую|первый|вторую|второй|третью|третий|четвёртую|четвертую|четвёртый|четвертый|[1-4])(?![\p{L}\p{N}])/gu;

const DEMONSTRATIVE_RE = /(?<![\p{L}\p{N}])(этот|эту|это)(?![\p{L}\p{N}])/gu;

type OrdinalHit = { index: number; start: number; end: number };

export function isDirectInsult(text: string): boolean {
  const lower = text.toLowerCase();
  return INSULT_STEMS.some((stem) => lower.includes(stem));
}

export function offeredChoiceIndex(text: string, count: number): number | null {
  if (!Number.isInteger(count) || count < 1 || count > 4) return null;

  const lower = text.toLowerCase();
  const ordinals = ordinalHits(lower, REAL_ORDINAL_RE);
  // A second digit is not a letter, so the remainder check cannot reject it.
  if (ordinals.length > 1) return null;
  if (ordinals.length === 1) {
    const hit = ordinals[0];
    if (!hit || hit.index >= count) return null;
    return remainingIsChoice(lower, hit) ? hit.index : null;
  }

  if (count !== 1) return null;
  const demonstratives = ordinalHits(lower, DEMONSTRATIVE_RE);
  if (demonstratives.length !== 1) return null;
  const hit = demonstratives[0];
  if (!hit) return null;
  return remainingIsChoice(lower, hit) ? 0 : null;
}

function ordinalHits(text: string, re: RegExp): OrdinalHit[] {
  re.lastIndex = 0;
  const hits: OrdinalHit[] = [];
  for (const match of text.matchAll(re)) {
    const token = match[1];
    const start = match.index;
    if (token === undefined || start === undefined) continue;
    const index = ORDINAL_INDEX[token];
    if (index === undefined) continue;
    hits.push({ index, start, end: start + token.length });
  }
  return hits;
}

function remainingIsChoice(text: string, hit: OrdinalHit): boolean {
  const rest = text.slice(0, hit.start) + text.slice(hit.end);
  const letters = rest.replace(/[^\p{L}]/gu, "");
  return letters.length === 0 || FILLERS.has(letters);
}
