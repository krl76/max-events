// START_MODULE_CONTRACT
// PURPOSE: Achievement catalog from visit stats, with persisted first-time grants.
// SCOPE: Four README codes (10 мест / 5 концертов / 3 района / 5 акций); progress capped at threshold; grantedAt stored once on user_achievements.
// DEPENDS: @nestjs/common, @nestjs/typeorm, typeorm, @max-events/api-contracts, ../checkins/check-ins.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ACHIEVEMENT_CATALOG - code, title, threshold, metric
// - AchievementMetric - catalog metric discriminator
// - metricValue - resolve a metric from visit stats
// - achievementsFromStats - derive progress and apply existing grants
// - AchievementsService - list for CurrentUser, persist new grants
// END_MODULE_MAP

import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { Achievement, AchievementCode, VisitStats } from "@max-events/api-contracts";
import { CheckInsService } from "../checkins/check-ins.service";
import { UserAchievementEntity } from "./user-achievement.entity";

export type AchievementMetric = "places" | "districts" | "afisha" | "volunteering";

export const ACHIEVEMENT_CATALOG: Array<{ code: AchievementCode; title: string; threshold: number; metric: AchievementMetric }> = [
  { code: "city_explorer", title: "Исследователь города", threshold: 10, metric: "places" },
  { code: "music_fan", title: "Музыкальный фанат", threshold: 5, metric: "afisha" },
  // README: «Город за выходные» is three districts, not three places.
  { code: "weekend_city", title: "Город за выходные", threshold: 3, metric: "districts" },
  { code: "volunteer", title: "Волонтёр", threshold: 5, metric: "volunteering" },
];

export function metricValue(stats: VisitStats, metric: AchievementMetric): number {
  if (metric === "places") return stats.placesCount;
  if (metric === "districts") return stats.districtsCount;
  return stats.byCategory.find((row) => row.category === metric)?.count ?? 0;
}

export function achievementsFromStats(stats: VisitStats, grants: Map<AchievementCode, Date>): Achievement[] {
  return ACHIEVEMENT_CATALOG.map((item) => {
    const grantedAt = grants.get(item.code);
    return {
      code: item.code,
      title: item.title,
      threshold: item.threshold,
      progress: Math.min(metricValue(stats, item.metric), item.threshold),
      grantedAt: grantedAt ? grantedAt.toISOString() : null,
    };
  });
}

@Injectable()
export class AchievementsService {
  constructor(
    @InjectRepository(UserAchievementEntity) private readonly grants: Repository<UserAchievementEntity>,
    @Inject(CheckInsService) private readonly checkIns: CheckInsService,
  ) {}

  async list(userId: string, requesterId: string, now = new Date()): Promise<Achievement[]> {
    if (userId !== requesterId) throw new ForbiddenException("Cannot read another user's achievements");
    const stats = await this.checkIns.stats(userId, requesterId);
    const rows = await this.grants.find({ where: { userId } });
    const existing = new Map(rows.map((row) => [row.code, row.grantedAt]));
    const catalog = achievementsFromStats(stats, existing);
    for (const item of catalog) {
      if (item.progress < item.threshold || existing.has(item.code)) continue;
      await this.grants.save(this.grants.create({ userId, code: item.code, grantedAt: now }));
      item.grantedAt = now.toISOString();
    }
    return catalog;
  }
}
