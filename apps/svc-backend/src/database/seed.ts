// START_MODULE_CONTRACT
// PURPOSE: Idempotent catalog seed — the organizer account, then places, then events published under it.
// SCOPE: seedDatabase(repos, options); upserts the organization and its organizer user, upserts places and events, and adopts pool events left ownerless by an earlier run; does not open a DB connection or call MAX Bot API.
// DEPENDS: typeorm, @max-events/api-contracts, ./seed-data, places/events/users entities, organizations/organizations.service, organizations/organizer-account
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - SeedRepositories - the four stores the seed writes to
// - SeedOptions - clock and the organizer credentials the pool is published under
// - SeedResult - counts returned by seedDatabase
// - futureStart - UTC midnight of now plus dayOffset at hourUtc
// - seedDatabase - upsert the organizer account, places by title+address+city and events by title+city+startsAt
// END_MODULE_MAP

import { IsNull, QueryFailedError, type Repository } from "typeorm";
import { CreateEventSchema, CreatePlaceSchema } from "@max-events/api-contracts";
import { EventEntity } from "../events/event.entity";
import { OrganizationEntity } from "../organizations/organization.entity";
import { OrganizationsService } from "../organizations/organizations.service";
import { organizerMaxUserId } from "../organizations/organizer-account";
import { PlaceEntity } from "../places/place.entity";
import { UserEntity } from "../users/user.entity";
import { SEED_EVENTS, SEED_ORGANIZER, SEED_PLACES } from "./seed-data";

export function futureStart(now: Date, dayOffset: number, hourUtc: number): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + dayOffset, hourUtc, 0, 0, 0));
}

export type SeedRepositories = {
  places: Repository<PlaceEntity>;
  events: Repository<EventEntity>;
  users: Repository<UserEntity>;
  organizations: OrganizationsService;
};

export type SeedOptions = {
  now?: Date;
  /** Defaults to SEED_ORGANIZER.login; pass ORGANIZER_LOGIN to publish under the operator's account. */
  organizerLogin?: string;
  /**
   * Only used when the account does not exist yet. Without it the account is created with no password
   * at all, which the operator's configured credentials can still claim on their first login — a seed
   * that chose a password would either be guessable or lock the documented bootstrap out for good.
   */
  organizerPassword?: string;
};

export type SeedResult = { placesInserted: number; eventsInserted: number; eventsBound: number; organizationInserted: boolean };

async function ensureOrganizerUser(users: Repository<UserEntity>, login: string, name: string): Promise<UserEntity> {
  const maxUserId = organizerMaxUserId(login);
  const existing = await users.findOneBy({ maxUserId });
  if (existing) return existing;
  try {
    return await users.save(users.create({ maxUserId, firstName: name, lastName: null, username: null, avatarUrl: null }));
  } catch (error) {
    // A first organizer login racing this run won the insert; the winner is the account either way.
    if (!isUniqueViolation(error)) throw error;
    const winner = await users.findOneBy({ maxUserId });
    if (!winner) throw error;
    return winner;
  }
}

async function ensureOrganization(organizations: OrganizationsService, login: string, password: string | undefined): Promise<{ organization: OrganizationEntity; inserted: boolean }> {
  const existing = await organizations.findByLogin(login);
  // An existing row keeps its password: the seed must never reset credentials already in use.
  if (existing) return { organization: existing, inserted: false };
  // The operator's own login gets their own name; only the default account is the project's.
  const name = login === SEED_ORGANIZER.login ? SEED_ORGANIZER.name : login;
  const contacts = login === SEED_ORGANIZER.login ? SEED_ORGANIZER.contacts : null;
  const organization = password === undefined ? await organizations.provisionWithoutPassword({ login, name, contacts }) : await organizations.provision({ login, password, name, contacts });
  return { organization, inserted: true };
}

async function ensureOrganizerUserById(users: Repository<UserEntity>, id: string, login: string): Promise<UserEntity> {
  const linked = await users.findOneBy({ id });
  // A link pointing at a row that no longer exists falls back to the login convention.
  return linked ?? ensureOrganizerUser(users, login, SEED_ORGANIZER.name);
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof QueryFailedError && error.driverError?.code === "23505";
}

/**
 * The pool is anchored to the run date, so an earlier run's rows sit at a different startsAt and the
 * title+city+startsAt lookup below never sees them. Those are exactly the rows #482 is about: seeded
 * before an organizer account existed, showing "Организатор не указан". Only ownerless ones are taken —
 * an event somebody already owns is never moved.
 */
async function adoptOwnerlessPoolEvents(events: Repository<EventEntity>, organizerUserId: string, organizationId: string): Promise<number> {
  const pool = new Set(SEED_EVENTS.map((spec) => JSON.stringify([spec.title, spec.city])));
  const ownerless = await events.find({ where: { organizerUserId: IsNull() } });
  let bound = 0;
  for (const row of ownerless) {
    if (!pool.has(JSON.stringify([row.title, row.city]))) continue;
    row.organizerUserId = organizerUserId;
    row.organizerOrganizationId = organizationId;
    await events.save(row);
    bound += 1;
  }
  return bound;
}

export async function seedDatabase(repos: SeedRepositories, options: SeedOptions = {}): Promise<SeedResult> {
  const { places, events, users, organizations } = repos;
  const now = options.now ?? new Date();
  const login = options.organizerLogin ?? SEED_ORGANIZER.login;
  const { organization, inserted: organizationInserted } = await ensureOrganization(organizations, login, options.organizerPassword);
  // An account already linked to a user keeps it: the seed publishes as whoever logs into that account,
  // it does not move the account onto a user of its own.
  const organizer = organization.organizerUserId ? await ensureOrganizerUserById(users, organization.organizerUserId, login) : await ensureOrganizerUser(users, login, SEED_ORGANIZER.name);
  if (!organization.organizerUserId) await organizations.linkOrganizerUser(organization, organizer.id);

  const placeIds = new Map<string, string>();
  let placesInserted = 0;
  for (const raw of SEED_PLACES) {
    const payload = CreatePlaceSchema.parse(raw);
    const existing = await places.findOneBy({ title: payload.title, address: payload.address, city: payload.city });
    if (existing) {
      placeIds.set(payload.title, existing.id);
      continue;
    }
    const saved = await places.save(places.create({ ...payload, organizerUserId: organizer.id, organizerOrganizationId: organization.id }));
    placeIds.set(payload.title, saved.id);
    placesInserted += 1;
  }

  let eventsInserted = 0;
  for (const spec of SEED_EVENTS) {
    const placeId = placeIds.get(spec.placeTitle);
    if (!placeId) throw new Error(`seed place not found: ${spec.placeTitle}`);
    const startsAt = futureStart(now, spec.dayOffset, spec.hourUtc);
    const endsAt = spec.durationHours ? new Date(startsAt.getTime() + spec.durationHours * 3_600_000) : null;
    const payload = CreateEventSchema.parse({
      title: spec.title,
      description: spec.description,
      category: spec.category,
      city: spec.city,
      placeId,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt ? endsAt.toISOString() : null,
      isPaid: spec.isPaid ?? false,
      priceRub: spec.priceRub ?? null,
      paymentUrl: spec.paymentUrl ?? null,
      capacity: spec.capacity ?? null,
    });
    const existing = await events.findOneBy({ title: payload.title, city: payload.city, startsAt: new Date(payload.startsAt) });
    if (existing) continue;
    await events.save(
      events.create({
        title: payload.title,
        description: payload.description,
        category: payload.category,
        city: payload.city,
        placeId: payload.placeId,
        startsAt: new Date(payload.startsAt),
        endsAt: payload.endsAt ? new Date(payload.endsAt) : null,
        isPaid: payload.isPaid,
        priceRub: payload.priceRub,
        paymentUrl: payload.paymentUrl,
        capacity: payload.capacity,
        organizerUserId: organizer.id,
        organizerOrganizationId: organization.id,
        bookedCount: 0,
        published: true,
        chatLink: null,
        chatSyncPending: true,
      }),
    );
    eventsInserted += 1;
  }
  const eventsBound = await adoptOwnerlessPoolEvents(events, organizer.id, organization.id);

  return { placesInserted, eventsInserted, eventsBound, organizationInserted };
}
