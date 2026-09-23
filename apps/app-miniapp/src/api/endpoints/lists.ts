// START_MODULE_CONTRACT
// PURPOSE: List and subscription endpoints of the api client: the preset and own lists, their items and the follows of the viewer.
// SCOPE: GET/POST /lists[/:id[/items[/:itemId]]], PATCH/DELETE /lists/:id, GET/POST /subscriptions, DELETE /subscriptions/:id; client-side aggregates ListSummary/ListItemCard/ListScreen live here.
// DEPENDS: ./transport.js, @max-events/api-contracts
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ListSummary - lists screen aggregate: list + item count + id of the item saving the checked event (null when not saved) + participants (shared collections, mock)
// - ListItemCard - list screen aggregate: list item enriched with its event and the participant who added it (null outside shared collections)
// - ListScreen - one-list aggregate: list + participants + item cards (shared collections surface)
// - AddListItem - save-to-list payload (owner user + saved event)
// - withLists - ApiClient.listLists / createList / renameList / deleteList / addListItem / removeListItem / getList / listSubscriptions / createSubscription / removeSubscription
// END_MODULE_MAP

import { EventSchema, FriendSchema, ListItemSchema, ListSchema, SubscriptionSchema } from "@max-events/api-contracts";
import type { CreateSubscription, Event, Friend, List, ListItem, Subscription } from "@max-events/api-contracts";
import type { ApiMixin, ZodSchema } from "./transport";

/** Lists screen aggregate: a preset or custom list, its item count, the id of the item saving the checked event (null when not saved) and the participants of a shared collection (empty for personal lists). */
export interface ListSummary {
  list: List;
  itemsCount: number;
  savedItemId: string | null;
  participants: Friend[];
}

const ListSummaryArraySchema: ZodSchema<ListSummary[]> = {
  safeParse(data: unknown) {
    if (!Array.isArray(data)) return { success: false as const, error: "expected an array of list summaries" };
    const summaries: ListSummary[] = [];
    for (const entry of data) {
      if (typeof entry !== "object" || entry === null) return { success: false as const, error: "expected a list summary" };
      const raw = entry as Record<string, unknown>;
      const list = ListSchema.safeParse(raw.list);
      if (!list.success || typeof raw.itemsCount !== "number" || (raw.savedItemId !== null && typeof raw.savedItemId !== "string")) return { success: false as const, error: "invalid list summary" };
      const participants: Friend[] = [];
      if (Array.isArray(raw.participants)) {
        for (const participant of raw.participants) {
          const parsed = FriendSchema.safeParse(participant);
          if (!parsed.success) return { success: false as const, error: "invalid list summary" };
          participants.push(parsed.data);
        }
      }
      summaries.push({ list: list.data, itemsCount: raw.itemsCount, savedItemId: raw.savedItemId, participants });
    }
    return { success: true as const, data: summaries };
  },
};

/** List screen aggregate: a list item enriched with its event and the participant who added it (null outside shared collections). */
export interface ListItemCard {
  item: ListItem;
  event: Event;
  addedBy: Friend | null;
}

const ListItemCardArraySchema: ZodSchema<ListItemCard[]> = {
  safeParse(data: unknown) {
    if (!Array.isArray(data)) return { success: false as const, error: "expected an array of list item cards" };
    const cards: ListItemCard[] = [];
    for (const entry of data) {
      if (typeof entry !== "object" || entry === null) return { success: false as const, error: "expected a list item card" };
      const raw = entry as Record<string, unknown>;
      const item = ListItemSchema.safeParse(raw.item);
      const event = EventSchema.safeParse(raw.event);
      if (!item.success || !event.success) return { success: false as const, error: "invalid list item card" };
      if (raw.addedBy === undefined || raw.addedBy === null) {
        cards.push({ item: item.data, event: event.data, addedBy: null });
        continue;
      }
      const addedBy = FriendSchema.safeParse(raw.addedBy);
      if (!addedBy.success) return { success: false as const, error: "invalid list item card" };
      cards.push({ item: item.data, event: event.data, addedBy: addedBy.data });
    }
    return { success: true as const, data: cards };
  },
};

/** One-list aggregate: the list itself, its participants (shared collections) and its item cards. */
export interface ListScreen {
  list: List;
  participants: Friend[];
  items: ListItemCard[];
}

const ListScreenSchema: ZodSchema<ListScreen> = {
  safeParse(data: unknown) {
    if (typeof data !== "object" || data === null) return { success: false as const, error: "expected a list screen payload" };
    const raw = data as Record<string, unknown>;
    const list = ListSchema.safeParse(raw.list);
    const items = ListItemCardArraySchema.safeParse(raw.items);
    if (!list.success || !items.success || !Array.isArray(raw.participants)) return { success: false as const, error: "invalid list screen payload" };
    const participants: Friend[] = [];
    for (const participant of raw.participants) {
      const parsed = FriendSchema.safeParse(participant);
      if (!parsed.success) return { success: false as const, error: "invalid list screen payload" };
      participants.push(parsed.data);
    }
    return { success: true as const, data: { list: list.data, participants, items: items.data } };
  },
};

/** Save-to-list payload: the owner user and the saved event; the userId field is a mock-only convenience ignored by the real backend (identity comes from the init-data token). */
export interface AddListItem {
  userId: string;
  eventId: string;
}

export function withLists<TBase extends ApiMixin>(Base: TBase) {
  return class ListEndpoints extends Base {
    listLists(userId: string, eventId?: string): Promise<ListSummary[]> {
      const query = new URLSearchParams({ userId });
      if (eventId !== undefined) query.set("eventId", eventId);
      return this.request(`/lists?${query.toString()}`, ListSummaryArraySchema);
    }

    createList(title: string): Promise<List> {
      return this.request("/lists", ListSchema, { body: { title } });
    }

    renameList(listId: string, title: string): Promise<List> {
      return this.request(`/lists/${listId}`, ListSchema, { method: "PATCH", body: { title } });
    }

    deleteList(listId: string): Promise<List> {
      return this.request(`/lists/${listId}`, ListSchema, { method: "DELETE" });
    }

    addListItem(listId: string, payload: AddListItem): Promise<ListItem> {
      return this.request(`/lists/${listId}/items`, ListItemSchema, { body: payload });
    }

    removeListItem(listId: string, itemId: string): Promise<ListItem> {
      return this.request(`/lists/${listId}/items/${itemId}`, ListItemSchema, { method: "DELETE" });
    }

    getList(listId: string): Promise<ListScreen> {
      return this.request(`/lists/${listId}`, ListScreenSchema);
    }

    listSubscriptions(): Promise<Subscription[]> {
      return this.request("/subscriptions", SubscriptionSchema.array());
    }

    createSubscription(payload: CreateSubscription): Promise<Subscription> {
      return this.request("/subscriptions", SubscriptionSchema, { body: payload });
    }

    removeSubscription(id: string): Promise<Subscription> {
      return this.request(`/subscriptions/${id}`, SubscriptionSchema, { method: "DELETE" });
    }
  };
}
