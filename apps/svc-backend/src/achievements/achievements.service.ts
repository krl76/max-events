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

import { ForbiddenException, Inject, Injectable, OnModuleInit, Optional } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { Achievement, AchievementCode, VisitStats } from "@max-events/api-contracts";
import { CheckInsService } from "../checkins/check-ins.service";
import { writeInbox } from "../smart-alerts/deliver-invite";
import { NotificationEntity } from "../smart-alerts/notification.entity";
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

const ACHIEVEMENT_FACE: Record<AchievementCode, { title: string; one: string; few: string; many: string }> = {
  city_explorer: { title: "Исследователь города", one: "место", few: "места", many: "мест" },
  music_fan: { title: "Меломан", one: "концерт", few: "концерта", many: "концертов" },
  weekend_city: { title: "Город на выходных", one: "район", few: "района", many: "районов" },
  volunteer: { title: "Волонтёр", one: "акция", few: "акции", many: "акций" },
};

function pluralRu(count: number, one: string, few: string, many: string): string {
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return many;
  if (n1 === 1) return one;
  if (n1 > 1 && n1 < 5) return few;
  return many;
}

/** Bell line only. A MAX DM would ping for something that can wait until the app is open. */
export function achievementInboxLine(code: AchievementCode, progress: number, threshold: number): string {
  const face = ACHIEVEMENT_FACE[code];
  if (progress >= threshold) return `${face.title} — получено`;
  const left = Math.max(threshold - progress, 0);
  return `${face.title} — осталось ${left} ${pluralRu(left, face.one, face.few, face.many)}`;
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
export class AchievementsService implements OnModuleInit {
  constructor(
    @InjectRepository(UserAchievementEntity) private readonly grants: Repository<UserAchievementEntity>,
    @Inject(CheckInsService) private readonly checkIns: CheckInsService,
    @Optional() @InjectRepository(NotificationEntity) private readonly notices?: Repository<NotificationEntity>,
  ) {}

  onModuleInit(): void {
    this.checkIns.setProgressHook((userId, before) => this.noteProgress(userId, before));
  }

  /** Inbox row when a new «Я здесь» moves a counter. No bot message. */
  async noteProgress(userId: string, before: VisitStats): Promise<void> {
    const after = await this.checkIns.stats(userId, userId);
    const rows = await this.grants.find({ where: { userId } });
    const existing = new Map(rows.map((row) => [row.code, row.grantedAt]));
    const previous = new Map(achievementsFromStats(before, existing).map((item) => [item.code, item.progress]));
    for (const item of achievementsFromStats(after, existing)) {
      if (item.progress <= (previous.get(item.code) ?? 0)) continue;
      if (item.progress >= item.threshold && !existing.has(item.code)) {
        const grantedAt = new Date();
        await this.grants.save(this.grants.create({ userId, code: item.code, grantedAt }));
        existing.set(item.code, grantedAt);
      }
      await writeInbox(this.notices, {
        userId,
        type: "achievement",
        actorUserId: null,
        title: achievementInboxLine(item.code, item.progress, item.threshold),
        body: "",
        link: { target: "achievements", id: null },
      });
    }
  }

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
