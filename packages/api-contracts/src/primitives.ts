// START_MODULE_CONTRACT
// PURPOSE: Shared zod primitives (id, timestamps, pagination) reused by all domain schemas.
// SCOPE: Id/Timestamp schemas, pagination query and response envelope.
// DEPENDS: zod
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - IdSchema - shared entity id (uuid)
// - Id - shared entity id type
// - TimestampSchema - shared ISO datetime with offset
// - Timestamp - shared timestamp type
// - PaginationQuerySchema - list query defaults (limit/offset)
// - PaginationQuery - list query type
// - PaginatedResponseSchema - list response envelope factory
// END_MODULE_MAP

import { z } from "zod";

export const IdSchema = z.string().uuid();
export type Id = z.infer<typeof IdSchema>;

export const TimestampSchema = z.string().datetime({ offset: true });
export type Timestamp = z.infer<typeof TimestampSchema>;

export const PaginationQuerySchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export function PaginatedResponseSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    total: z.number().int().min(0),
    limit: z.number().int().min(1),
    offset: z.number().int().min(0),
  });
}
