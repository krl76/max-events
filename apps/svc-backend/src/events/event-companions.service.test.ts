import { NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { Repository } from "typeorm";
import { GatheringInviteeEntity } from "../gatherings/gathering-invitee.entity";
import { GatheringEntity } from "../gatherings/gathering.entity";
import { FriendshipEntity } from "../friends/friendship.entity";
import { ParticipationEntity } from "../participations/participation.entity";
import { ProfileEntity } from "../users/profile.entity";
import { UserEntity } from "../users/user.entity";
import { EventCompanionsService } from "./event-companions.service";
import { EventEntity } from "./event.entity";

const now = new Date("2026-09-12T10:00:00Z");
const eventId = "00000000-0000-4000-8000-0000000000e1";
const meId = "00000000-0000-4000-8000-00000000000a";
const annaId = "00000000-0000-4000-8000-00000000000b";
const dimaId = "00000000-0000-4000-8000-00000000000c";

function inValues(value: unknown): unknown[] | undefined {
  if (value && typeof value === "object" && Array.isArray((value as { _value?: unknown })._value)) return (value as { _value: unknown[] })._value;
  if (value && typeof value === "object" && Array.isArray((value as { value?: unknown }).value)) return (value as { value: unknown[] }).value;
  return undefined;
}

function matchesWhere(row: object, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, value]) => {
    const cell = (row as Record<string, unknown>)[key];
    const values = inValues(value);
    return values ? values.includes(cell) : cell === value;
  });
}

function createStoreRepo<T extends object>(initial: T[] = []) {
  const store = [...initial];
  return {
    store,
    findOneBy: async (where: Record<string, unknown>) => store.find((row) => matchesWhere(row as object, where)) ?? null,
    find: async (opts: { where?: Record<string, unknown> } = {}) => store.filter((row) => matchesWhere(row as object, opts.where ?? {})),
  };
}

function user(id: string, firstName: string): UserEntity {
  return { id, maxUserId: id, firstName, lastName: null, avatarUrl: null, username: null, friendsSyncedAt: null, bannedFromPublishing: false, createdAt: now, updatedAt: now } as UserEntity;
}

function createService(opts: { published?: boolean; participations?: ParticipationEntity[]; friendships?: FriendshipEntity[]; profiles?: ProfileEntity[]; gatherings?: GatheringEntity[]; invitees?: GatheringInviteeEntity[]; users?: UserEntity[] } = {}) {
  const events = createStoreRepo<EventEntity>([{ id: eventId, published: opts.published ?? true, title: "Джаз", createdAt: now } as EventEntity]);
  const participations = createStoreRepo<ParticipationEntity>(opts.participations ?? []);
  const friendships = createStoreRepo<FriendshipEntity>(opts.friendships ?? []);
  const users = createStoreRepo<UserEntity>([user(meId, "Я"), user(annaId, "Анна"), user(dimaId, "Дима"), ...(opts.users ?? [])]);
  const profiles = createStoreRepo<ProfileEntity>(opts.profiles ?? []);
  const gatherings = createStoreRepo<GatheringEntity>(opts.gatherings ?? []);
  const invitees = createStoreRepo<GatheringInviteeEntity>(opts.invitees ?? []);
  const service = new EventCompanionsService(events as unknown as Repository<EventEntity>, participations as unknown as Repository<ParticipationEntity>, friendships as unknown as Repository<FriendshipEntity>, users as unknown as Repository<UserEntity>, profiles as unknown as Repository<ProfileEntity>, gatherings as unknown as Repository<GatheringEntity>, invitees as unknown as Repository<GatheringInviteeEntity>);
  return { service };
}

describe("EventCompanionsService", () => {
  it("404s an unpublished event", async () => {
    const { service } = createService({ published: false });
    await expect(service.get(eventId, meId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("counts everyone, lists friends with overlapping interests, and leaves missing extras empty", async () => {
    const { service } = createService({
      participations: [{ id: "p1", userId: meId, eventId, status: "going" } as ParticipationEntity, { id: "p2", userId: annaId, eventId, status: "wants_to_go" } as ParticipationEntity, { id: "p3", userId: dimaId, eventId, status: "looking_for_company" } as ParticipationEntity],
      friendships: [{ id: "f1", userId: meId, friendUserId: annaId } as FriendshipEntity],
      profiles: [{ userId: meId, interests: ["джаз", "бег"] } as ProfileEntity, { userId: annaId, interests: ["джаз", "кино"] } as ProfileEntity],
    });
    const result = await service.get(eventId, meId);
    expect(result.counts).toEqual({ going: 1, wants: 1, looking: 1 });
    expect(result.myStatus).toBe("going");
    expect(result.companions).toHaveLength(1);
    expect(result.companions[0]).toMatchObject({
      friend: { name: "Анна" },
      status: "wants_to_go",
      chatTitle: null,
      sharedPlansCount: 0,
      matchesCount: 1,
      interests: ["джаз"],
      note: null,
    });
    expect(result.gathering).toBeNull();
  });

  it("teases an active gathering with extra faces past the first three", async () => {
    const extraIds = ["00000000-0000-4000-8000-0000000000d1", "00000000-0000-4000-8000-0000000000d2"];
    const gathering = {
      id: "00000000-0000-4000-8000-0000000000g1",
      hostUserId: meId,
      eventId,
      proposedMeetingAt: new Date("2026-09-12T16:30:00Z"),
      status: "awaiting_responses",
      chatLink: null,
      createdAt: now,
    } as GatheringEntity;
    const { service } = createService({
      users: extraIds.map((id, index) => user(id, `Гость${index}`)),
      gatherings: [gathering],
      invitees: [{ id: "i1", gatheringId: gathering.id, userId: annaId, response: "accepted" } as GatheringInviteeEntity, { id: "i2", gatheringId: gathering.id, userId: dimaId, response: "accepted" } as GatheringInviteeEntity, { id: "i3", gatheringId: gathering.id, userId: extraIds[0], response: "accepted" } as GatheringInviteeEntity, { id: "i4", gatheringId: gathering.id, userId: extraIds[1], response: "busy" } as GatheringInviteeEntity],
    });
    const result = await service.get(eventId, meId);
    expect(result.gathering?.members).toHaveLength(3);
    expect(result.gathering?.extraCount).toBe(1);
    expect(result.gathering?.meetingNote).toMatch(/в \d{2}:\d{2}/);
  });
});
