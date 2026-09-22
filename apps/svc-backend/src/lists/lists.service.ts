// START_MODULE_CONTRACT
// PURPOSE: Personal event lists — six README presets per user, add/remove events, return lists with events.
// SCOPE: Lazy ensurePresets; idempotent add by (listId, eventId) incl. the 23505 insert race; GET summaries/items/screen; owner-only.
// DEPENDS: @nestjs/common, @nestjs/typeorm, typeorm, @max-events/api-contracts, ../events
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - LIST_PRESET_TITLES - ru titles for the six presets
// - toListDto - list entity to List contract
// - toItemDto - item entity to ListItem contract
// - MAX_CUSTOM_LISTS - ceiling on the lists one user may create
// - ListsService - ensure, list (presets plus the user's own), get, items, addEvent, removeItem, create, rename, remove
// END_MODULE_MAP

import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { QueryFailedError, Repository } from "typeorm";
import { ListPresetSchema, type List, type ListItem, type ListItemCard, type ListPreset, type ListScreen, type ListSummary } from "@max-events/api-contracts";
import { toEventDto } from "../events/events.service";
import { EventEntity } from "../events/event.entity";
import { ListItemEntity } from "./list-item.entity";
import { ListEntity } from "./list.entity";

/** Nothing else bounds how many lists one user may create, and every list is read on the save sheet. */
export const MAX_CUSTOM_LISTS = 20;

export const LIST_PRESET_TITLES: Record<ListPreset, string> = {
  want_to_go: "Хочу сходить",
  favorites: "Избранное",
  weekend: "На выходные",
  with_children: "С детьми",
  with_friends: "С друзьями",
  try_later: "Попробовать потом",
};

@Injectable()
export class ListsService {
  constructor(
    @InjectRepository(ListEntity) private readonly lists: Repository<ListEntity>,
    @InjectRepository(ListItemEntity) private readonly items: Repository<ListItemEntity>,
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
  ) {}

  async list(userId: string, eventId: string | null = null): Promise<ListSummary[]> {
    const presets = await this.ensurePresets(userId);
    // Presets first, then the lists the user made, newest last — the order the screen reads top down.
    const own = (await this.lists.find({ where: { userId } })).filter((row) => row.preset === null).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
    const items = await this.items.find();
    return [...presets, ...own].map((list) => {
      const listItems = items.filter((row) => row.listId === list.id);
      const saved = eventId ? listItems.find((row) => row.eventId === eventId) : undefined;
      return { list: toListDto(list), itemsCount: listItems.length, savedItemId: saved?.id ?? null, participants: [] };
    });
  }

  async get(userId: string, listId: string): Promise<ListScreen> {
    const list = await this.requireOwnedList(userId, listId);
    return { list: toListDto(list), participants: [], items: await this.itemCards(list.id) };
  }

  async itemsFor(userId: string, listId: string): Promise<ListItemCard[]> {
    await this.requireOwnedList(userId, listId);
    return this.itemCards(listId);
  }

  async addEvent(userId: string, listId: string, eventId: string): Promise<ListItem> {
    await this.requireOwnedList(userId, listId);
    const event = await this.events.findOneBy({ id: eventId });
    if (!event) throw new NotFoundException("Event not found");
    const existing = await this.findItem(listId, eventId);
    if (existing) return toItemDto(existing);
    try {
      return toItemDto(await this.items.save(this.items.create({ listId, eventId, placeId: null })));
    } catch (error) {
      // UQ_list_items_list_event: a parallel "save to list" tap must read back the winner, not 500.
      if (!isUniqueViolation(error)) throw error;
      const winner = await this.findItem(listId, eventId);
      if (!winner) throw error;
      return toItemDto(winner);
    }
  }

  private async findItem(listId: string, eventId: string): Promise<ListItemEntity | undefined> {
    return (await this.items.find({ where: { listId } })).find((row) => row.eventId === eventId);
  }

  async removeItem(userId: string, listId: string, itemId: string): Promise<ListItem> {
    await this.requireOwnedList(userId, listId);
    const item = (await this.items.find({ where: { listId } })).find((row) => row.id === itemId);
    if (!item) throw new NotFoundException("List item not found");
    await this.items.delete({ id: item.id });
    return toItemDto(item);
  }

  async create(userId: string, title: string): Promise<List> {
    const own = (await this.lists.find({ where: { userId } })).filter((row) => row.preset === null);
    // A ceiling, because nothing else bounds this: the six presets are fixed, these are not.
    if (own.length >= MAX_CUSTOM_LISTS) throw new ConflictException(`A user may keep at most ${MAX_CUSTOM_LISTS} lists of their own`);
    return toListDto(await this.lists.save(this.lists.create({ userId, preset: null, title })));
  }

  async rename(userId: string, listId: string, title: string): Promise<List> {
    const list = await this.requireOwnList(userId, listId);
    list.title = title;
    return toListDto(await this.lists.save(list));
  }

  async remove(userId: string, listId: string): Promise<List> {
    const list = await this.requireOwnList(userId, listId);
    const dto = toListDto(list);
    // FK_list_items_list is ON DELETE CASCADE, so the items go with it.
    await this.lists.delete({ id: list.id });
    return dto;
  }

  /**
   * A preset is not editable: ensurePresets recreates every missing preset on the next read, so a
   * rename would be undone and a delete would come back as a new row with the default title.
   */
  private async requireOwnList(userId: string, listId: string): Promise<ListEntity> {
    const list = await this.requireOwnedList(userId, listId);
    if (list.preset !== null) throw new ForbiddenException("A preset list cannot be renamed or deleted");
    return list;
  }

  private async ensurePresets(userId: string): Promise<ListEntity[]> {
    const existing = (await this.lists.find({ where: { userId } })).filter((row) => row.preset !== null);
    const byPreset = new Map(existing.map((row) => [row.preset, row]));
    for (const preset of ListPresetSchema.options) {
      if (byPreset.has(preset)) continue;
      const saved = await this.lists.save(this.lists.create({ userId, preset, title: LIST_PRESET_TITLES[preset] }));
      byPreset.set(preset, saved);
    }
    return ListPresetSchema.options.map((preset) => byPreset.get(preset)!);
  }

  private async requireOwnedList(userId: string, listId: string): Promise<ListEntity> {
    const list = await this.lists.findOneBy({ id: listId });
    if (!list) throw new NotFoundException("List not found");
    if (list.userId !== userId) throw new ForbiddenException("Cannot access another user's list");
    return list;
  }

  private async itemCards(listId: string): Promise<ListItemCard[]> {
    const rows = (await this.items.find({ where: { listId } })).filter((row) => row.eventId !== null).sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime() || b.id.localeCompare(a.id));
    const events = await this.events.find();
    const eventById = new Map(events.map((row) => [row.id, row]));
    return rows.flatMap((row) => {
      const event = eventById.get(row.eventId!);
      return event ? [{ item: toItemDto(row), event: toEventDto(event), addedBy: null }] : [];
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
    addedAt: item.addedAt.toISOString(),
  };
}
