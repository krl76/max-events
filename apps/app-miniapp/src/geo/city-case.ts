// START_MODULE_CONTRACT
// PURPOSE: Склонение русских названий городов для подписей вроде «по Москве» и «города Тулы».
// SCOPE: Предложный и родительный падеж. Нерусские и несклоняемые имена остаются как есть.
// DEPENDS: —
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - prepositionalCity - «по Москве», «по Санкт-Петербурге»
// - genitiveCity - «города Москвы», «города Казани»
// END_MODULE_MAP

const HUSHING = new Set(["г", "к", "х", "ж", "ч", "ш", "щ"]);
const PARTICLES = new Set(["на", "над", "под", "у", "во", "в"]);
const FROZEN = new Set(["санкт", "лос", "нью", "сан"]);
const ADJECTIVES: Record<string, { pre: string; gen: string }> = {
  нижний: { pre: "Нижнем", gen: "Нижнего" },
  великий: { pre: "Великом", gen: "Великого" },
  новый: { pre: "Новом", gen: "Нового" },
  старый: { pre: "Старом", gen: "Старого" },
  южный: { pre: "Южном", gen: "Южного" },
  верхний: { pre: "Верхнем", gen: "Верхнего" },
};

type Case = "pre" | "gen";

function inflectPart(part: string, kase: Case): string {
  const lower = part.toLowerCase();
  const adjective = ADJECTIVES[lower];
  if (adjective !== undefined) return adjective[kase];
  if (PARTICLES.has(lower) || FROZEN.has(lower)) return part;
  if (!/^[а-яё]+$/i.test(part)) return part;
  const last = lower.slice(-1);
  const stem = part.slice(0, -1);
  if ("оеиуюэы".includes(last)) return part;
  if (last === "а") {
    if (kase === "pre") return `${stem}е`;
    return `${stem}${HUSHING.has(stem.slice(-1).toLowerCase()) ? "и" : "ы"}`;
  }
  if (last === "я") return kase === "pre" ? `${stem}е` : `${stem}и`;
  if (last === "ь") return `${stem}и`;
  if (last === "й") return kase === "pre" ? `${stem}е` : `${stem}я`;
  return kase === "pre" ? `${part}е` : `${part}а`;
}

function inflectCity(city: string, kase: Case): string {
  const trimmed = city.trim();
  if (trimmed === "") return trimmed;
  return trimmed
    .split(/(\s+|[-–])/)
    .map((piece) => (/^\s+$/.test(piece) || piece === "-" || piece === "–" ? piece : inflectPart(piece, kase)))
    .join("");
}

/** Предложный падеж: «по Москве». */
export function prepositionalCity(city: string): string {
  return inflectCity(city, "pre");
}

/** Родительный падеж: «города Москвы». */
export function genitiveCity(city: string): string {
  return inflectCity(city, "gen");
}
