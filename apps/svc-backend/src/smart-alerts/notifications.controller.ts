// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for the in-app notifications inbox.
// SCOPE: GET /notifications, GET /notifications/summary, POST /notifications/:id/read, POST /notifications/read-all, POST /notifications/:id/answer.
// DEPENDS: @nestjs/common, @max-events/api-contracts, ../auth/auth.guard, ./notifications.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - NotificationsController - inbox list, summary, read, answer
// END_MODULE_MAP

import { BadRequestException, Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { AnswerNotificationWriteSchema, type AppNotification, type NotificationsSummary } from "@max-events/api-contracts";
import { CurrentUser } from "../auth/auth.guard";
import { UserEntity } from "../users/user.entity";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
export class NotificationsController {
  constructor(@Inject(NotificationsService) private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: UserEntity): Promise<AppNotification[]> {
    return this.notifications.list(user.id);
  }

  @Get("summary")
  summary(@CurrentUser() user: UserEntity): Promise<NotificationsSummary> {
    return this.notifications.summary(user.id);
  }

  @Post("read-all")
  markAllRead(@CurrentUser() user: UserEntity): Promise<NotificationsSummary> {
    return this.notifications.markAllRead(user.id);
  }

  @Post(":id/read")
  markRead(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string): Promise<AppNotification> {
    return this.notifications.markRead(user.id, id);
  }

  @Post(":id/answer")
  async answer(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown): Promise<AppNotification> {
    const parsed = AnswerNotificationWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid notification payload");
    return this.notifications.answer(user.id, id, parsed.data.actionId);
  }
}
