// START_MODULE_CONTRACT
// PURPOSE: Due-soon booking reminders — select a time window, send one MAX DM, mark reminderSentAt.
// SCOPE: tick(now) processes active bookings whose event starts in [now, now+window); bot failure skips without aborting.
// DEPENDS: @nestjs/common, @nestjs/typeorm, typeorm, ../max-bot/max-bot.client, bookings/events/users entities
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - RemindersService - tick() reminder cycle
// - isInReminderWindow - startsAt in [now, now+window)
// - formatReminderText - DM body
// END_MODULE_MAP

import { Inject, Injectable, Logger } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { BookingEntity } from "../bookings/booking.entity";
import { EventEntity } from "../events/event.entity";
import { MaxBotClient } from "../max-bot/max-bot.client";
import { UserEntity } from "../users/user.entity";

export const DEFAULT_REMINDER_WINDOW_MS = 2 * 60 * 60 * 1000;

export function isInReminderWindow(startsAt: Date, now: Date, windowMs = DEFAULT_REMINDER_WINDOW_MS): boolean {
  const t = startsAt.getTime();
  const from = now.getTime();
  return t >= from && t < from + windowMs;
}

export function formatReminderText(title: string, startsAt: Date): string {
  return `Напоминание: «${title}» начнётся ${startsAt.toISOString()}`;
}

export type ReminderTickResult = { sent: number; failed: number };

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    @InjectRepository(BookingEntity) private readonly bookings: Repository<BookingEntity>,
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(MaxBotClient) private readonly bot: MaxBotClient,
  ) {}

  async tick(now = new Date(), windowMs = DEFAULT_REMINDER_WINDOW_MS): Promise<ReminderTickResult> {
    const result: ReminderTickResult = { sent: 0, failed: 0 };
    const active = await this.bookings.find({ where: { status: "active" } });
    for (const booking of active) {
      if (booking.reminderSentAt) continue;
      const event = await this.events.findOneBy({ id: booking.eventId });
      if (!event || !isInReminderWindow(event.startsAt, now, windowMs)) continue;
      const delivered = await this.deliver(booking.id, event, now);
      if (delivered) result.sent += 1;
      else result.failed += 1;
    }
    return result;
  }

  private async deliver(bookingId: string, event: EventEntity, now: Date): Promise<boolean> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const locked = await manager.findOne(BookingEntity, { where: { id: bookingId }, lock: { mode: "pessimistic_write" } });
        if (!locked || locked.status !== "active" || locked.reminderSentAt) return false;
        const user = await manager.findOne(UserEntity, { where: { id: locked.userId } });
        if (!user) return false;
        let ok = false;
        try {
          ok = await this.bot.sendMessage(user.maxUserId, formatReminderText(event.title, event.startsAt));
        } catch {
          ok = false;
        }
        if (!ok) {
          this.logger.warn(`Reminder send failed for booking ${bookingId}`);
          return false;
        }
        locked.reminderSentAt = now;
        await manager.save(BookingEntity, locked);
        return true;
      });
    } catch {
      this.logger.warn(`Reminder tick skipped booking ${bookingId}`);
      return false;
    }
  }
}
