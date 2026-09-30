// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring the "Where to go?" suggestion feature.
// SCOPE: Registers WheretoService and WheretoController; imports EventsModule; exports WheretoService for the bot.
// DEPENDS: ../events/events.module, ./whereto.service, ./whereto.controller
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - WheretoModule - provides and exports WheretoService, provides WheretoController
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { EventsModule } from "../events/events.module";
import { UsersModule } from "../users/users.module";
import { WheretoController } from "./whereto.controller";
import { WheretoService } from "./whereto.service";

@Module({
  imports: [EventsModule, UsersModule],
  controllers: [WheretoController],
  providers: [WheretoService],
  exports: [WheretoService],
})
export class WheretoModule {}
