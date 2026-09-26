// START_MODULE_CONTRACT
// PURPOSE: Dictionary of post-event fact tags («Что было правдой?») and their ru labels.
// SCOPE: REVIEW_FACT_TAGS; the codes match ReviewFactTagCodeSchema.
// DEPENDS: none
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - REVIEW_FACT_TAGS - code + label in design order
// END_MODULE_MAP

export const REVIEW_FACT_TAGS = [
  { code: "calm", label: "Спокойно" },
  { code: "kids_ok", label: "С детьми ок" },
  { code: "crowded", label: "Многолюдно" },
  { code: "pricey", label: "Дорого" },
  { code: "beginner_friendly", label: "Новичкам легко" },
] as const;
