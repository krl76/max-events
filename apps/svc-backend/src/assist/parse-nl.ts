// START_MODULE_CONTRACT
// PURPOSE: Deterministic NL parse for the sandbox LLM and as a fallback for live providers.
// SCOPE: README evening/budget/partner/music query; conservative defaults otherwise.
// DEPENDS: @max-events/api-contracts
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - parseAssistQuery - heuristics to AssistCriteria
// END_MODULE_MAP

import type { AssistCriteria, AssistCompany, AssistGenre, AssistWhen } from "@max-events/api-contracts";

export function parseAssistQuery(query: string): AssistCriteria {
  const text = query.toLowerCase();
  return {
    when: detectWhen(text),
    budgetMaxRub: detectBudget(text),
    company: detectCompany(text),
    genre: detectGenre(text),
  };
}

function detectWhen(text: string): AssistWhen {
  if (text.includes("вечер")) return "evening";
  if (text.includes("утр")) return "morning";
  if (text.includes("днём") || text.includes("днем") || text.includes("обед")) return "afternoon";
  return "any";
}

function detectBudget(text: string): number | null {
  const match = text.match(/(\d[\d\s]*)\s*(₽|руб)/i);
  if (!match) return null;
  const value = Number(match[1].replace(/\s/g, ""));
  return Number.isFinite(value) ? value : null;
}

function detectCompany(text: string): AssistCompany {
  if (text.includes("девушк") || text.includes("парн") || text.includes("двоем") || text.includes("вдвоём")) return "partner";
  if (text.includes("дет")) return "kids";
  if (text.includes("друз") || text.includes("компани")) return "friends";
  return "alone";
}

function detectGenre(text: string): AssistGenre {
  if (text.includes("музык") || text.includes("джаз") || text.includes("концерт")) return "music";
  if (text.includes("спорт") || text.includes("футбол") || text.includes("зал")) return "sport";
  if (text.includes("парк") || text.includes("прогул") || text.includes("природ")) return "outdoors";
  return "any";
}
