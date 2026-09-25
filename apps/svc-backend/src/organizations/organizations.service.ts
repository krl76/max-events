// START_MODULE_CONTRACT
// PURPOSE: Organization accounts — credential verification for the organizer panel and the admin-provisioned row behind it.
// SCOPE: findByLogin, findByOrganizerUserId, verifyPassword (scrypt), setPassword, provision and provisionWithoutPassword (admin bootstrap from operator credentials or from the seed, never self-service); GET/PATCH/complete of /organizer/setup (экран 44).
// DEPENDS: @nestjs/common, @nestjs/typeorm, typeorm, @max-events/api-contracts, ./organization.entity, ./password
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - OrganizationsService - count, countWithPassword, findByLogin, findByOrganizerUserId, findByOrganizerUserIds, organizerUserIdOf, linkOrganizerUser, verifyPassword, setPassword, provision, provisionWithoutPassword, getSetup, updateSetup, completeSetup
// - toOrganizationDto - entity to the Organization contract (never carries the password hash)
// - toSetupDto - entity to the OrganizerSetup contract
// END_MODULE_MAP

import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Not, QueryFailedError, Repository } from "typeorm";
import { ORGANIZER_ACTIVITIES, ORGANIZER_PAYOUT_MODES, ORGANIZER_SETUP_STEPS, type Organization, type OrganizerActivity, type OrganizerPayoutMode, type OrganizerSetup, type OrganizerSetupStep, type UpdateOrganizerSetup } from "@max-events/api-contracts";
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

  /** Same link, resolved for a whole list at once, so a caller does not pay one query per row. */
  findByOrganizerUserIds(organizerUserIds: string[]): Promise<OrganizationEntity[]> {
    if (organizerUserIds.length === 0) return Promise.resolve([]);
    return this.organizations.find({ where: { organizerUserId: In(organizerUserIds) } });
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
    const name = input.name ?? input.login;
    const draft = this.organizations.create({
      login: input.login,
      name,
      contacts: input.contacts ?? null,
      passwordHash,
      setupStep: "venue",
      setupCompletedAt: null,
      activities: [],
      venuePlaceId: null,
      venueTitle: name,
      venueAddress: "",
      venueCity: "",
      payoutMode: "none",
      paymentUrl: null,
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

  async getSetup(organizerUserId: string): Promise<OrganizerSetup> {
    return toSetupDto(await this.requireByOrganizerUserId(organizerUserId));
  }

  async updateSetup(organizerUserId: string, patch: UpdateOrganizerSetup): Promise<OrganizerSetup> {
    const organization = await this.requireByOrganizerUserId(organizerUserId);
    if (patch.step !== undefined) organization.setupStep = patch.step;
    if (patch.activities !== undefined) organization.activities = uniqueActivities(patch.activities);
    if (patch.venue !== undefined) applyVenuePatch(organization, patch.venue);
    if (patch.payouts !== undefined) applyPayoutsPatch(organization, patch.payouts);
    try {
      return toSetupDto(await this.organizations.save(organization));
    } catch (error) {
      if (isForeignKeyViolation(error)) throw new BadRequestException("Invalid organizer setup");
      throw error;
    }
  }

  async completeSetup(organizerUserId: string, now = new Date()): Promise<OrganizerSetup> {
    const organization = await this.requireByOrganizerUserId(organizerUserId);
    if (organization.setupCompletedAt === null) {
      organization.setupCompletedAt = now;
      organization.setupStep = "event";
      await this.organizations.save(organization);
    }
    return toSetupDto(organization);
  }

  private async requireByOrganizerUserId(organizerUserId: string): Promise<OrganizationEntity> {
    const organization = await this.findByOrganizerUserId(organizerUserId);
    if (!organization) throw new NotFoundException("Organization not found");
    return organization;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof QueryFailedError && error.driverError?.code === "23505";
}

function isForeignKeyViolation(error: unknown): boolean {
  return error instanceof QueryFailedError && error.driverError?.code === "23503";
}

function uniqueActivities(activities: OrganizerActivity[]): OrganizerActivity[] {
  return [...new Set(activities)];
}

function applyVenuePatch(organization: OrganizationEntity, venue: NonNullable<UpdateOrganizerSetup["venue"]>): void {
  if (venue.placeId !== undefined) organization.venuePlaceId = venue.placeId;
  if (venue.title !== undefined) {
    const title = venue.title.trim();
    if (title === "") {
      // The setup screen always PATCHes the current venue card. A blank first-run title must not
      // 400 before activities/contacts are stored; wiping a stored name still fails.
      if ((organization.venueTitle ?? "").trim() !== "") throw new BadRequestException("Invalid organizer setup");
    } else {
      organization.venueTitle = title;
      organization.name = title;
    }
  }
  if (venue.address !== undefined) organization.venueAddress = venue.address.trim();
  if (venue.city !== undefined) organization.venueCity = venue.city.trim();
}

function applyPayoutsPatch(organization: OrganizationEntity, payouts: NonNullable<UpdateOrganizerSetup["payouts"]>): void {
  const mode = payouts.mode ?? readPayoutMode(organization.payoutMode);
  const paymentUrl = payouts.paymentUrl !== undefined ? payouts.paymentUrl : organization.paymentUrl;
  if (mode === "external" && (paymentUrl === null || !isHttpUrl(paymentUrl))) {
    throw new BadRequestException("Invalid organizer setup");
  }
  organization.payoutMode = mode;
  organization.paymentUrl = mode === "none" ? null : paymentUrl;
  if (payouts.contacts !== undefined) organization.contacts = payouts.contacts === "" ? null : payouts.contacts;
}

function isHttpUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function readSetupStep(value: unknown): OrganizerSetupStep {
  return typeof value === "string" && ORGANIZER_SETUP_STEPS.includes(value as OrganizerSetupStep) ? (value as OrganizerSetupStep) : "venue";
}

function readPayoutMode(value: unknown): OrganizerPayoutMode {
  return typeof value === "string" && ORGANIZER_PAYOUT_MODES.includes(value as OrganizerPayoutMode) ? (value as OrganizerPayoutMode) : "none";
}

function readActivities(value: unknown): OrganizerActivity[] {
  if (!Array.isArray(value)) return [];
  return uniqueActivities(value.filter((item): item is OrganizerActivity => typeof item === "string" && ORGANIZER_ACTIVITIES.includes(item as OrganizerActivity)));
}

export function toOrganizationDto(row: OrganizationEntity): Organization {
  return { id: row.id, name: row.name, contacts: row.contacts, activities: readActivities(row.activities) };
}

export function toSetupDto(row: OrganizationEntity): OrganizerSetup {
  return {
    organizationId: row.id,
    step: readSetupStep(row.setupStep),
    completedAt: row.setupCompletedAt ? row.setupCompletedAt.toISOString() : null,
    venue: {
      placeId: row.venuePlaceId ?? null,
      title: (row.venueTitle && row.venueTitle.trim()) || row.name,
      address: row.venueAddress ?? "",
      city: row.venueCity ?? "",
    },
    activities: readActivities(row.activities),
    payouts: {
      mode: readPayoutMode(row.payoutMode),
      paymentUrl: row.paymentUrl ?? null,
      contacts: row.contacts,
    },
  };
}
