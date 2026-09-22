// START_MODULE_CONTRACT
// PURPOSE: Organization accounts — credential verification for the organizer panel and the admin-provisioned row behind it.
// SCOPE: findByLogin, verifyPassword (scrypt), provision (admin bootstrap from operator credentials, never self-service); no endpoint of its own.
// DEPENDS: @nestjs/common, @nestjs/typeorm, typeorm, @max-events/api-contracts, ./organization.entity, ./password
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - OrganizationsService - findByLogin, verifyPassword, provision
// - toOrganizationDto - entity to the Organization contract (never carries the password hash)
// END_MODULE_MAP

import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { QueryFailedError, Repository } from "typeorm";
import type { Organization } from "@max-events/api-contracts";
import { OrganizationEntity } from "./organization.entity";
import { hashPassword, verifyPassword } from "./password";

@Injectable()
export class OrganizationsService {
  constructor(@InjectRepository(OrganizationEntity) private readonly organizations: Repository<OrganizationEntity>) {}

  findByLogin(login: string): Promise<OrganizationEntity | null> {
    return this.organizations.findOneBy({ login });
  }

  /** Keeps the hash format inside this module: callers hold the row, never the stored string. */
  verifyPassword(organization: OrganizationEntity, password: string): Promise<boolean> {
    return verifyPassword(password, organization.passwordHash);
  }

  /**
   * Create the account for admin-supplied credentials (env or seed). Self-registration is a NonGoal of
   * C-ORGANIZER-SPACE, so this is only ever called with credentials the operator already controls.
   */
  async provision(input: { login: string; password: string; name?: string; contacts?: string | null }): Promise<OrganizationEntity> {
    const draft = this.organizations.create({
      login: input.login,
      name: input.name ?? input.login,
      contacts: input.contacts ?? null,
      passwordHash: await hashPassword(input.password),
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
