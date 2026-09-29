// START_MODULE_CONTRACT
// PURPOSE: One invite reaches both the MAX bot and the in-app inbox.
// SCOPE: Best-effort. A failed DM still leaves the inbox row, and a missing inbox repo still sends the DM.
// DEPENDS: ./notification.entity, ../max-bot/max-bot.client
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT

import type { NotificationAction, NotificationLink, NotificationType } from "@max-events/api-contracts";
import type { Repository } from "typeorm";
import type { MaxBotClient } from "../max-bot/max-bot.client";
import { NotificationEntity } from "./notification.entity";

/** «Пойду» / «Не смогу» on a plan, gathering, or micro invite. A vote is a choice of events, not this pair. */
export const INVITE_REPLY_ACTIONS: NotificationAction[] = [
  { id: "going", label: "Пойду", tone: "confirm", link: null },
  { id: "decline", label: "Не смогу", tone: "secondary", link: null },
];

export type InboxWrite = {
  userId: string;
  type: NotificationType;
  actorUserId: string | null;
  title: string;
  body: string;
  link: NotificationLink | null;
  actions?: NotificationAction[];
  deadlineAt?: Date | null;
  urgent?: boolean;
  quote?: string | null;
};

/** Bell row only. Returns false when the inbox repo is not wired, so a caller can retry later. */
export async function writeInbox(notices: Repository<NotificationEntity> | undefined, input: InboxWrite): Promise<boolean> {
  if (!notices) return false;
  await notices.save(
    notices.create({
      userId: input.userId,
      type: input.type,
      actorUserId: input.actorUserId,
      title: input.title,
      body: input.body,
      quote: input.quote ?? null,
      readAt: null,
      link: input.link,
      actions: input.actions ?? [],
      deadlineAt: input.deadlineAt ?? null,
      answeredActionId: null,
      urgent: input.urgent ?? false,
    }),
  );
  return true;
}

export async function deliverInvite(bot: MaxBotClient, notices: Repository<NotificationEntity> | undefined, input: InboxWrite & { maxUserId: string }): Promise<void> {
  await writeInbox(notices, input);
  await bot.sendMessage(input.maxUserId, input.body);
}
