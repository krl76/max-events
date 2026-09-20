// START_MODULE_CONTRACT
// PURPOSE: Shared event vote — create options, MAX chat card, collect ballots, compute the winner.
// SCOPE: create/list/get; one ballot per participant (re-vote overwrites, concurrent first vote resolves via 23505); best option is max votes then option position (creation order).
// DEPENDS: @nestjs/common, @nestjs/typeorm, typeorm, @max-events/api-contracts, events/friends/users/max-bot
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - formatVoteChatText - MAX chat body with numbered event options
// - VotesService - create, list, get, castBallot
// END_MODULE_MAP

import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, QueryFailedError, Repository } from "typeorm";
import type { CreateVoteWrite, Friend, Vote, VoteOptionTally } from "@max-events/api-contracts";
import { toEventDto } from "../events/event.mapper";
import { EventEntity } from "../events/event.entity";
import { FriendsService, toFriendDto } from "../friends/friends.service";
import { MaxBotClient } from "../max-bot/max-bot.client";
import { UserEntity } from "../users/user.entity";
import { VoteBallotEntity, VoteEntity, VoteOptionEntity, VoteParticipantEntity } from "./vote.entity";

export function formatVoteChatText(title: string, events: Array<{ title: string }>): string {
  const lines = events.map((event, index) => `${index + 1}. ${event.title}`);
  return `${title}\n${lines.join("\n")}\nГолосуй в приложении.`;
}

@Injectable()
export class VotesService {
  private readonly logger = new Logger(VotesService.name);

  constructor(
    @InjectRepository(VoteEntity) private readonly votes: Repository<VoteEntity>,
    @InjectRepository(VoteOptionEntity) private readonly options: Repository<VoteOptionEntity>,
    @InjectRepository(VoteParticipantEntity) private readonly participants: Repository<VoteParticipantEntity>,
    @InjectRepository(VoteBallotEntity) private readonly ballots: Repository<VoteBallotEntity>,
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @Inject(FriendsService) private readonly friends: FriendsService,
    @Inject(MaxBotClient) private readonly bot: MaxBotClient,
  ) {}

  async create(hostUserId: string, payload: CreateVoteWrite): Promise<Vote> {
    const participantIds = [...new Set(payload.participantIds)];
    if (participantIds.includes(hostUserId)) throw new BadRequestException("Invalid vote payload");
    const allowed = await this.friends.friendIds(hostUserId);
    if (participantIds.some((id) => !allowed.has(id))) throw new BadRequestException("Invalid vote payload");
    const eventIds = [...new Set(payload.eventIds)];
    const eventRows = await this.events.find({ where: { id: In(eventIds) } });
    const byId = new Map(eventRows.map((row) => [row.id, row]));
    const ordered = eventIds.map((id) => byId.get(id)).filter((row): row is EventEntity => Boolean(row && row.published !== false));
    if (ordered.length !== eventIds.length) throw new NotFoundException("Event not found");
    const saved = await this.votes.save(this.votes.create({ hostUserId, title: payload.title, chatLink: null }));
    for (const [position, event] of ordered.entries()) {
      await this.options.save(this.options.create({ voteId: saved.id, eventId: event.id, position }));
    }
    for (const userId of participantIds) {
      await this.participants.save(this.participants.create({ voteId: saved.id, userId }));
    }
    try {
      const chat = await this.bot.createChat(saved.title);
      if (chat) {
        saved.chatLink = chat.link;
        await this.votes.save(saved);
        await this.bot.sendChatMessage(chat.chatId, formatVoteChatText(saved.title, ordered));
      }
    } catch {
      this.logger.warn(`Vote chat create failed for ${saved.id}`);
    }
    const users = await this.users.find();
    for (const userId of participantIds) {
      const user = users.find((row) => row.id === userId);
      if (!user) continue;
      try {
        const chat = saved.chatLink ? ` Чат: ${saved.chatLink}` : "";
        await this.bot.sendMessage(user.maxUserId, `Тебя зовут проголосовать: «${saved.title}».${chat}`);
      } catch {
        this.logger.warn(`Vote invite DM failed for ${saved.id}`);
      }
    }
    return this.toVote(saved, hostUserId);
  }

  async list(userId: string): Promise<Vote[]> {
    const all = await this.votes.find({ order: { createdAt: "DESC", id: "ASC" } });
    const mine: VoteEntity[] = [];
    for (const vote of all) {
      if (await this.canView(userId, vote)) mine.push(vote);
    }
    return Promise.all(mine.map((vote) => this.toVote(vote, userId)));
  }

  async get(userId: string, voteId: string): Promise<Vote> {
    const vote = await this.requireVote(voteId);
    if (!(await this.canView(userId, vote))) throw new ForbiddenException("Cannot view another user's vote");
    return this.toVote(vote, userId);
  }

  async castBallot(userId: string, voteId: string, eventId: string): Promise<Vote> {
    const vote = await this.requireVote(voteId);
    if (!(await this.canView(userId, vote))) throw new ForbiddenException("Cannot vote on this poll");
    const option = (await this.options.find({ where: { voteId } })).find((row) => row.eventId === eventId);
    if (!option) throw new BadRequestException("Invalid vote payload");
    const existing = await this.findBallot(voteId, userId);
    if (existing) {
      existing.eventId = eventId;
      await this.ballots.save(existing);
      return this.toVote(vote, userId);
    }
    try {
      await this.ballots.save(this.ballots.create({ voteId, userId, eventId }));
    } catch (error) {
      // UQ_vote_ballots_vote_user: a parallel first vote must land as a re-vote, not a 500.
      if (!isUniqueViolation(error)) throw error;
      const winner = await this.findBallot(voteId, userId);
      if (!winner) throw error;
      winner.eventId = eventId;
      await this.ballots.save(winner);
    }
    return this.toVote(vote, userId);
  }

  private async findBallot(voteId: string, userId: string): Promise<VoteBallotEntity | undefined> {
    return (await this.ballots.find({ where: { voteId } })).find((row) => row.userId === userId);
  }

  private async requireVote(voteId: string): Promise<VoteEntity> {
    const vote = await this.votes.findOneBy({ id: voteId });
    if (!vote) throw new NotFoundException("Vote not found");
    return vote;
  }

  private async canView(userId: string, vote: VoteEntity): Promise<boolean> {
    if (vote.hostUserId === userId) return true;
    const rows = await this.participants.find({ where: { voteId: vote.id } });
    return rows.some((row) => row.userId === userId);
  }

  private async toVote(vote: VoteEntity, viewerId: string): Promise<Vote> {
    const optionRows = (await this.options.find({ where: { voteId: vote.id }, order: { position: "ASC", id: "ASC" } })).sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
    const participantRows = await this.participants.find({ where: { voteId: vote.id } });
    const ballotRows = await this.ballots.find({ where: { voteId: vote.id } });
    const events = await this.events.find();
    const users = await this.users.find();
    const eventById = new Map(events.map((row) => [row.id, row]));
    const userById = new Map(users.map((row) => [row.id, row]));
    const counts = new Map<string, number>();
    for (const ballot of ballotRows) counts.set(ballot.eventId, (counts.get(ballot.eventId) ?? 0) + 1);
    const options: VoteOptionTally[] = optionRows.flatMap((row) => {
      const event = eventById.get(row.eventId);
      return event ? [{ event: toEventDto(event), votes: counts.get(row.eventId) ?? 0 }] : [];
    });
    const ranked = [...optionRows].sort((a, b) => (counts.get(b.eventId) ?? 0) - (counts.get(a.eventId) ?? 0) || a.position - b.position || a.id.localeCompare(b.id));
    const top = ranked[0];
    const topVotes = top ? (counts.get(top.eventId) ?? 0) : 0;
    const participants: Friend[] = participantRows.flatMap((row) => {
      const user = userById.get(row.userId);
      return user ? [toFriendDto(user)] : [];
    });
    return {
      id: vote.id,
      hostUserId: vote.hostUserId,
      title: vote.title,
      chatLink: vote.chatLink,
      participants,
      options,
      winnerEventId: top && topVotes > 0 ? top.eventId : null,
      myBallotEventId: ballotRows.find((row) => row.userId === viewerId)?.eventId ?? null,
      createdAt: vote.createdAt.toISOString(),
      updatedAt: vote.updatedAt.toISOString(),
    };
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof QueryFailedError && error.driverError?.code === "23505";
}
