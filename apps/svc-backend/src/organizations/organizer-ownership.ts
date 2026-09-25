// START_MODULE_CONTRACT
// PURPOSE: Shared ownership match for events/places after T-004 — organization id first, organizer user id as fallback.
// SCOPE: isOrganizerOwner; no Nest, so services and tests can share it.
// DEPENDS: none
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - OrganizerOwned - the two owner columns
// - isOrganizerOwner - actor is the organization or the linked organizer user; no actor skips the check
// END_MODULE_MAP

export type OrganizerOwned = {
  organizerUserId?: string | null;
  organizerOrganizationId?: string | null;
};

/** No actorId means an unauthenticated write path that already 401'd, or a test that does not pass an owner. */
export function isOrganizerOwner(row: OrganizerOwned, actorId?: string): boolean {
  if (!actorId) return true;
  return row.organizerOrganizationId === actorId || row.organizerUserId === actorId;
}
