// START_MODULE_CONTRACT
// PURPOSE: In-app notifications inbox — list, unread count, mark read, answer a decision.
// SCOPE: GET/POST surface for the current user; identity from CurrentUser, not a body userId.
// DEPENDS: @nestjs/common, @nestjs/typeorm, typeorm, @max-events/api-contracts, ../friends, ../users, ./notification.entity
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - NotificationsService - list, summary, markRead, markAllRead, answer
// - toNotificationDto - entity plus optional actor Friend
// END_MODULE_MAP

import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { AppNotification, NotificationsSummary } from "@max-events/api-contracts";
import { toFriendDto } from "../friends/friends.service";
import { UsersService } from "../users/users.service";
import { NotificationEntity } from "./notification.entity";

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(NotificationEntity) private readonly rows: Repository<NotificationEntity>,
    @Inject(UsersService) private readonly users: UsersService,
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
      row.answeredActionId = actionId;
      row.readAt ??= now;
      await this.rows.save(row);
    }
    return (await this.toDtos([row]))[0]!;
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
