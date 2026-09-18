import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { Repository } from "typeorm";
import type { Friend } from "@max-events/api-contracts";
import { EventEntity } from "../events/event.entity";
import type { FriendsService } from "../friends/friends.service";
import type { MaxBotClient } from "../max-bot/max-bot.client";
import { UserEntity } from "../users/user.entity";
import { VoteBallotEntity, VoteEntity, VoteOptionEntity, VoteParticipantEntity } from "./vote.entity";
import { formatVoteChatText, VotesService } from "./votes.service";

const now = new Date("2026-09-12T10:00:00Z");
const hostId = "00000000-0000-4000-8000-00000000000a";
const dimaId = "00000000-0000-4000-8000-0000000000b1";
const katyaId = "00000000-0000-4000-8000-0000000000b2";
const strangerId = "00000000-0000-4000-8000-0000000000ff";
const jazzId = "00000000-0000-4000-8000-0000000000e1";
const concertId = "00000000-0000-4000-8000-0000000000e2";
const draftId = "00000000-0000-4000-8000-0000000000e3";

function inValues(value: unknown): unknown[] | undefined {
  if (value && typeof value === "object" && Array.isArray((value as { _value?: unknown })._value)) return (value as { _value: unknown[] })._value;
  return undefined;
}

function matchesWhere(row: object, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, value]) => {
    const cell = (row as Record<string, unknown>)[key];
    const values = inValues(value);
    return values ? values.includes(cell) : cell === value;
  });
}

function createStoreRepo<T extends { id?: string }>(initial: T[] = []) {
  const store = [...initial];
  let seq = 0;
  return {
    store,
    create: (fields: Partial<T>) => ({ ...fields }) as T,
    find: async (opts: { where?: Record<string, unknown> } = {}) => store.filter((row) => matchesWhere(row as object, opts.where ?? {})),
    findOneBy: async (where: Record<string, string>) => store.find((row) => matchesWhere(row as object, where)) ?? null,
    save: async (entity: T) => {
      if (!store.includes(entity)) {
        entity.id ??= `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
        (entity as { createdAt?: Date }).createdAt ??= now;
        (entity as { updatedAt?: Date }).updatedAt ??= now;
        store.push(entity);
      }
      return entity;
    },
  };
}

function eventRow(id: string, title: string, published = true): EventEntity {
  return {
    id,
    title,
    description: "",
    category: "afisha",
    city: "Москва",
    placeId: null,
    startsAt: now,
    endsAt: null,
    isPaid: false,
    priceRub: null,
    paymentUrl: null,
    capacity: null,
    bookedCount: 0,
    published,
    chatLink: null,
    chatSyncPending: false,
    createdAt: now,
    updatedAt: now,
  } as EventEntity;
}

function createService() {
  const votes = createStoreRepo<VoteEntity>();
  const options = createStoreRepo<VoteOptionEntity>();
  const participants = createStoreRepo<VoteParticipantEntity>();
  const ballots = createStoreRepo<VoteBallotEntity>();
  const events = createStoreRepo<EventEntity>([eventRow(jazzId, "Джаз"), eventRow(concertId, "Концерт"), eventRow(draftId, "Черновик", false)]);
  const users = createStoreRepo<UserEntity>([{ id: hostId, maxUserId: "1", firstName: "Саша", lastName: null, avatarUrl: null } as UserEntity, { id: dimaId, maxUserId: "2", firstName: "Дима", lastName: null, avatarUrl: null } as UserEntity, { id: katyaId, maxUserId: "3", firstName: "Катя", lastName: null, avatarUrl: null } as UserEntity]);
  const friends = {
    friendIds: async () => new Set([dimaId, katyaId]),
    list: async () =>
      [
        { id: dimaId, name: "Дима", avatarUrl: null },
        { id: katyaId, name: "Катя", avatarUrl: null },
      ] satisfies Friend[],
  } as unknown as FriendsService;
  const chats: string[] = [];
  const dms: string[] = [];
  const bot = {
    createChat: async (_title: string) => ({ chatId: 7, link: "https://max.ru/join/vote" }),
    sendChatMessage: async (chatId: number, text: string) => {
      chats.push(`${chatId}:${text}`);
      return true;
    },
    sendMessage: async (maxUserId: string, text: string) => {
      dms.push(`${maxUserId}:${text}`);
      return true;
    },
  } as unknown as MaxBotClient;
  const service = new VotesService(votes as unknown as Repository<VoteEntity>, options as unknown as Repository<VoteOptionEntity>, participants as unknown as Repository<VoteParticipantEntity>, ballots as unknown as Repository<VoteBallotEntity>, events as unknown as Repository<EventEntity>, users as unknown as Repository<UserEntity>, friends, bot);
  return { service, chats, dms };
}

describe("formatVoteChatText", () => {
  it("numbers the event titles under the poll question", () => {
    expect(formatVoteChatText("Куда идем в пятницу?", [{ title: "Джаз" }, { title: "Концерт" }])).toBe("Куда идем в пятницу?\n1. Джаз\n2. Концерт\nГолосуй в приложении.");
  });
});

describe("VotesService", () => {
  it("creates a vote, posts the card to MAX chat, and computes the winning event", async () => {
    const { service, chats, dms } = createService();
    const created = await service.create(hostId, {
      title: "Куда идем в пятницу?",
      eventIds: [jazzId, concertId],
      participantIds: [dimaId, katyaId],
    });
    expect(created.chatLink).toBe("https://max.ru/join/vote");
    expect(created.options.map((row) => row.event.title)).toEqual(["Джаз", "Концерт"]);
    const reversed = await service.create(hostId, {
      title: "Куда идем в пятницу?",
      eventIds: [concertId, jazzId],
      participantIds: [dimaId],
    });
    expect(reversed.options.map((row) => row.event.title)).toEqual(["Концерт", "Джаз"]);
    expect(created.winnerEventId).toBeNull();
    expect(chats[0]).toContain("7:");
    expect(chats[0]).toContain("1. Джаз");
    expect(dms.some((text) => text.includes("2:") && text.includes("https://max.ru/join/vote"))).toBe(true);
    await service.castBallot(dimaId, created.id, jazzId);
    await service.castBallot(katyaId, created.id, jazzId);
    const hostVote = await service.castBallot(hostId, created.id, concertId);
    expect(hostVote.winnerEventId).toBe(jazzId);
    expect(hostVote.options.find((row) => row.event.id === jazzId)?.votes).toBe(2);
    expect(hostVote.options.find((row) => row.event.id === concertId)?.votes).toBe(1);
    const changed = await service.castBallot(katyaId, created.id, concertId);
    expect(changed.winnerEventId).toBe(concertId);
    expect(changed.options.find((row) => row.event.id === concertId)?.votes).toBe(2);
    expect(changed.options.find((row) => row.event.id === jazzId)?.votes).toBe(1);
  });

  it("rejects non-friends, unpublished events, strangers, and unknown options", async () => {
    const { service } = createService();
    await expect(service.create(hostId, { title: "Куда идем в пятницу?", eventIds: [jazzId, concertId], participantIds: [hostId] })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create(hostId, { title: "Куда идем в пятницу?", eventIds: [jazzId, concertId], participantIds: [strangerId] })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create(hostId, { title: "Куда идем в пятницу?", eventIds: [jazzId, draftId], participantIds: [dimaId] })).rejects.toBeInstanceOf(NotFoundException);
    const created = await service.create(hostId, { title: "Куда идем в пятницу?", eventIds: [jazzId, concertId], participantIds: [dimaId] });
    await expect(service.get(strangerId, created.id)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.castBallot(strangerId, created.id, jazzId)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.castBallot(dimaId, created.id, draftId)).rejects.toBeInstanceOf(BadRequestException);
    const listed = await service.list(dimaId);
    expect(listed).toHaveLength(1);
    expect(await service.list(strangerId)).toEqual([]);
  });
});
