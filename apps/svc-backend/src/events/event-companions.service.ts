// START_MODULE_CONTRACT
// PURPOSE: Экран 23 aggregate — participation counters, friends on the event, optional gathering teaser.
// SCOPE: GET /events/:id/companions; unpublished/unknown events 404; extra companion fields stay null/0 when there is no chat, plan or interest overlap.
// DEPENDS: typeorm, @max-events/api-contracts, participations, friendships, profiles, gatherings, ./event.entity
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - EventCompanionsService - companions(eventId, viewerId)
// - GATHERING_FACE_COUNT - faces the teaser draws before «и ещё N»
// END_MODULE_MAP

import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import type { EventCompanions, ParticipationStatus } from "@max-events/api-contracts";
import { GatheringInviteeEntity } from "../gatherings/gathering-invitee.entity";
import { GatheringEntity } from "../gatherings/gathering.entity";
import { FriendshipEntity } from "../friends/friendship.entity";
import { toFriendDto } from "../friends/friends.service";
import { ParticipationEntity } from "../participations/participation.entity";
import { moscowTimeLabel } from "../time/moscow-date";
import { ProfileEntity } from "../users/profile.entity";
import { UserEntity } from "../users/user.entity";
import { EventEntity } from "./event.entity";

const LOOKING: ParticipationStatus[] = ["looking_for_company", "looking_for_travel_buddy", "looking_for_after_event_company"];
const WANTS: ParticipationStatus[] = ["wants_to_go", "probably_going"];
const LIVE_GATHERING = ["awaiting_responses", "confirmed"] as const;
const GATHERING_FACE_COUNT = 3;

@Injectable()
export class EventCompanionsService {
  constructor(
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    @InjectRepository(ParticipationEntity) private readonly participations: Repository<ParticipationEntity>,
    @InjectRepository(FriendshipEntity) private readonly friendships: Repository<FriendshipEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(ProfileEntity) private readonly profiles: Repository<ProfileEntity>,
    @InjectRepository(GatheringEntity) private readonly gatherings: Repository<GatheringEntity>,
    @InjectRepository(GatheringInviteeEntity) private readonly invitees: Repository<GatheringInviteeEntity>,
  ) {}

  async get(eventId: string, viewerId: string): Promise<EventCompanions> {
    const event = await this.events.findOneBy({ id: eventId });
    if (!event || event.published === false) throw new NotFoundException("Event not found");
    const [rows, edges, gathering] = await Promise.all([this.participations.find({ where: { eventId } }), this.friendships.find({ where: { userId: viewerId } }), this.liveGathering(eventId)]);
    const friendIds = new Set(edges.map((row) => row.friendUserId));
    const companionRows = rows.filter((row) => friendIds.has(row.userId) && row.userId !== viewerId);
    const userIds = [...new Set([viewerId, ...companionRows.map((row) => row.userId), ...(gathering ? [gathering.hostUserId] : [])])];
    const [people, profileRows] = await Promise.all([userIds.length === 0 ? Promise.resolve([] as UserEntity[]) : this.users.find({ where: { id: In(userIds) } }), userIds.length === 0 ? Promise.resolve([] as ProfileEntity[]) : this.profiles.find({ where: { userId: In(userIds) } })]);
    const userById = new Map(people.map((row) => [row.id, row]));
    const interestsByUser = new Map(profileRows.map((row) => [row.userId, row.interests ?? []]));
    const mine = new Set(interestsByUser.get(viewerId) ?? []);
    const companions = companionRows.flatMap((row) => {
      const user = userById.get(row.userId);
      if (!user) return [];
      const overlap = (interestsByUser.get(row.userId) ?? []).filter((interest) => mine.has(interest));
      return [
        {
          friend: toFriendDto(user),
          status: row.status,
          chatTitle: null,
          sharedPlansCount: 0,
          matchesCount: overlap.length,
          interests: overlap,
          note: null,
        },
      ];
    });
    const mineRow = rows.find((row) => row.userId === viewerId);
    return {
      counts: {
        going: rows.filter((row) => row.status === "going").length,
        wants: rows.filter((row) => WANTS.includes(row.status)).length,
        looking: rows.filter((row) => LOOKING.includes(row.status)).length,
      },
      myStatus: mineRow?.status ?? null,
      companions,
      gathering: gathering ? await this.toTeaser(gathering, userById) : null,
    };
  }

  private async liveGathering(eventId: string): Promise<GatheringEntity | null> {
    const rows = await this.gatherings.find({ where: { eventId } });
    const live = rows.filter((row) => (LIVE_GATHERING as readonly string[]).includes(row.status));
    live.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return live[0] ?? null;
  }

  private async toTeaser(gathering: GatheringEntity, known: Map<string, UserEntity>): Promise<EventCompanions["gathering"]> {
    const inviteeRows = await this.invitees.find({ where: { gatheringId: gathering.id } });
    const memberIds = [gathering.hostUserId, ...inviteeRows.filter((row) => row.response === "accepted").map((row) => row.userId)];
    const missing = memberIds.filter((id) => !known.has(id));
    const extra = missing.length === 0 ? [] : await this.users.find({ where: { id: In(missing) } });
    const userById = new Map([...known.values(), ...extra].map((row) => [row.id, row]));
    const members = memberIds.flatMap((id) => {
      const user = userById.get(id);
      return user ? [toFriendDto(user)] : [];
    });
    const faces = members.slice(0, GATHERING_FACE_COUNT);
    return {
      members: faces,
      extraCount: Math.max(0, members.length - faces.length),
      meetingNote: `в ${moscowTimeLabel(gathering.proposedMeetingAt)}`,
    };
  }
}
