import { describe, expect, it } from "vitest";
import { QueryFailedError } from "typeorm";
import { createOrganizationRepoFake } from "../auth/auth.organizer.testHarness";
import { OrganizationEntity } from "./organization.entity";
import { OrganizationsService, toOrganizationDto } from "./organizations.service";

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

describe("toOrganizationDto", () => {
  it("never exposes the password hash", () => {
    const dto = toOrganizationDto({ id: "00000000-0000-4000-8000-000000000001", name: "Парк Горького", contacts: null, login: "gorky", passwordHash: "scrypt$1$2$3$x$y" } as OrganizationEntity);
    expect(dto).toEqual({ id: "00000000-0000-4000-8000-000000000001", name: "Парк Горького", contacts: null });
    expect(JSON.stringify(dto)).not.toContain("scrypt");
  });
});
