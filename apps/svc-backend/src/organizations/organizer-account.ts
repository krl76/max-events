// START_MODULE_CONTRACT
// PURPOSE: One spelling of the synthetic MAX user id an organizer login maps to.
// SCOPE: organizerMaxUserId(login); shared by the organizer login path and the seed so both converge on a single user row per login. No Nest imports, so a script can use it without booting the app.
// DEPENDS: none
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - organizerMaxUserId - "organizer:{login}", the users.maxUserId of an organizer account
// END_MODULE_MAP

/** Organizer accounts have no MAX user behind them, so their maxUserId is derived from the login. */
export function organizerMaxUserId(login: string): string {
  return `organizer:${login}`;
}
