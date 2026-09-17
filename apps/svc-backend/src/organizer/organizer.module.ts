// START_MODULE_CONTRACT
// PURPOSE: Nest module for the organizer panel HTTP.
// SCOPE: OrganizerController; imports EventsModule and PlacesModule.
// DEPENDS: ../events/events.module, ../places/places.module
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - OrganizerModule - organizer panel
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { EventsModule } from "../events/events.module";
import { PlacesModule } from "../places/places.module";
import { PromoModule } from "../promo/promo.module";
import { OrganizerController } from "./organizer.controller";

@Module({
  imports: [EventsModule, PlacesModule, PromoModule],
  controllers: [OrganizerController],
})
export class OrganizerModule {}
