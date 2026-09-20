// START_MODULE_CONTRACT
// PURPOSE: Due-soon booking reminders — select a time window, send one MAX DM, mark reminderSentAt.
// SCOPE: tick(now) selects the window in SQL and claims each reminder with a conditional update before the DM; bot failure releases the claim without aborting the tick.
// DEPENDS: @nestjs/common, @nestjs/typeorm, typeorm, ../max-bot/max-bot.client, bookings/events/users entities
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - DEFAULT_REMINDER_WINDOW_MS - default look-ahead window
// - ReminderTickResult - sent/failed counts
// - RemindersService - tick() reminder cycle
// - isInReminderWindow - startsAt in [now, now+window)
// - formatReminderText - DM body
// END_MODULE_MAP

import { Inject, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { And, In, IsNull, LessThan, MoreThanOrEqual, Repository } from "typeorm";
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
    @Inject(MaxBotClient) private readonly bot: MaxBotClient,
  ) {}

  async tick(now = new Date(), windowMs = DEFAULT_REMINDER_WINDOW_MS): Promise<ReminderTickResult> {
    const result: ReminderTickResult = { sent: 0, failed: 0 };
    // Ask the database for the window. Reading every active booking into memory once a minute
    // grew with the whole booking table, not with the handful of events actually starting soon.
    const due = await this.events.find({ where: { startsAt: And(MoreThanOrEqual(now), LessThan(new Date(now.getTime() + windowMs))) } });
    if (due.length === 0) return result;
    const eventById = new Map(due.map((row) => [row.id, row]));
    const pending = await this.bookings.find({ where: { status: "active", reminderSentAt: IsNull(), eventId: In([...eventById.keys()]) } });
    for (const booking of pending) {
      const event = eventById.get(booking.eventId);
      if (!event) continue;
      const delivered = await this.deliver(booking, event, now);
      if (delivered) result.sent += 1;
      else result.failed += 1;
    }
    return result;
  }

  private async deliver(booking: BookingEntity, event: EventEntity, now: Date): Promise<boolean> {
    try {
      const user = await this.users.findOneBy({ id: booking.userId });
      if (!user) return false;
      // Claim the reminder with a conditional update rather than holding a row lock across the Bot
      // API call: an unreachable bot used to keep the booking locked for the whole HTTP timeout.
      const claim = await this.bookings.update({ id: booking.id, status: "active", reminderSentAt: IsNull() }, { reminderSentAt: now });
      if (!claim.affected) return false;
      let ok = false;
      try {
        ok = await this.bot.sendMessage(user.maxUserId, formatReminderText(event.title, event.startsAt));
      } catch {
        ok = false;
      }
      if (ok) return true;
      this.logger.warn(`Reminder send failed for booking ${booking.id}`);
      // Release the claim so a later tick retries while the event is still in the window.
      await this.bookings.update({ id: booking.id, reminderSentAt: now }, { reminderSentAt: null });
      return false;
    } catch {
      this.logger.warn(`Reminder tick skipped booking ${booking.id}`);
      return false;
    }
  }
}
