// START_MODULE_CONTRACT
// PURPOSE: Strip prompt-injection wrappers from NL assist queries before they reach the LLM.
// SCOPE: ignore-previous / system: / fence tokens; empty after sanitize is invalid.
// DEPENDS: none
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - sanitizeAssistQuery - strip injection phrases
// END_MODULE_MAP

export function sanitizeAssistQuery(raw: string): string {
  return raw
    .replace(/ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/gi, " ")
    .replace(/system\s*:/gi, " ")
    .replace(/<\|[\s\S]*?\|>/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^[.\s,:;-]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}
