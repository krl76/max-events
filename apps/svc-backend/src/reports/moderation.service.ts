// START_MODULE_CONTRACT
// PURPOSE: Moderation sanctions — unpublish event/place/feed post and ban an organizer from publishing.
// SCOPE: unpublish hides the object from public lists; banFromPublishing blocks create on events/places/feed/micro-events.
// DEPENDS: events/places/feed/users
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ModerationService - unpublish and ban
// END_MODULE_MAP

import { Inject, Injectable } from "@nestjs/common";
import type { ReportTargetType } from "@max-events/api-contracts";
import { EventsService } from "../events/events.service";
import { FeedService } from "../feed/feed.service";
import { PlacesService } from "../places/places.service";
import { UsersService } from "../users/users.service";

@Injectable()
export class ModerationService {
  constructor(
    @Inject(EventsService) private readonly events: EventsService,
    @Inject(PlacesService) private readonly places: PlacesService,
    @Inject(FeedService) private readonly feed: FeedService,
    @Inject(UsersService) private readonly users: UsersService,
  ) {}

  async unpublish(targetType: ReportTargetType, targetId: string): Promise<void> {
    if (targetType === "event") await this.events.unpublish(targetId);
    else if (targetType === "place") await this.places.unpublish(targetId);
    else await this.feed.unpublish(targetId);
  }

  async banOrganizer(userId: string): Promise<void> {
    await this.users.banFromPublishing(userId);
  }
}
