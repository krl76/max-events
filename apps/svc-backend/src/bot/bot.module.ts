// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring the conversational MAX bot — the public webhook controller, the routing service, and the dev-only long-poll worker.
// SCOPE: Registers BotService, BotController and BotLongPoll; imports MaxBotModule and the feature modules whose services the bot reuses (Users, Today, Whereto, Assist, Calendar, Plans, Bookings, Waitlist, Events). BotLongPoll stays inert unless BOT_LONGPOLL=true.
// DEPENDS: @nestjs/common, ../max-bot/max-bot.module, ../users/users.module, ../today/today.module, ../whereto/whereto.module, ../assist/assist.module, ../calendar/calendar.module, ../plans/plans.module, ../bookings/bookings.module, ../waitlist/waitlist.module, ../events/events.module, ./bot.service, ./bot.controller, ./bot-longpoll
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - BotModule - provides BotService and BotLongPoll, serves the webhook through BotController
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { AssistModule } from "../assist/assist.module";
import { BookingsModule } from "../bookings/bookings.module";
import { CalendarModule } from "../calendar/calendar.module";
import { EventsModule } from "../events/events.module";
import { MaxBotModule } from "../max-bot/max-bot.module";
import { PlansModule } from "../plans/plans.module";
import { TodayModule } from "../today/today.module";
import { UsersModule } from "../users/users.module";
import { WaitlistModule } from "../waitlist/waitlist.module";
import { WheretoModule } from "../whereto/whereto.module";
import { BotLongPoll } from "./bot-longpoll";
import { BotController } from "./bot.controller";
import { BotService } from "./bot.service";

@Module({
  imports: [MaxBotModule, UsersModule, TodayModule, WheretoModule, AssistModule, CalendarModule, PlansModule, BookingsModule, WaitlistModule, EventsModule],
  controllers: [BotController],
  providers: [BotService, BotLongPoll],
})
export class BotModule {}
