// START_MODULE_CONTRACT
// PURPOSE: Экран 18 booking-offer — waitlist people strictly ahead of the viewer, friends with an active ticket.
// SCOPE: GET /events/:id/booking-offer; unpublished/unknown events 404; waitlistAhead is 0 when the viewer is not queued.
// DEPENDS: typeorm, @max-events/api-contracts, waitlist/bookings/friendships
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - EventBookingOfferService - get(eventId, viewerId)
// END_MODULE_MAP

import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import type { EventBookingOffer, WaitlistStatus } from "@max-events/api-contracts";
import { BookingEntity } from "../bookings/booking.entity";
import { FriendshipEntity } from "../friends/friendship.entity";
import { toFriendDto } from "../friends/friends.service";
import { UserEntity } from "../users/user.entity";
import { WaitlistEntryEntity } from "../waitlist/waitlist-entry.entity";
import { EventEntity } from "./event.entity";

const QUEUE_STATUSES: WaitlistStatus[] = ["waiting", "offered"];

@Injectable()
export class EventBookingOfferService {
  constructor(
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    @InjectRepository(WaitlistEntryEntity) private readonly waitlist: Repository<WaitlistEntryEntity>,
    @InjectRepository(BookingEntity) private readonly bookings: Repository<BookingEntity>,
    @InjectRepository(FriendshipEntity) private readonly friendships: Repository<FriendshipEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
  ) {}

  async get(eventId: string, viewerId: string): Promise<EventBookingOffer> {
    const event = await this.events.findOneBy({ id: eventId });
    if (!event || event.published === false) throw new NotFoundException("Event not found");
    const [queue, edges, tickets] = await Promise.all([this.waitlist.find({ where: { eventId, status: In(QUEUE_STATUSES) }, order: { createdAt: "ASC" } }), this.friendships.find({ where: { userId: viewerId } }), this.bookings.find({ where: { eventId, status: "active" } })]);
    const mine = queue.findIndex((row) => row.userId === viewerId);
    const friendIds = new Set(edges.map((row) => row.friendUserId));
    const holderIds = [...new Set(tickets.filter((row) => friendIds.has(row.userId) && row.userId !== viewerId).map((row) => row.userId))];
    const people = holderIds.length === 0 ? [] : await this.users.find({ where: { id: In(holderIds) } });
    const userById = new Map(people.map((row) => [row.id, row]));
    return {
      waitlistAhead: mine < 0 ? 0 : mine,
      friendsWithTickets: holderIds.flatMap((id) => {
        const user = userById.get(id);
        return user ? [toFriendDto(user)] : [];
      }),
    };
  }
}
