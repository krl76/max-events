// START_MODULE_CONTRACT
// PURPOSE: Friend availability for an event window, gathering create/respond, unanswered-invitee reminders.
// SCOPE: Overlap of active bookings vs event window; createChat + DMs best-effort; considering+null respondedAt until PATCH.
// DEPENDS: @nestjs/common, @nestjs/typeorm, typeorm, @max-events/api-contracts, bookings/events/friends/users/max-bot
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - eventWindow / windowsOverlap - booking vs gathering event overlap
// - windowsOverlap - closed interval overlap
// - GatheringRemindResult - sent/failed counts
// - formatGatheringInviteText - invite DM body
// - formatGatheringReminderText - reminder DM body
// - availabilityOf - free/busy/unknown for one friend
// - GatheringsService - availability, create, get, respond, remindUnanswered
// END_MODULE_MAP

import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { QueryFailedError, Repository } from "typeorm";
import type { CreateGathering, FriendAvailability, Gathering, InviteeResponse } from "@max-events/api-contracts";
import { BookingEntity } from "../bookings/booking.entity";
import { toEventDto } from "../events/events.service";
import { EventEntity } from "../events/event.entity";
import { FriendsService, toFriendDto } from "../friends/friends.service";
import { MaxBotClient } from "../max-bot/max-bot.client";
import { deliverInvite, INVITE_REPLY_ACTIONS } from "../smart-alerts/deliver-invite";
import { humanMeeting, miniappLink, withAppLink } from "../time/human-when";
import { NotificationEntity } from "../smart-alerts/notification.entity";
import { UserEntity } from "../users/user.entity";
import { GatheringInviteeEntity } from "./gathering-invitee.entity";
import { GatheringEntity } from "./gathering.entity";

const DEFAULT_EVENT_MS = 3_600_000;

export function eventWindow(event: { startsAt: Date; endsAt: Date | null }): { start: number; end: number } {
  const start = event.startsAt.getTime();
  const end = event.endsAt ? event.endsAt.getTime() : start + DEFAULT_EVENT_MS;
  return { start, end: Math.max(end, start + 1) };
}

export function windowsOverlap(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return a.start < b.end && b.start < a.end;
}

export function availabilityOf(target: { startsAt: Date; endsAt: Date | null }, bookedEvents: Array<{ startsAt: Date; endsAt: Date | null } | null>): FriendAvailability["availability"] {
  const window = eventWindow(target);
  let unknown = false;
  for (const booked of bookedEvents) {
    if (!booked) {
      unknown = true;
      continue;
    }
    if (windowsOverlap(window, eventWindow(booked))) return "busy";
  }
  return unknown ? "unknown" : "free";
}

export function formatGatheringInviteText(title: string, meetingAt: Date, chatLink: string | null, now = new Date()): string {
  const chat = chatLink ? ` Чат: ${chatLink}` : "";
  return `Тебя зовут на сбор к «${title}» ${humanMeeting(meetingAt, "", now)}.${chat}`;
}

export function formatGatheringReminderText(title: string): string {
  return `Напоминание: ты ещё не ответил на сбор к «${title}»`;
}

export type GatheringRemindResult = { sent: number; failed: number };

@Injectable()
export class GatheringsService {
  private readonly logger = new Logger(GatheringsService.name);

  constructor(
    @InjectRepository(GatheringEntity) private readonly gatherings: Repository<GatheringEntity>,
    @InjectRepository(GatheringInviteeEntity) private readonly invitees: Repository<GatheringInviteeEntity>,
    @InjectRepository(BookingEntity) private readonly bookings: Repository<BookingEntity>,
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @Inject(FriendsService) private readonly friends: FriendsService,
    @Inject(MaxBotClient) private readonly bot: MaxBotClient,
    @InjectRepository(NotificationEntity) private readonly notices?: Repository<NotificationEntity>,
  ) {}

  async availability(userId: string, eventId: string): Promise<FriendAvailability[]> {
    const event = await this.events.findOneBy({ id: eventId });
    if (!event) throw new NotFoundException("Event not found");
    const friendList = await this.friends.list(userId);
    const bookings = await this.bookings.find();
    const allEvents = await this.events.find();
    const eventById = new Map(allEvents.map((row) => [row.id, row]));
    return friendList.map((friend) => {
      const booked = bookings.filter((row) => row.userId === friend.id && row.status === "active").map((row) => eventById.get(row.eventId) ?? null);
      return { friend, availability: availabilityOf(event, booked) };
    });
  }

  async create(hostUserId: string, payload: CreateGathering): Promise<Gathering> {
    const event = await this.events.findOneBy({ id: payload.eventId });
    if (!event) throw new NotFoundException("Event not found");
    const friendIds = [...new Set(payload.friendIds)];
    if (friendIds.includes(hostUserId)) throw new BadRequestException("Invalid gathering payload");
    const allowed = await this.friends.friendIds(hostUserId);
    if (friendIds.some((id) => !allowed.has(id))) throw new BadRequestException("Invalid gathering payload");
    const meetingAt = new Date(payload.proposedMeetingAt);
    const saved = await this.gatherings.save(
      this.gatherings.create({
        hostUserId,
        eventId: event.id,
        proposedMeetingAt: meetingAt,
        status: "awaiting_responses",
        chatLink: null,
      }),
    );
    for (const userId of friendIds) {
      await this.invitees.save(this.invitees.create({ gatheringId: saved.id, userId, response: "considering", respondedAt: null, reminderSentAt: null }));
    }
    try {
      const chat = await this.bot.createChat(`Сбор: ${event.title}`);
      if (chat) {
        saved.chatLink = chat.link;
        await this.gatherings.save(saved);
      }
    } catch {
      this.logger.warn(`Gathering chat create failed for ${saved.id}`);
    }
    const inviteUsers = await this.users.find();
    for (const userId of friendIds) {
      const user = inviteUsers.find((row) => row.id === userId);
      if (!user) continue;
      const text = withAppLink(formatGatheringInviteText(event.title, meetingAt, saved.chatLink), miniappLink(`gathering-${saved.id}`));
      try {
        await deliverInvite(this.bot, this.notices, { userId: user.id, maxUserId: user.maxUserId, actorUserId: hostUserId, type: "gathering-invite", title: `Сбор к «${event.title}»`, body: text, link: { target: "gathering", id: saved.id }, actions: INVITE_REPLY_ACTIONS });
      } catch {
        this.logger.warn(`Gathering invite DM failed for ${saved.id}`);
      }
    }
    return this.toDto(saved, event);
  }

  async get(userId: string, gatheringId: string): Promise<Gathering> {
    const gathering = await this.gatherings.findOneBy({ id: gatheringId });
    if (!gathering) throw new NotFoundException("Gathering not found");
    await this.admit(userId, gathering);
    const invitees = await this.invitees.find({ where: { gatheringId } });
    const event = await this.events.findOneBy({ id: gathering.eventId });
    if (!event) throw new NotFoundException("Event not found");
    return this.toDto(gathering, event, invitees);
  }

  async respond(userId: string, gatheringId: string, response: InviteeResponse): Promise<Gathering> {
    const gathering = await this.gatherings.findOneBy({ id: gatheringId });
    if (!gathering) throw new NotFoundException("Gathering not found");
    await this.admit(userId, gathering);
    const invitee = (await this.invitees.find({ where: { gatheringId } })).find((row) => row.userId === userId);
    if (!invitee) throw new ForbiddenException("Cannot respond to this gathering");
    invitee.response = response;
    invitee.respondedAt = new Date();
    await this.invitees.save(invitee);
    const event = await this.events.findOneBy({ id: gathering.eventId });
    if (!event) throw new NotFoundException("Event not found");
    return this.toDto(gathering, event);
  }

  async remindUnanswered(): Promise<GatheringRemindResult> {
    const result: GatheringRemindResult = { sent: 0, failed: 0 };
    const rows = await this.invitees.find();
    const gatherings = await this.gatherings.find();
    const events = await this.events.find();
    const users = await this.users.find();
    for (const invitee of rows) {
      if (invitee.respondedAt || invitee.reminderSentAt) continue;
      const gathering = gatherings.find((row) => row.id === invitee.gatheringId);
      const event = gathering ? events.find((row) => row.id === gathering.eventId) : undefined;
      const user = users.find((row) => row.id === invitee.userId);
      if (!gathering || !event || !user) {
        result.failed += 1;
        continue;
      }
      let ok = false;
      try {
        ok = await this.bot.sendMessage(user.maxUserId, formatGatheringReminderText(event.title));
      } catch {
        ok = false;
      }
      if (!ok) {
        this.logger.warn(`Gathering reminder failed for invitee ${invitee.id}`);
        result.failed += 1;
        continue;
      }
      invitee.reminderSentAt = new Date();
      await this.invitees.save(invitee);
      result.sent += 1;
    }
    return result;
  }

  /** Opening a shared gathering-{id} link is the invite: the viewer joins as accepted. */
  private async admit(userId: string, gathering: GatheringEntity): Promise<void> {
    if (gathering.hostUserId === userId) return;
    const rows = await this.invitees.find({ where: { gatheringId: gathering.id } });
    if (rows.some((row) => row.userId === userId)) return;
    try {
      await this.invitees.save(this.invitees.create({ gatheringId: gathering.id, userId, response: "accepted", respondedAt: new Date(), reminderSentAt: null }));
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }

  private async toDto(gathering: GatheringEntity, event: EventEntity, inviteeRows?: GatheringInviteeEntity[]): Promise<Gathering> {
    const rows = inviteeRows ?? (await this.invitees.find({ where: { gatheringId: gathering.id } }));
    const users = await this.users.find();
    const userById = new Map(users.map((row) => [row.id, row]));
    return {
      id: gathering.id,
      event: toEventDto(event),
      invitees: rows.flatMap((row) => {
        const user = userById.get(row.userId);
        return user ? [{ friend: toFriendDto(user), response: row.response }] : [];
      }),
      proposedMeetingAt: gathering.proposedMeetingAt.toISOString(),
      status: gathering.status,
      chatLink: gathering.chatLink,
      createdAt: gathering.createdAt.toISOString(),
      updatedAt: gathering.updatedAt.toISOString(),
    };
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof QueryFailedError && error.driverError?.code === "23505";
}
