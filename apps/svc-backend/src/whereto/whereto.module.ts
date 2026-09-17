// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring the "Where to go?" suggestion feature.
// SCOPE: Registers WheretoService and WheretoController; imports EventsModule.
// DEPENDS: ../events/events.module, ./whereto.service, ./whereto.controller
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - WheretoModule - provides WheretoService and WheretoController
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { EventsModule } from "../events/events.module";
import { WheretoController } from "./whereto.controller";
import { WheretoService } from "./whereto.service";

@Module({
  imports: [EventsModule],
  controllers: [WheretoController],
  providers: [WheretoService],
})
export class WheretoModule {}
