// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for the organizer panel — own events/places including drafts, publish.
// SCOPE: GET /organizer/events, GET /organizer/places, POST create draft, POST publish.
// DEPENDS: @nestjs/common, ../events, ../places, ../auth
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - OrganizerController - mine lists, draft create, publish
// END_MODULE_MAP

import { BadRequestException, Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { CreateEventSchema, CreatePlaceSchema, type Event, type Place } from "@max-events/api-contracts";
import { CurrentUser } from "../auth/auth.guard";
import { EventsService } from "../events/events.service";
import { PlacesService } from "../places/places.service";
import { UserEntity } from "../users/user.entity";

@Controller("organizer")
export class OrganizerController {
  constructor(
    @Inject(EventsService) private readonly events: EventsService,
    @Inject(PlacesService) private readonly places: PlacesService,
  ) {}

  @Get("events")
  listEvents(@CurrentUser() user: UserEntity): Promise<Event[]> {
    return this.events.listMine(user.id);
  }

  @Post("events")
  async createEventDraft(@CurrentUser() user: UserEntity, @Body() body: unknown): Promise<Event> {
    const parsed = CreateEventSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid event payload");
    return this.events.create(parsed.data, user.id, { draft: true });
  }

  @Post("events/:id/publish")
  publishEvent(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string): Promise<Event> {
    return this.events.publish(id, user.id);
  }

  @Get("places")
  listPlaces(@CurrentUser() user: UserEntity): Promise<Place[]> {
    return this.places.listMine(user.id);
  }

  @Post("places")
  async createPlaceDraft(@CurrentUser() user: UserEntity, @Body() body: unknown): Promise<Place> {
    const parsed = CreatePlaceSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid place payload");
    return this.places.create(parsed.data, user.id, { draft: true });
  }

  @Post("places/:id/publish")
  publishPlace(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string): Promise<Place> {
    return this.places.publish(id, user.id);
  }
}
