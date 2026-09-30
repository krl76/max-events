// START_MODULE_CONTRACT
// PURPOSE: Personal and shared event lists — six README presets per user, custom lists, membership, add/remove events.
// SCOPE: Lazy ensurePresets; idempotent add by (listId, eventId) incl. the 23505 insert race; GET summaries/items/screen; owner rename/delete; members read/add/leave.
// DEPENDS: @nestjs/common, @nestjs/typeorm, typeorm, @max-events/api-contracts, ../events
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - LIST_PRESET_TITLES - ru titles for the six presets
// - toListDto - list entity to List contract
// - toItemDto - item entity to ListItem contract
// - MAX_CUSTOM_LISTS - ceiling on the lists one user may create
// - ListsService - ensure, list (presets plus own plus shared), get, items, addEvent, removeItem, create, rename, remove, invite, leave
// END_MODULE_MAP

import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { QueryFailedError, Repository } from "typeorm";
import { type Friend, type List, type ListItem, type ListItemCard, type ListPreset, type ListScreen, type ListSummary } from "@max-events/api-contracts";
import { toEventDto } from "../events/events.service";
import { EventEntity } from "../events/event.entity";
import { FriendsService, toFriendDto } from "../friends/friends.service";
import { toPlaceDto } from "../places/places.service";
import { FeedPostEntity } from "../feed/feed-post.entity";
import { PlaceEntity } from "../places/place.entity";
import { UsersService } from "../users/users.service";
import { ListItemEntity } from "./list-item.entity";
import { ListMemberEntity } from "./list-member.entity";
import { ListEntity } from "./list.entity";

/** The two shelves a person always has. The other preset values stay in the enum for old rows. */
export const SHELF_PRESETS = ["want_to_go", "favorites"] as const satisfies readonly ListPreset[];

/** Two shelves plus the lists a person creates, and no more. The apps do not print this number. */
export const MAX_SAVED_CATEGORIES = 8;

/** Nothing else bounds how many lists one user may create, and every list is read on the save sheet. */
export const MAX_CUSTOM_LISTS = MAX_SAVED_CATEGORIES - SHELF_PRESETS.length;

export const LIST_PRESET_TITLES: Record<ListPreset, string> = {
  want_to_go: "Хочу сходить",
  favorites: "Избранное",
  weekend: "Выходные",
  with_children: "С детьми",
  with_friends: "С друзьями",
  try_later: "Попробовать позже",
};

@Injectable()
export class ListsService {
  constructor(
    @InjectRepository(ListEntity) private readonly lists: Repository<ListEntity>,
    @InjectRepository(ListItemEntity) private readonly items: Repository<ListItemEntity>,
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    @InjectRepository(PlaceEntity) private readonly places: Repository<PlaceEntity>,
    @InjectRepository(FeedPostEntity) private readonly posts: Repository<FeedPostEntity>,
    @InjectRepository(ListMemberEntity) private readonly members: Repository<ListMemberEntity>,
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(FriendsService) private readonly friends: FriendsService,
  ) {}

  async list(userId: string, eventId: string | null = null, feedPostId: string | null = null, subjectId: string | null = null): Promise<ListSummary[]> {
    if (subjectId !== null && subjectId !== userId) return this.publicOf(subjectId);
    const presets = await this.ensurePresets(userId);
    // Presets first, then the lists the user made, newest last — the order the screen reads top down.
    const own = (await this.lists.find({ where: { userId } })).filter((row) => row.preset === null).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
    const memberships = await this.members.find({ where: { userId } });
    const shared: ListEntity[] = [];
    for (const row of memberships) {
      const list = await this.lists.findOneBy({ id: row.listId });
      if (list && list.userId !== userId) shared.push(list);
    }
    shared.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
    const items = await this.items.find();
    const visible = [...presets, ...own, ...shared];
    const participantsByList = await this.participantsByListIds(visible.map((row) => row.id));
    return visible.map((list) => {
      const listItems = items.filter((row) => row.listId === list.id);
      const saved = eventId ? listItems.find((row) => row.eventId === eventId) : feedPostId ? listItems.find((row) => row.feedPostId === feedPostId) : undefined;
      return { list: toListDto(list), itemsCount: listItems.length, savedItemId: saved?.id ?? null, participants: participantsByList.get(list.id) ?? [] };
    });
  }

  private async publicOf(ownerId: string): Promise<ListSummary[]> {
    const rows = (await this.lists.find({ where: { userId: ownerId } })).filter((row) => row.visibility === "public").sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
    const items = await this.items.find();
    const participantsByList = await this.participantsByListIds(rows.map((row) => row.id));
    return rows.map((list) => {
      const listItems = items.filter((row) => row.listId === list.id);
      return { list: toListDto(list), itemsCount: listItems.length, savedItemId: null, participants: participantsByList.get(list.id) ?? [] };
    });
  }

  async get(userId: string, listId: string): Promise<ListScreen> {
    const list = await this.requireAccessibleList(userId, listId);
    return { list: toListDto(list), participants: await this.participantsOf(list), items: await this.itemCards(list.id) };
  }

  async itemsFor(userId: string, listId: string): Promise<ListItemCard[]> {
    await this.requireAccessibleList(userId, listId);
    return this.itemCards(listId);
  }

  async addEvent(userId: string, listId: string, eventId: string): Promise<ListItem> {
    await this.requireAccessibleList(userId, listId);
    const event = await this.events.findOneBy({ id: eventId });
    if (!event) throw new NotFoundException("Event not found");
    const existing = await this.findEventItem(listId, eventId);
    if (existing) return toItemDto(existing);
    try {
      return toItemDto(await this.items.save(this.items.create({ listId, eventId, placeId: null, feedPostId: null, addedByUserId: userId })));
    } catch (error) {
      // UQ_list_items_list_event: a parallel "save to list" tap must read back the winner, not 500.
      if (!isUniqueViolation(error)) throw error;
      const winner = await this.findEventItem(listId, eventId);
      if (!winner) throw error;
      return toItemDto(winner);
    }
  }

  async addPlaceToPreset(userId: string, preset: ListPreset, placeId: string): Promise<ListItem> {
    const presets = await this.ensurePresets(userId);
    const list = presets.find((row) => row.preset === preset);
    if (!list) throw new NotFoundException("List not found");
    return this.addPlace(userId, list.id, placeId);
  }

  async addPlace(userId: string, listId: string, placeId: string): Promise<ListItem> {
    await this.requireAccessibleList(userId, listId);
    const place = await this.places.findOneBy({ id: placeId });
    if (!place) throw new NotFoundException("Place not found");
    const existing = await this.findPlaceItem(listId, placeId);
    if (existing) return toItemDto(existing);
    try {
      return toItemDto(await this.items.save(this.items.create({ listId, eventId: null, placeId, feedPostId: null, addedByUserId: userId })));
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const winner = await this.findPlaceItem(listId, placeId);
      if (!winner) throw error;
      return toItemDto(winner);
    }
  }

  private async findEventItem(listId: string, eventId: string): Promise<ListItemEntity | undefined> {
    return (await this.items.find({ where: { listId } })).find((row) => row.eventId === eventId);
  }

  private async findPlaceItem(listId: string, placeId: string): Promise<ListItemEntity | undefined> {
    return (await this.items.find({ where: { listId } })).find((row) => row.placeId === placeId);
  }

  async addPost(userId: string, listId: string, feedPostId: string): Promise<ListItem> {
    await this.requireAccessibleList(userId, listId);
    const post = await this.posts.findOneBy({ id: feedPostId, published: true });
    if (!post) throw new NotFoundException("Post not found");
    const existing = await this.findPostItem(listId, feedPostId);
    if (existing) return toItemDto(existing);
    try {
      return toItemDto(await this.items.save(this.items.create({ listId, eventId: null, placeId: null, feedPostId, addedByUserId: userId })));
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const winner = await this.findPostItem(listId, feedPostId);
      if (!winner) throw error;
      return toItemDto(winner);
    }
  }

  private async findPostItem(listId: string, feedPostId: string): Promise<ListItemEntity | undefined> {
    return (await this.items.find({ where: { listId } })).find((row) => row.feedPostId === feedPostId);
  }

  async removeItem(userId: string, listId: string, itemId: string): Promise<ListItem> {
    await this.requireAccessibleList(userId, listId);
    const item = (await this.items.find({ where: { listId } })).find((row) => row.id === itemId);
    if (!item) throw new NotFoundException("List item not found");
    await this.items.delete({ id: item.id });
    return toItemDto(item);
  }

  async create(userId: string, title: string): Promise<List> {
    const own = (await this.lists.find({ where: { userId } })).filter((row) => row.preset === null);
    // A ceiling, because nothing else bounds this: the six presets are fixed, these are not.
    if (own.length >= MAX_CUSTOM_LISTS) throw new ConflictException("Cannot create another list");
    return toListDto(await this.lists.save(this.lists.create({ userId, preset: null, title, visibility: "private" })));
  }

  async rename(userId: string, listId: string, title: string): Promise<List> {
    const list = await this.requireOwnerList(userId, listId);
    list.title = title;
    return toListDto(await this.lists.save(list));
  }

  async setVisibility(userId: string, listId: string, visibility: "public" | "private"): Promise<List> {
    const list = await this.requireOwnerList(userId, listId);
    list.visibility = visibility;
    return toListDto(await this.lists.save(list));
  }

  async remove(userId: string, listId: string): Promise<List> {
    const list = await this.requireOwnerList(userId, listId);
    const dto = toListDto(list);
    // FK_list_items_list is ON DELETE CASCADE, so the items go with it.
    await this.lists.delete({ id: list.id });
    return dto;
  }

  async invite(ownerId: string, listId: string, inviteeId: string): Promise<ListScreen> {
    const list = await this.requireOwnerList(ownerId, listId);
    if (inviteeId === ownerId) throw new BadRequestException("Invalid list payload");
    const allowed = await this.friends.friendIds(ownerId);
    if (!allowed.has(inviteeId)) throw new BadRequestException("Invalid list payload");
    const existing = await this.members.findOneBy({ listId, userId: inviteeId });
    if (existing) return { list: toListDto(list), participants: await this.participantsOf(list), items: await this.itemCards(list.id) };
    try {
      await this.members.save(this.members.create({ listId, userId: inviteeId }));
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
    return { list: toListDto(list), participants: await this.participantsOf(list), items: await this.itemCards(list.id) };
  }

  async leave(userId: string, listId: string): Promise<List> {
    const list = await this.lists.findOneBy({ id: listId });
    if (!list) throw new NotFoundException("List not found");
    if (list.userId === userId) throw new ForbiddenException("The owner cannot leave a list");
    const membership = await this.members.findOneBy({ listId, userId });
    if (!membership) throw new ForbiddenException("Cannot access another user's list");
    await this.members.delete({ id: membership.id });
    return toListDto(list);
  }

  /**
   * A preset is not editable: ensurePresets recreates every missing preset on the next read, so a
   * rename would be undone and a delete would come back as a new row with the default title.
   * Shared custom lists: the owner may rename and delete; members may add items and leave.
   */
  private async requireOwnerList(userId: string, listId: string): Promise<ListEntity> {
    const list = await this.requireAccessibleList(userId, listId);
    if (list.userId !== userId) throw new ForbiddenException("Only the owner can rename or delete a list");
    if (list.preset !== null) throw new ForbiddenException("A preset list cannot be renamed or deleted");
    return list;
  }

  private async ensurePresets(userId: string): Promise<ListEntity[]> {
    const existing = (await this.lists.find({ where: { userId } })).filter((row) => row.preset !== null);
    const byPreset = new Map(existing.map((row) => [row.preset, row]));
    for (const preset of SHELF_PRESETS) {
      const existing = byPreset.get(preset);
      if (existing) {
        if (existing.title !== LIST_PRESET_TITLES[preset]) {
          existing.title = LIST_PRESET_TITLES[preset];
          await this.lists.save(existing);
        }
        continue;
      }
      const saved = await this.lists.save(this.lists.create({ userId, preset, title: LIST_PRESET_TITLES[preset], visibility: "private" }));
      byPreset.set(preset, saved);
    }
    return SHELF_PRESETS.map((preset) => byPreset.get(preset)!);
  }

  private async requireAccessibleList(userId: string, listId: string): Promise<ListEntity> {
    const list = await this.lists.findOneBy({ id: listId });
    if (!list) throw new NotFoundException("List not found");
    if (list.userId === userId) return list;
    const membership = await this.members.findOneBy({ listId, userId });
    if (membership) return list;
    if (list.preset !== null) throw new ForbiddenException("Cannot access another user's list");
    try {
      await this.members.save(this.members.create({ listId, userId }));
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
    return list;
  }

  private async participantsOf(list: ListEntity): Promise<Friend[]> {
    const rows = await this.members.find({ where: { listId: list.id } });
    if (rows.length === 0) return [];
    return this.friendsOf([list.userId, ...rows.map((row) => row.userId)]);
  }

  private async participantsByListIds(listIds: string[]): Promise<Map<string, Friend[]>> {
    const result = new Map<string, Friend[]>();
    if (listIds.length === 0) return result;
    for (const listId of listIds) {
      const list = await this.lists.findOneBy({ id: listId });
      if (!list) continue;
      result.set(listId, await this.participantsOf(list));
    }
    return result;
  }

  private async friendsOf(ids: string[]): Promise<Friend[]> {
    const unique = [...new Set(ids)];
    const users = await this.users.findByIds(unique);
    const byId = new Map(users.map((row) => [row.id, row]));
    return unique.flatMap((id) => {
      const user = byId.get(id);
      return user ? [toFriendDto(user)] : [];
    });
  }

  private async itemCards(listId: string): Promise<ListItemCard[]> {
    const rows = (await this.items.find({ where: { listId } })).sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime() || b.id.localeCompare(a.id));
    const events = await this.events.find();
    const places = await this.places.find();
    const postIds = rows.flatMap((row) => (row.feedPostId ? [row.feedPostId] : []));
    const feedPosts = postIds.length === 0 ? [] : await this.posts.find();
    const postAuthors = await this.friendsOf(feedPosts.map((row) => row.authorUserId));
    const authors = await this.friendsOf(rows.flatMap((row) => (row.addedByUserId ? [row.addedByUserId] : [])));
    const authorById = new Map([...authors, ...postAuthors].map((row) => [row.id, row]));
    const eventById = new Map(events.map((row) => [row.id, row]));
    const placeById = new Map(places.map((row) => [row.id, row]));
    const postById = new Map(feedPosts.map((row) => [row.id, row]));
    return rows.flatMap((row): ListItemCard[] => {
      const addedBy = row.addedByUserId ? (authorById.get(row.addedByUserId) ?? null) : null;
      if (row.eventId !== null) {
        const event = eventById.get(row.eventId);
        return event ? [{ item: toItemDto(row), event: toEventDto(event), place: null, post: null, addedBy }] : [];
      }
      if (row.placeId !== null) {
        const place = placeById.get(row.placeId);
        return place ? [{ item: toItemDto(row), event: null, place: toPlaceDto(place), post: null, addedBy }] : [];
      }
      if (row.feedPostId !== null) {
        const post = postById.get(row.feedPostId);
        const author = post ? authorById.get(post.authorUserId) : undefined;
        const event = post?.eventId ? eventById.get(post.eventId) : undefined;
        return post && author ? [{ item: toItemDto(row), event: null, place: null, post: { id: post.id, text: post.text, photoUrl: post.photoUrl ?? null, author, eventTitle: event?.title ?? "" }, addedBy }] : [];
      }
      return [];
    });
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof QueryFailedError && error.driverError?.code === "23505";
}

export function toListDto(list: ListEntity): List {
  return {
    id: list.id,
    userId: list.userId,
    preset: list.preset,
    title: list.title,
    visibility: list.visibility ?? "private",
    createdAt: list.createdAt.toISOString(),
    updatedAt: list.updatedAt.toISOString(),
  };
}

export function toItemDto(item: ListItemEntity): ListItem {
  return {
    id: item.id,
    listId: item.listId,
    eventId: item.eventId,
    placeId: item.placeId,
    feedPostId: item.feedPostId ?? null,
    addedAt: item.addedAt.toISOString(),
  };
}
