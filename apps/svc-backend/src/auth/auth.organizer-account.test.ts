import { describe, expect, it } from "vitest";
import { OrganizationEntity } from "../organizations/organization.entity";
import { hashPassword } from "../organizations/password";
import { createOrganizerAuthService } from "./auth.organizer.testHarness";

const envCredentials = { ORGANIZER_LOGIN: "demo", ORGANIZER_PASSWORD: "s3cret" };

async function organization(login: string, password: string, overrides: Partial<OrganizationEntity> = {}): Promise<OrganizationEntity> {
  return {
    id: "00000000-0000-4000-8000-0000000000a1",
    name: "Парк Горького",
    contacts: "org@example.com",
    login,
    passwordHash: await hashPassword(password),
    ...overrides,
  } as OrganizationEntity;
}

describe("AuthService.organizerLogin against an organization account", () => {
  it("logs a stored account in without any env credentials configured", async () => {
    const account = await organization("gorky", "park-pass");
    const { service } = createOrganizerAuthService({}, [account]);
    const result = await service.organizerLogin("gorky", "park-pass");
    if (typeof result !== "object" || result === null) throw new Error("unreachable");
    expect(result.organization.id).toBe(account.id);
    expect(result.organization.name).toBe("Парк Горького");
    expect(result.token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects the wrong password for a stored account", async () => {
    const { service } = createOrganizerAuthService({}, [await organization("gorky", "park-pass")]);
    await expect(service.organizerLogin("gorky", "wrong")).resolves.toBeNull();
  });

  it("reports disabled only when there is neither an account nor env credentials", async () => {
    const { service } = createOrganizerAuthService({});
    await expect(service.organizerLogin("gorky", "park-pass")).resolves.toBe("disabled");
  });

  it("provisions the account from env credentials on the first login and keeps it afterwards", async () => {
    const { service, organizationRepo } = createOrganizerAuthService(envCredentials);
    const first = await service.organizerLogin("demo", "s3cret");
    if (typeof first !== "object" || first === null) throw new Error("unreachable");
    expect(organizationRepo.store).toHaveLength(1);
    expect(organizationRepo.store[0]?.login).toBe("demo");
    expect(organizationRepo.store[0]?.passwordHash).not.toContain("s3cret");

    const second = await service.organizerLogin("demo", "s3cret");
    if (typeof second !== "object" || second === null) throw new Error("unreachable");
    expect(organizationRepo.store).toHaveLength(1);
    expect(second.organization.id).toBe(first.organization.id);
  });

  it("lets the stored account win once it exists, so rotating env no longer opens the panel", async () => {
    const { service } = createOrganizerAuthService(envCredentials, [await organization("demo", "stored-pass")]);
    // Env still says s3cret, but the row is the source of truth from the first provision onwards.
    await expect(service.organizerLogin("demo", "s3cret")).resolves.toBeNull();
    await expect(service.organizerLogin("demo", "stored-pass")).resolves.toMatchObject({ organization: { login: "demo" } });
  });

  it("never lets a login provision an account for credentials the operator did not configure", async () => {
    const { service, organizationRepo } = createOrganizerAuthService(envCredentials);
    await expect(service.organizerLogin("stranger", "any-pass")).resolves.toBeNull();
    expect(organizationRepo.store).toHaveLength(0);
  });
});
