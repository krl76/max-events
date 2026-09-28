// START_MODULE_CONTRACT
// PURPOSE: Модель рельса историй над лентой: кто стоит в рельсе, чьё кольцо горит фирменным градиентом и какие истории уже просмотрены.
// SCOPE: Чистая сборка плиток и групп просмотрщика плюс клиентское хранилище просмотров; признака «просмотрено» у GET /stories нет (#502), поэтому просмотры лежат в localStorage под своим ключом, как тема. Разметка рельса — в ../feed/FeedPage.tsx, сам просмотрщик — в ./StoryViewer.tsx.
// DEPENDS: @max-events/api-contracts (Friend, Story), ./StoryViewer.js (StoryGroup), window.localStorage
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - STORY_SEEN_KEY - ключ localStorage с просмотренными историями (по образцу ключа темы)
// - readSeenStories - просмотренные id из localStorage; пустой список вместо падения на любом мусоре
// - mergeSeenStories - чистое слияние текущих просмотров с новыми id, новые в хвосте, старые вытесняются
// - markStoriesSeen - записать просмотр и вернуть актуальный список; сигнатура будущего POST /stories/seen { storyIds } (#502)
// - StoryRailTile - плитка друга: обложка, короткое имя, состояние кольца и группа просмотрщика
// - StoryRailOwn - своя плитка рельса: обложка своей истории (или её отсутствие) и своя группа
// - StoryRail - рельс целиком: своя плитка, плитки друзей и группы просмотрщика в одном порядке
// - storyRail - чистая сборка рельса: непросмотренные слева, полностью просмотренные уходят вправо, друзей без историй в рельсе нет
// END_MODULE_MAP

import type { Friend, Story } from "@max-events/api-contracts";
import type { StoryGroup } from "./StoryViewer";

/** Отдельный ключ, как у темы: сервер просмотров не хранит, а кольцо, которое никогда не гаснет, бессмысленно. */
export const STORY_SEEN_KEY = "max-events:stories-seen";

/** История живёт сутки, а ключ — до переустановки: без потолка список рос бы вечно. */
const SEEN_LIMIT = 500;

export function readSeenStories(): string[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORY_SEEN_KEY);
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function mergeSeenStories(current: readonly string[], storyIds: readonly string[]): string[] {
  const merged = [...current.filter((id) => !storyIds.includes(id)), ...storyIds];
  return merged.slice(Math.max(0, merged.length - SEEN_LIMIT));
}

/**
 * Отметить истории просмотренными. Подпись повторяет будущий `POST /stories/seen { storyIds }`: на
 * вход — список id, на выход — состояние просмотров целиком, ровно как ответит эндпоинт, когда
 * колонка появится (#502). До тех пор состояние клиентское.
 */
export function markStoriesSeen(storyIds: readonly string[]): string[] {
  const next = mergeSeenStories(readSeenStories(), storyIds);
  if (typeof window !== "undefined") window.localStorage.setItem(STORY_SEEN_KEY, JSON.stringify(next));
  return next;
}

export interface StoryRailTile {
  friendId: string;
  /** Короткое имя под кружком: в рельсе помещается одно слово. */
  name: string;
  /** Буква для кружка без обложки. */
  initial: string;
  /** Обложка — самая свежая история автора, как в инстаграме. */
  coverUrl: string;
  /** Аватар автора: кольцо рисуется вокруг него, а не вокруг кадра истории. */
  avatarUrl: string | null;
  /** Сколько историй у автора сейчас в рельсе. */
  storyCount: number;
  /** Сколько из них зритель ещё не открывал. */
  unseenCount: number;
  /** Осталась хоть одна непросмотренная история — кольцо фирменного градиента, иначе нейтральная обводка. */
  unseen: boolean;
  /** Индекс группы в просмотрщике. */
  group: number;
}

export interface StoryRailOwn {
  /** Обложка своей свежей истории; null — историй нет, в кольце аватар. */
  coverUrl: string | null;
  storyCount: number;
  unseenCount: number;
  unseen: boolean;
  /** Своя группа просмотрщика; null — смотреть нечего, кружок только открывает редактор. */
  group: number | null;
}

export interface StoryRail {
  own: StoryRailOwn;
  tiles: StoryRailTile[];
  groups: StoryGroup[];
}

/** Истории автора — по возрасту: просмотрщик листает их от старой к свежей, обложка берётся с последней. */
function byAge(first: Story, second: Story): number {
  return first.createdAt < second.createdAt ? -1 : first.createdAt > second.createdAt ? 1 : 0;
}

export function storyRail(friends: readonly Friend[], stories: readonly Story[], myId: string | null, seen: readonly string[]): StoryRail {
  const seenIds = new Set(seen);
  const anyUnseen = (items: Story[]) => items.some((item) => !seenIds.has(item.id));
  const unseenCount = (items: Story[]) => items.filter((item) => !seenIds.has(item.id)).length;
  const own = myId === null ? [] : stories.filter((item) => item.userId === myId).sort(byAge);
  const authors = friends.map((friend) => ({ friend, items: stories.filter((item) => item.userId === friend.id).sort(byAge) })).filter((author) => author.items.length > 0);
  // Просмотренный автор уходит вправо, непросмотренные остаются слева. Свой кружок в рельсе всегда первый и здесь не участвует.
  const ordered = [...authors.filter((author) => anyUnseen(author.items)), ...authors.filter((author) => !anyUnseen(author.items))];

  const groups: StoryGroup[] = own.length > 0 ? [{ authorName: "Вы", stories: own }] : [];
  const tiles = ordered.map((author) => {
    const group = groups.push({ authorName: author.friend.name, stories: author.items }) - 1;
    return { friendId: author.friend.id, name: author.friend.name.split(" ")[0], initial: author.friend.name[0], coverUrl: author.items[author.items.length - 1].imageUrl, avatarUrl: author.friend.avatarUrl, storyCount: author.items.length, unseenCount: unseenCount(author.items), unseen: anyUnseen(author.items), group };
  });

  return { own: { coverUrl: own.length > 0 ? own[own.length - 1].imageUrl : null, storyCount: own.length, unseenCount: unseenCount(own), unseen: anyUnseen(own), group: own.length > 0 ? 0 : null }, tiles, groups };
}
