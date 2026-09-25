// START_MODULE_CONTRACT
// PURPOSE: Entry code shown on a ticket and typed at the door — derived from the booking id.
// SCOPE: entryCodeFromBookingId; normalizeEntryCode. Same derivation as the miniapp organizerEntryCode.
// DEPENDS: none
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - entryCodeFromBookingId - last six hex of the booking id, uppercased
// - normalizeEntryCode - trim, strip separators, uppercase; empty after that is invalid
// END_MODULE_MAP

export function entryCodeFromBookingId(bookingId: string): string {
  return bookingId.replace(/-/g, "").slice(-6).toUpperCase();
}

export function normalizeEntryCode(code: string): string {
  return code.replace(/[^0-9a-z]/gi, "").toUpperCase();
}
