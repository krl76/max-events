// START_MODULE_CONTRACT
// PURPOSE: One spelling of the organizer session key, shared by the login path and the rotation CLI.
// SCOPE: ORGANIZER_SESSION_PREFIX + organizerSessionKey(token); the value stored under the key is the organization id (legacy sessions may still hold the organizer user id). No Nest imports, so a script can use it without booting the app.
// DEPENDS: none
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ORGANIZER_SESSION_PREFIX - key prefix every organizer session shares
// - organizerSessionKey - Redis key for one organizer session token
// END_MODULE_MAP

export const ORGANIZER_SESSION_PREFIX = "organizer-session:";

export function organizerSessionKey(token: string): string {
  return `${ORGANIZER_SESSION_PREFIX}${token}`;
}
