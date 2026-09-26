// START_MODULE_CONTRACT
// PURPOSE: One invite reaches both the MAX bot and the in-app inbox.
// SCOPE: Best-effort. A failed DM still leaves the inbox row, and a missing inbox repo still sends the DM.
// DEPENDS: ./notification.entity, ../max-bot/max-bot.client
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT

import type { NotificationLink, NotificationType } from "@max-events/api-contracts";
import type { Repository } from "typeorm";
import type { MaxBotClient } from "../max-bot/max-bot.client";
import { NotificationEntity } from "./notification.entity";

export async function deliverInvite(
  bot: MaxBotClient,
  notices: Repository<NotificationEntity> | undefined,
  input: { userId: string; maxUserId: string; actorUserId: string | null; type: NotificationType; title: string; body: string; link: NotificationLink | null },
): Promise<void> {
  if (notices) {
    await notices.save(
      notices.create({
        userId: input.userId,
        type: input.type,
        actorUserId: input.actorUserId,
        title: input.title,
        body: input.body,
        quote: null,
        readAt: null,
        link: input.link,
        actions: [],
        deadlineAt: null,
        answeredActionId: null,
        urgent: false,
      }),
    );
  }
  await bot.sendMessage(input.maxUserId, input.body);
}
