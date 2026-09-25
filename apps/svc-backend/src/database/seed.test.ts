import { describe, expect, it } from "vitest";
import type { Repository } from "typeorm";
import { EventCategorySchema } from "@max-events/api-contracts";
import { createOrganizationRepoFake } from "../auth/auth.organizer.testHarness";
import { EventEntity } from "../events/event.entity";
import { OrganizationsService } from "../organizations/organizations.service";
import { PlaceEntity } from "../places/place.entity";
import { UserEntity } from "../users/user.entity";
import { organizerMaxUserId } from "../organizations/organizer-account";
import { UNSET_PASSWORD_HASH } from "../organizations/password";
import { SEED_EVENTS, SEED_ORGANIZER, SEED_PLACES } from "./seed-data";
import { futureStart, seedDatabase } from "./seed";

const now = new Date("2026-09-12T10:00:00Z");

function createUserRepo(initial: UserEntity[] = []) {
  const store = [...initial];
  let seq = 0;
  return {
    store,
    create: (fields: Partial<UserEntity>) => ({ ...fields }) as UserEntity,
    findOneBy: async (where: { maxUserId?: string; id?: string }) => store.find((row) => (where.maxUserId === undefined || row.maxUserId === where.maxUserId) && (where.id === undefined || row.id === where.id)) ?? null,
    save: async (entity: UserEntity) => {
      if (!store.includes(entity)) {
        entity.id ??= `00000000-0000-4000-8000-${String(900 + ++seq).padStart(12, "0")}`;
        store.push(entity);
      }
      return entity;
    },
  };
}

/** One bundle per test, so a rerun writes to the same four stores the first run did. */
function createRepos() {
  const places = createPlaceRepo();
  const events = createEventRepo();
  const users = createUserRepo();
  const organizationRepo = createOrganizationRepoFake();
  const repos = {
    places: places as unknown as Repository<PlaceEntity>,
    events: events as unknown as Repository<EventEntity>,
    users: users as unknown as Repository<UserEntity>,
    organizations: new OrganizationsService(organizationRepo),
  };
  return { repos, places, events, users, organizationRepo };
}

function createPlaceRepo(initial: PlaceEntity[] = []) {
  const store = [...initial];
  let seq = 0;
  return {
    store,
    create: (fields: Partial<PlaceEntity>) => ({ ...fields }) as PlaceEntity,
    findOneBy: async (where: { title: string; address: string; city: string }) => store.find((row) => row.title === where.title && row.address === where.address && row.city === where.city) ?? null,
    save: async (entity: PlaceEntity) => {
      if (!store.includes(entity)) {
        entity.id ??= `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
        entity.createdAt ??= now;
        entity.updatedAt ??= now;
        store.push(entity);
      }
      return entity;
    },
  };
}

function createEventRepo(initial: EventEntity[] = []) {
  const store = [...initial];
  let seq = 100;
  return {
    store,
    create: (fields: Partial<EventEntity>) => ({ ...fields }) as EventEntity,
    findOneBy: async (where: { title: string; city: string; startsAt: Date }) => store.find((row) => row.title === where.title && row.city === where.city && row.startsAt.getTime() === where.startsAt.getTime()) ?? null,
    // Models the one query the adoption pass makes: every event nobody owns yet.
    find: async () => store.filter((row) => row.organizerUserId === null || row.organizerUserId === undefined),
    save: async (entity: EventEntity) => {
      if (!store.includes(entity)) {
        entity.id ??= `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
        entity.createdAt ??= now;
        entity.updatedAt ??= now;
        store.push(entity);
      }
      return entity;
    },
  };
}

describe("futureStart", () => {
  it("is stable for the same UTC day and offset", () => {
    const a = futureStart(new Date("2026-09-12T10:00:00Z"), 7, 16);
    const b = futureStart(new Date("2026-09-12T23:00:00Z"), 7, 16);
    expect(a.toISOString()).toBe("2026-09-19T16:00:00.000Z");
    expect(b.toISOString()).toBe(a.toISOString());
  });
});

describe("seedDatabase", () => {
  it("inserts the Moscow pool once and is idempotent on rerun", async () => {
    const { repos, places, events } = createRepos();
    const first = await seedDatabase(repos, { now });
    expect(first.placesInserted).toBe(SEED_PLACES.length);
    expect(first.eventsInserted).toBe(SEED_EVENTS.length);
    expect(places.store).toHaveLength(SEED_PLACES.length);
    expect(events.store).toHaveLength(SEED_EVENTS.length);

    const second = await seedDatabase(repos, { now });
    expect(second).toEqual({ placesInserted: 0, eventsInserted: 0, eventsBound: 0, organizationInserted: false });
    expect(places.store).toHaveLength(SEED_PLACES.length);
    expect(events.store).toHaveLength(SEED_EVENTS.length);

    const laterSameUtcDay = await seedDatabase(repos, { now: new Date("2026-09-12T23:59:00Z") });
    expect(laterSameUtcDay).toEqual({ placesInserted: 0, eventsInserted: 0, eventsBound: 0, organizationInserted: false });
    expect(events.store).toHaveLength(SEED_EVENTS.length);
  });

  it("publishes the pool under one organization instead of leaving it ownerless", async () => {
    const { repos, events, places, users, organizationRepo } = createRepos();

    const result = await seedDatabase(repos, { now });

    expect(result.organizationInserted).toBe(true);
    expect(organizationRepo.store).toHaveLength(1);
    const organization = organizationRepo.store[0]!;
    expect(organization.login).toBe(SEED_ORGANIZER.login);
    expect(users.store).toHaveLength(1);
    // Same user-id convention as the organizer login, so logging in does not create a second account.
    expect(users.store[0]!.maxUserId).toBe(organizerMaxUserId(SEED_ORGANIZER.login));
    expect(organization.organizerUserId).toBe(users.store[0]!.id);
    expect(events.store.every((row) => row.organizerUserId === users.store[0]!.id)).toBe(true);
    expect(events.store.every((row) => row.organizerOrganizationId === organization.id)).toBe(true);
    expect(places.store.every((row) => row.organizerOrganizationId === organization.id)).toBe(true);
  });

  it("leaves the account without a password when the operator configured none", async () => {
    const { repos, organizationRepo } = createRepos();

    await seedDatabase(repos, { now });

    // Neither a known password (a login anyone could read off GitHub) nor a random one, which would
    // lock the documented ORGANIZER_LOGIN/ORGANIZER_PASSWORD bootstrap out of its own account forever.
    expect(organizationRepo.store[0]!.passwordHash).toBe(UNSET_PASSWORD_HASH);
  });

  it("adopts rows an earlier run left ownerless, whatever day they were seeded on", async () => {
    const { repos, events } = createRepos();
    // An earlier run anchored the pool to another date, so these sit at a different startsAt.
    await seedDatabase(repos, { now: new Date("2026-09-01T10:00:00Z") });
    const foreignOrganizer = "00000000-0000-4000-8000-0000000000ff";
    for (const row of events.store) row.organizerUserId = null;
    events.store[1]!.organizerUserId = foreignOrganizer;
    const ownerlessBefore = events.store.filter((row) => row.organizerUserId === null).length;

    const rerun = await seedDatabase(repos, { now });

    expect(ownerlessBefore).toBe(SEED_EVENTS.length - 1);
    expect(rerun.eventsBound).toBe(ownerlessBefore);
    expect(events.store.filter((row) => row.organizerUserId === null)).toHaveLength(0);
    expect(events.store[1]!.organizerUserId).toBe(foreignOrganizer);
  });

  it("does not adopt an ownerless event that is not part of the pool", async () => {
    const { repos, events } = createRepos();
    await seedDatabase(repos, { now });
    events.store.push({ title: "Чужое событие", city: "Москва", organizerUserId: null, startsAt: now } as never);

    const rerun = await seedDatabase(repos, { now });

    expect(rerun.eventsBound).toBe(0);
    expect(events.store.at(-1)!.organizerUserId).toBeNull();
  });

  it("publishes as the user an existing account is already linked to", async () => {
    const { repos, events, users, organizationRepo } = createRepos();
    await seedDatabase(repos, { now });
    const loginUser = users.store[0]!;

    const rerun = await seedDatabase(repos, { now: new Date("2026-09-20T10:00:00Z") });

    expect(users.store).toHaveLength(1);
    expect(organizationRepo.store[0]!.organizerUserId).toBe(loginUser.id);
    expect(events.store.every((row) => row.organizerUserId === loginUser.id)).toBe(true);
    expect(rerun.organizationInserted).toBe(false);
  });

  it("publishes under the operator's login when one is configured", async () => {
    const { repos, users, organizationRepo } = createRepos();

    await seedDatabase(repos, { now, organizerLogin: "partner-desk", organizerPassword: "operator-set" });

    expect(organizationRepo.store[0]!.login).toBe("partner-desk");
    // Not "MAX Events": the operator's own account must not be published under the project's name.
    expect(organizationRepo.store[0]!.name).toBe("partner-desk");
    expect(users.store[0]!.maxUserId).toBe(organizerMaxUserId("partner-desk"));
  });

  it("never rewrites the password of an account that already exists", async () => {
    const { repos, organizationRepo } = createRepos();
    await seedDatabase(repos, { now, organizerPassword: "first-run" });
    const before = organizationRepo.store[0]!.passwordHash;

    await seedDatabase(repos, { now, organizerPassword: "second-run" });

    expect(organizationRepo.store).toHaveLength(1);
    expect(organizationRepo.store[0]!.passwordHash).toBe(before);
  });

  it("covers all four event categories with future dates and geo places", async () => {
    const { repos, events, places } = createRepos();
    await seedDatabase(repos, { now });

    const categories = new Set(events.store.map((row) => row.category));
    expect([...EventCategorySchema.options].every((category) => categories.has(category))).toBe(true);
    expect(events.store.every((row) => row.startsAt.getTime() > now.getTime())).toBe(true);
    expect(places.store.every((row) => row.latitude >= -90 && row.latitude <= 90 && row.longitude >= -180 && row.longitude <= 180)).toBe(true);
    expect(places.store.every((row) => row.city === "Москва")).toBe(true);
  });

  it("does not point seed events at dead example.com payment URLs", () => {
    expect(SEED_EVENTS.every((spec) => spec.paymentUrl == null || !spec.paymentUrl.includes("example.com"))).toBe(true);
  });
});
