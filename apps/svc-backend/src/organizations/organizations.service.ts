// START_MODULE_CONTRACT
// PURPOSE: Organization accounts — credential verification for the organizer panel and the admin-provisioned row behind it.
// SCOPE: findByLogin, findByOrganizerUserId, verifyPassword (scrypt), setPassword, provision and provisionWithoutPassword (admin bootstrap from operator credentials or from the seed, never self-service); no endpoint of its own.
// DEPENDS: @nestjs/common, @nestjs/typeorm, typeorm, @max-events/api-contracts, ./organization.entity, ./password
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - OrganizationsService - count, countWithPassword, findByLogin, findByOrganizerUserId, organizerUserIdOf, linkOrganizerUser, verifyPassword, setPassword, provision, provisionWithoutPassword
// - toOrganizationDto - entity to the Organization contract (never carries the password hash)
// END_MODULE_MAP

import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Not, QueryFailedError, Repository } from "typeorm";
import type { Organization } from "@max-events/api-contracts";
import { OrganizationEntity } from "./organization.entity";
import { hashPassword, UNSET_PASSWORD_HASH, verifyPassword } from "./password";

@Injectable()
export class OrganizationsService {
  constructor(@InjectRepository(OrganizationEntity) private readonly organizations: Repository<OrganizationEntity>) {}

  /** Login-independent, so callers can decide "organizer login is unconfigured" without probing a name. */
  count(): Promise<number> {
    return this.organizations.count();
  }

  /** Accounts somebody can actually log into: a seeded row without credentials does not count. */
  countWithPassword(): Promise<number> {
    return this.organizations.count({ where: { passwordHash: Not(UNSET_PASSWORD_HASH) } });
  }

  findByLogin(login: string): Promise<OrganizationEntity | null> {
    return this.organizations.findOneBy({ login });
  }

  /** The other direction of the link: which organization publishes as this organizer user. */
  findByOrganizerUserId(organizerUserId: string): Promise<OrganizationEntity | null> {
    return this.organizations.findOneBy({ organizerUserId });
  }

  /** null when the id is not an organization, so callers can fall back to treating it as a user id. */
  async organizerUserIdOf(organizationId: string): Promise<string | null> {
    const organization = await this.organizations.findOneBy({ id: organizationId });
    return organization?.organizerUserId ?? null;
  }

  async linkOrganizerUser(organization: OrganizationEntity, organizerUserId: string): Promise<OrganizationEntity> {
    if (organization.organizerUserId === organizerUserId) return organization;
    organization.organizerUserId = organizerUserId;
    return this.organizations.save(organization);
  }

  /** Keeps the hash format inside this module: callers hold the row, never the stored string. */
  verifyPassword(organization: OrganizationEntity, password: string): Promise<boolean> {
    return verifyPassword(password, organization.passwordHash);
  }

  /** The one writer of passwordHash, so every path stores the same scrypt format. */
  async setPassword(organization: OrganizationEntity, password: string): Promise<OrganizationEntity> {
    organization.passwordHash = await hashPassword(password);
    return this.organizations.save(organization);
  }

  /**
   * Create the account for admin-supplied credentials (env or seed). Self-registration is a NonGoal of
   * C-ORGANIZER-SPACE, so this is only ever called with credentials the operator already controls.
   */
  async provision(input: { login: string; password: string; name?: string; contacts?: string | null }): Promise<OrganizationEntity> {
    return this.insert(input, await hashPassword(input.password));
  }

  /**
   * The account the seed publishes its catalog under. It owns content immediately but nobody can log
   * into it until the operator's env pair claims it or `org:password` sets one — a seed that shipped a
   * known password would be a panel login anyone could read off GitHub.
   */
  async provisionWithoutPassword(input: { login: string; name?: string; contacts?: string | null }): Promise<OrganizationEntity> {
    return this.insert(input, UNSET_PASSWORD_HASH);
  }

  private async insert(input: { login: string; name?: string; contacts?: string | null }, passwordHash: string): Promise<OrganizationEntity> {
    const draft = this.organizations.create({
      login: input.login,
      name: input.name ?? input.login,
      contacts: input.contacts ?? null,
      passwordHash,
    });
    try {
      return await this.organizations.save(draft);
    } catch (error) {
      // UQ_organizations_login: a concurrent first login won the insert; read the winner back.
      if (!isUniqueViolation(error)) throw error;
      const winner = await this.findByLogin(input.login);
      if (!winner) throw error;
      return winner;
    }
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof QueryFailedError && error.driverError?.code === "23505";
}

export function toOrganizationDto(row: OrganizationEntity): Organization {
  return { id: row.id, name: row.name, contacts: row.contacts };
}
