// START_MODULE_CONTRACT
// PURPOSE: In-app notifications inbox — list, unread count, mark read, answer a decision.
// SCOPE: GET/POST surface for the current user; identity from CurrentUser, not a body userId.
// DEPENDS: @nestjs/common, @nestjs/typeorm, typeorm, @max-events/api-contracts, ../friends, ../users, ./notification.entity
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - NotificationsService - list, summary, markRead, markAllRead, answer
// END_MODULE_MAP

import { Inject, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { AppNotification, NotificationsSummary } from "@max-events/api-contracts";
import { toFriendDto } from "../friends/friends.service";
import { GatheringsService } from "../gatherings/gatherings.service";
import { MicroEventsService } from "../microevents/micro-events.service";
import { PlansService } from "../plans/plans.service";
import { UsersService } from "../users/users.service";
import { WaitlistService } from "../waitlist/waitlist.service";
import { NotificationEntity } from "./notification.entity";

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(NotificationEntity) private readonly rows: Repository<NotificationEntity>,
    @Inject(UsersService) private readonly users: UsersService,
    @Optional() @Inject(PlansService) private readonly plans?: PlansService,
    @Optional() @Inject(GatheringsService) private readonly gatherings?: GatheringsService,
    @Optional() @Inject(MicroEventsService) private readonly micros?: MicroEventsService,
    @Optional() @Inject(WaitlistService) private readonly waitlist?: WaitlistService,
  ) {}

  async list(userId: string): Promise<AppNotification[]> {
    const rows = (await this.rows.find({ where: { userId } })).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id));
    return this.toDtos(rows);
  }

  async summary(userId: string): Promise<NotificationsSummary> {
    const rows = await this.rows.find({ where: { userId } });
    return { unreadCount: rows.filter((row) => row.readAt === null).length };
  }

  async markRead(userId: string, id: string, now = new Date()): Promise<AppNotification> {
    const row = await this.requireOwn(userId, id);
    if (row.readAt === null) {
      row.readAt = now;
      await this.rows.save(row);
    }
    return (await this.toDtos([row]))[0]!;
  }

  async markAllRead(userId: string, now = new Date()): Promise<NotificationsSummary> {
    const unread = (await this.rows.find({ where: { userId } })).filter((row) => row.readAt === null);
    for (const row of unread) {
      row.readAt = now;
      await this.rows.save(row);
    }
    return { unreadCount: 0 };
  }

  async answer(userId: string, id: string, actionId: string, now = new Date()): Promise<AppNotification> {
    const row = await this.requireOwn(userId, id);
    if (!row.actions.some((action) => action.id === actionId)) throw new NotFoundException("Notification action not found");
    if (row.answeredActionId === null) {
      await this.perform(userId, row, actionId);
      row.answeredActionId = actionId;
      row.readAt ??= now;
      await this.rows.save(row);
    }
    return (await this.toDtos([row]))[0]!;
  }

  /** «Пойду» records the real plan, gathering, or micro response. A seat offer confirms or declines the waitlist row. */
  private async perform(userId: string, row: NotificationEntity, actionId: string): Promise<void> {
    const id = row.link?.id;
    if (row.type === "plan-invite" && row.link?.target === "plan" && id && this.plans) {
      if (actionId === "going") await this.plans.respond(userId, id, "confirmed");
      if (actionId === "decline") await this.plans.respond(userId, id, "declined");
    }
    if (row.type === "gathering-invite" && row.link?.target === "gathering" && id && this.gatherings) {
      if (actionId === "going") await this.gatherings.respond(userId, id, "accepted");
      if (actionId === "decline") await this.gatherings.respond(userId, id, "busy");
    }
    if (row.type === "micro-invite" && row.link?.target === "micro" && id && this.micros && actionId === "going") {
      await this.micros.join(userId, id);
    }
    if (row.type === "seat-freed" && this.waitlist) {
      if (actionId.startsWith("confirm:")) await this.waitlist.confirm(userId, actionId.slice("confirm:".length));
      if (actionId.startsWith("decline:")) await this.waitlist.decline(userId, actionId.slice("decline:".length));
    }
  }

  private async requireOwn(userId: string, id: string): Promise<NotificationEntity> {
    const row = await this.rows.findOneBy({ id, userId });
    if (!row) throw new NotFoundException("Notification not found");
    return row;
  }

  private async toDtos(rows: NotificationEntity[]): Promise<AppNotification[]> {
    const actors = await this.users.findByIds(rows.flatMap((row) => (row.actorUserId ? [row.actorUserId] : [])));
    const byId = new Map(actors.map((row) => [row.id, row]));
    return rows.map((row) => {
      const actor = row.actorUserId ? byId.get(row.actorUserId) : undefined;
      return {
        id: row.id,
        type: row.type,
        actor: actor ? toFriendDto(actor) : null,
        title: row.title,
        body: row.body,
        quote: row.quote,
        createdAt: row.createdAt.toISOString(),
        readAt: row.readAt ? row.readAt.toISOString() : null,
        link: row.link,
        actions: row.actions ?? [],
        deadlineAt: row.deadlineAt ? row.deadlineAt.toISOString() : null,
        answeredActionId: row.answeredActionId,
        urgent: row.urgent,
      };
    });
  }
}
