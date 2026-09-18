// START_MODULE_CONTRACT
// PURPOSE: Per-user sliding window for NL assist cost control.
// SCOPE: hit(userId) true if under limit; in-memory, single process.
// DEPENDS: none
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ASSIST_RATE_LIMIT - max hits per window
// - ASSIST_RATE_WINDOW_MS - window length
// - AssistRateLimiter - sliding window
// END_MODULE_MAP

import { Injectable } from "@nestjs/common";

export const ASSIST_RATE_LIMIT = 20;
export const ASSIST_RATE_WINDOW_MS = 10 * 60 * 1000;

@Injectable()
export class AssistRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit = ASSIST_RATE_LIMIT,
    private readonly windowMs = ASSIST_RATE_WINDOW_MS,
  ) {}

  hit(userId: string, now = Date.now()): boolean {
    const cutoff = now - this.windowMs;
    const next = (this.hits.get(userId) ?? []).filter((stamp) => stamp > cutoff);
    if (next.length >= this.limit) {
      this.hits.set(userId, next);
      return false;
    }
    next.push(now);
    this.hits.set(userId, next);
    return true;
  }
}
