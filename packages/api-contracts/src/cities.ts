// START_MODULE_CONTRACT
// PURPOSE: Zod contract for the city directory used by catalog filters.
// SCOPE: CitiesSchema — unique city names from published events and places.
// DEPENDS: zod
// LINKS: M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - CitiesSchema - sorted unique city names
// - Cities - city list type
// END_MODULE_MAP

import { z } from "zod";

export const CitiesSchema = z.array(z.string().min(1));
export type Cities = z.infer<typeof CitiesSchema>;
