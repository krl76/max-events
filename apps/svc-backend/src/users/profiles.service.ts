// START_MODULE_CONTRACT
// PURPOSE: Current-user profile persistence — lazy default row, PATCH of city and interests only.
// SCOPE: getOrCreate and update for Profile keyed by userId; maps to api-contracts Profile.
// DEPENDS: @nestjs/typeorm, typeorm, @max-events/api-contracts, ./profile.entity
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ProfilesService - getOrCreate/update against ProfileEntity
// - toProfileDto - map ProfileEntity to Profile
// - readAlertPrefs - merge stored toggles onto DEFAULT_SMART_ALERTS
// - readPrivacy - merge stored privacy onto DEFAULT_PRIVACY
// - DEFAULT_PROFILE_CITY - city used when a profile is first created
// END_MODULE_MAP

import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { QueryFailedError, Repository } from "typeorm";
import { DEFAULT_PRIVACY, DEFAULT_SMART_ALERTS, type PrivacySettings, type Profile, type SmartAlertSettings, type UpdateProfile } from "@max-events/api-contracts";
import { ProfileEntity } from "./profile.entity";

export const DEFAULT_PROFILE_CITY = "Москва";

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(ProfileEntity)
    private readonly profiles: Repository<ProfileEntity>,
  ) {}

  async getOrCreate(userId: string): Promise<Profile> {
    const existing = await this.profiles.findOneBy({ userId });
    if (existing) return toProfileDto(existing);
    try {
      const created = await this.profiles.save(this.profiles.create({ userId, city: DEFAULT_PROFILE_CITY, interests: [], smartAlerts: { ...DEFAULT_SMART_ALERTS }, privacy: { ...DEFAULT_PRIVACY }, recommendationsEnabled: true, bio: "", coverUrl: null }));
      return toProfileDto(created);
    } catch (error) {
      if (error instanceof QueryFailedError && error.driverError?.code === "23505") {
        return toProfileDto(await this.profiles.findOneByOrFail({ userId }));
      }
      throw error;
    }
  }

  async update(userId: string, patch: UpdateProfile): Promise<Profile> {
    const current = await this.getOrCreate(userId);
    const next = {
      city: patch.city ?? current.city,
      interests: patch.interests ?? current.interests,
      smartAlerts: { ...current.smartAlerts, ...patch.smartAlerts },
      privacy: { ...current.privacy, ...patch.privacy },
      recommendationsEnabled: patch.recommendationsEnabled ?? current.recommendationsEnabled,
      bio: patch.bio ?? current.bio,
      coverUrl: patch.coverUrl === undefined ? current.coverUrl : patch.coverUrl,
    };
    const existing = await this.profiles.findOneByOrFail({ userId });
    const saved = await this.profiles.save(this.profiles.merge(existing, next));
    return toProfileDto(saved);
  }
}

export function toProfileDto(profile: ProfileEntity): Profile {
  return {
    userId: profile.userId,
    city: profile.city,
    interests: [...profile.interests],
    smartAlerts: readAlertPrefs(profile),
    privacy: readPrivacy(profile),
    recommendationsEnabled: profile.recommendationsEnabled !== false,
    bio: profile.bio ?? "",
    coverUrl: profile.coverUrl ?? null,
  };
}

export function readAlertPrefs(profile: ProfileEntity | undefined): SmartAlertSettings {
  return { ...DEFAULT_SMART_ALERTS, ...(profile?.smartAlerts ?? {}) };
}

export function readPrivacy(profile: ProfileEntity | undefined): PrivacySettings {
  return { ...DEFAULT_PRIVACY, ...(profile?.privacy ?? {}) };
}
