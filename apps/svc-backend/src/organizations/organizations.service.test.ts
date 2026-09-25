import { describe, expect, it } from "vitest";
import { QueryFailedError } from "typeorm";
import { createOrganizationRepoFake } from "../auth/auth.organizer.testHarness";
import { OrganizationEntity } from "./organization.entity";
import { ForbiddenException } from "@nestjs/common";
import { organizerActorId, OrganizationsService, toOrganizationDto } from "./organizations.service";

function createService(initial: OrganizationEntity[] = []) {
  const repo = createOrganizationRepoFake(initial);
  return { service: new OrganizationsService(repo), repo };
}

describe("OrganizationsService.provision", () => {
  it("stores the account with a hashed password that verifies", async () => {
    const { service, repo } = createService();
    const created = await service.provision({ login: "demo", password: "s3cret" });
    expect(created.login).toBe("demo");
    expect(created.name).toBe("demo");
    expect(created.contacts).toBeNull();
    expect(created.passwordHash).not.toContain("s3cret");
    expect(repo.store).toHaveLength(1);
    await expect(service.verifyPassword(created, "s3cret")).resolves.toBe(true);
  });

  it("keeps the name and contacts it was given", async () => {
    const { service } = createService();
    const created = await service.provision({ login: "gorky", password: "s3cret", name: "Парк Горького", contacts: "org@example.com" });
    expect(created.name).toBe("Парк Горького");
    expect(created.contacts).toBe("org@example.com");
  });

  it("returns the winner when a concurrent first login loses the unique race", async () => {
    const { service, repo } = createService();
    const winner = await service.provision({ login: "demo", password: "s3cret" });
    const originalSave = repo.save.bind(repo);
    repo.save = async () => {
      repo.save = originalSave;
      throw new QueryFailedError("INSERT", [], Object.assign(new Error("duplicate key"), { code: "23505" }));
    };
    await expect(service.provision({ login: "demo", password: "s3cret" })).resolves.toMatchObject({ id: winner.id });
  });

  it("rethrows a unique violation that leaves no readable row", async () => {
    const { service, repo } = createService();
    repo.save = async () => {
      throw new QueryFailedError("INSERT", [], Object.assign(new Error("duplicate key"), { code: "23505" }));
    };
    await expect(service.provision({ login: "demo", password: "s3cret" })).rejects.toBeInstanceOf(QueryFailedError);
  });
});

describe("OrganizationsService.verifyPassword", () => {
  it("rejects a wrong password for a stored account", async () => {
    const { service } = createService();
    const created = await service.provision({ login: "demo", password: "s3cret" });
    await expect(service.verifyPassword(created, "wrong")).resolves.toBe(false);
  });
});

describe("OrganizationsService.findByLogin", () => {
  it("returns null for a login that was never provisioned", async () => {
    const { service } = createService();
    await service.provision({ login: "demo", password: "s3cret" });
    await expect(service.findByLogin("nobody")).resolves.toBeNull();
  });
});

describe("organizerActorId", () => {
  it("returns the linked user and 403s when the organization has none", () => {
    expect(organizerActorId({ organizerUserId: "00000000-0000-4000-8000-00000000000a" } as OrganizationEntity)).toBe("00000000-0000-4000-8000-00000000000a");
    expect(() => organizerActorId({ organizerUserId: null } as OrganizationEntity)).toThrow(ForbiddenException);
  });
});

describe("toOrganizationDto", () => {
  it("never exposes the password hash and defaults activities", () => {
    const dto = toOrganizationDto({ id: "00000000-0000-4000-8000-000000000001", name: "Парк Горького", contacts: null, login: "gorky", passwordHash: "scrypt$1$2$3$x$y" } as OrganizationEntity);
    expect(dto).toEqual({ id: "00000000-0000-4000-8000-000000000001", name: "Парк Горького", contacts: null, activities: [] });
    expect(JSON.stringify(dto)).not.toContain("scrypt");
  });
});

describe("OrganizationsService setup", () => {
  const organizerUserId = "00000000-0000-4000-8000-00000000000a";

  async function linkedOrg() {
    const { service } = createService();
    const created = await service.provision({ login: "gorky", password: "s3cret", name: "Парк Горького", contacts: "org@example.com" });
    created.organizerUserId = organizerUserId;
    return { service, created };
  }

  it("returns 404 when the user has no organization", async () => {
    const { service } = createService();
    await expect(service.getSetup(organizerUserId)).rejects.toMatchObject({ status: 404 });
  });

  it("returns a freshly provisioned setup with the organization name on the venue card", async () => {
    const { service, created } = await linkedOrg();
    await expect(service.getSetup(organizerUserId)).resolves.toMatchObject({
      organizationId: created.id,
      step: "venue",
      completedAt: null,
      venue: { placeId: null, title: "Парк Горького", address: "", city: "" },
      activities: [],
      payouts: { mode: "none", paymentUrl: null, contacts: "org@example.com" },
    });
  });

  it("persists the step, activities, venue and contacts, and writes the organization name", async () => {
    const { service } = await linkedOrg();
    const updated = await service.updateSetup(organizerUserId, {
      step: "payouts",
      activities: ["events", "tours", "events"],
      venue: { title: "Парк Горького", address: "Крымский Вал, 9", city: "Москва" },
      payouts: { contacts: "park@example.com" },
    });
    expect(updated.step).toBe("payouts");
    expect(updated.activities).toEqual(["events", "tours"]);
    expect(updated.venue).toMatchObject({ title: "Парк Горького", address: "Крымский Вал, 9", city: "Москва" });
    expect(updated.payouts.contacts).toBe("park@example.com");
    const again = await service.getSetup(organizerUserId);
    expect(again).toEqual(updated);
    expect((await service.findByOrganizerUserId(organizerUserId))?.name).toBe("Парк Горького");
  });

  it("keeps activities when the venue title is still blank, and refuses wiping a stored name", async () => {
    const { service, created } = await linkedOrg();
    created.venueTitle = "";
    const firstRun = await service.updateSetup(organizerUserId, { activities: ["tours"], venue: { title: "", address: "Крымский Вал, 9", city: "Москва" } });
    expect(firstRun.activities).toEqual(["tours"]);
    expect(firstRun.venue.address).toBe("Крымский Вал, 9");
    await service.updateSetup(organizerUserId, { venue: { title: "Парк Горького" } });
    await expect(service.updateSetup(organizerUserId, { venue: { title: "  " } })).rejects.toMatchObject({ status: 400 });
  });

  it("refuses an external payout without a URL", async () => {
    const { service } = await linkedOrg();
    await expect(service.updateSetup(organizerUserId, { payouts: { mode: "external", paymentUrl: null } })).rejects.toMatchObject({ status: 400 });
    await expect(service.updateSetup(organizerUserId, { payouts: { mode: "external", paymentUrl: "касса на входе" } })).rejects.toMatchObject({ status: 400 });
  });

  it("stores an external payment URL and clears it when the mode goes back to none", async () => {
    const { service } = await linkedOrg();
    const paid = await service.updateSetup(organizerUserId, { payouts: { mode: "external", paymentUrl: "https://pay.example.com/gorky" } });
    expect(paid.payouts).toMatchObject({ mode: "external", paymentUrl: "https://pay.example.com/gorky" });
    const free = await service.updateSetup(organizerUserId, { payouts: { mode: "none" } });
    expect(free.payouts).toMatchObject({ mode: "none", paymentUrl: null });
  });

  it("stamps completedAt once and does not move it on a second complete", async () => {
    const { service } = await linkedOrg();
    const first = await service.completeSetup(organizerUserId, new Date("2026-09-19T12:00:00.000Z"));
    expect(first.completedAt).toBe("2026-09-19T12:00:00.000Z");
    expect(first.step).toBe("event");
    const second = await service.completeSetup(organizerUserId, new Date("2026-09-20T12:00:00.000Z"));
    expect(second.completedAt).toBe("2026-09-19T12:00:00.000Z");
  });
});
