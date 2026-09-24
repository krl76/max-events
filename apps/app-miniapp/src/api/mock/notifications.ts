// START_MODULE_CONTRACT
// PURPOSE: Mock notifications store: the seven entries of макет, экран 07 with their read state, their decisions and the unread count behind the feed header bell.
// SCOPE: Fixtures and in-memory read/answer state only; the HTTP surface is in ./notifications.routes.ts. The whole domain is a mock — nothing on the backend keeps an inbox (#494), the schedulers there only send MAX DMs — so the store is what the signature in ../endpoints/notifications.ts promises until that endpoint exists.
// DEPENDS: ../client.js, ./fixtures.js, ./plans.js
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - mockNotifications - the inbox of экран 07 for one viewer, newest first (mock GET /notifications)
// - mockNotificationsSummary - unread count behind the feed header bell (mock GET /notifications/summary)
// - markMockNotificationRead - mock POST /notifications/:id/read; idempotent, the first readAt stands; null for an unknown entry
// - markAllMockNotificationsRead - mock POST /notifications/read-all: the whole inbox read, answering the count the bell should now show
// - answerMockNotification - mock POST /notifications/:id/answer: records which pill was pressed; "no_notification" / "no_action" for the two 404s
// - resetMockNotifications - restore the seeded read state and drop the answers (test isolation)
// END_MODULE_MAP

import type { AppNotification, NotificationAction, NotificationLink, NotificationType, NotificationsSummary } from "../client";
import { mockFriends, mockEvents, mockPlaces } from "./fixtures";
import { mockPlans } from "./plans";

const MINUTE_MS = 60 * 1000;

/**
 * One seeded entry. Timestamps are relative — the inbox says «12 минут назад», and a fixed stamp
 * would drift into «3 дня назад» by the time anyone opens the screen — so createdAt and deadlineAt
 * are computed from the wall clock on every read, the way the feed cards already do it.
 */
interface NotificationSeed {
  id: string;
  type: NotificationType;
  /** Index into mockFriends, or null when nobody caused the notification. */
  actor: number | null;
  title: string;
  body: string;
  quote: string | null;
  agoMinutes: number;
  link: NotificationLink | null;
  actions: NotificationAction[];
  /** Seconds left on the decision when the screen is opened; null when nothing expires. */
  deadlineSeconds: number | null;
  urgent: boolean;
  /** Seeded read state: the three newest decisions are the «3» the header bell shows in the design. */
  read: boolean;
}

/**
 * Экран 07 as the design draws it: four decisions and three lines of history.
 *
 * The copy is the design's, the ids are the fixtures': «Концерт The Weekend» and «джаз в „Эссе"» have
 * no fixture of their own, so the entries that lead somewhere point at the nearest real object rather
 * than at an id nothing would open. The same arrangement the seeded feed cards use.
 */
const MOCK_NOTIFICATION_SEEDS: readonly NotificationSeed[] = [
  {
    id: "f1000000-0000-4000-8000-000000000001",
    type: "leave-now",
    actor: 1,
    title: "Концерт The Weekend через 1 ч 40 мин",
    body: "Дима уже вышел из дома. До места 28 минут. Если выйдешь сейчас — будешь за 20 минут до начала.",
    quote: null,
    agoMinutes: 12,
    link: null,
    actions: [{ id: "route", label: "Посмотреть маршрут", tone: "primary", link: { target: "map", id: null } }],
    deadlineSeconds: null,
    urgent: false,
    read: false,
  },
  {
    id: "f1000000-0000-4000-8000-000000000002",
    type: "weather",
    actor: null,
    title: "Дождь начнётся к 19:00",
    body: "Мангальная зона завтра в 14:00 — до 18:00 сухо, дальше ливень. У площадки свободна беседка с навесом на те же часы.",
    quote: null,
    agoMinutes: 20,
    link: null,
    // Две пилюли — это выбор, а не переход: «Оставить как есть» никуда не ведёт, она отвечает.
    actions: [
      { id: "move-under-roof", label: "Перенести под навес", tone: "confirm", link: { target: "slot-booking", id: mockPlaces[0].id } },
      { id: "keep", label: "Оставить как есть", tone: "secondary", link: null },
    ],
    deadlineSeconds: null,
    urgent: false,
    read: false,
  },
  {
    id: "f1000000-0000-4000-8000-000000000003",
    type: "seat-freed",
    actor: null,
    title: "Освободилось место на корт в Лужниках",
    body: "Слот 19:00–21:00 свободен по твоему листу ожидания. У тебя 14 минут на подтверждение брони.",
    quote: null,
    agoMinutes: 28,
    link: null,
    actions: [{ id: "take-slot", label: "Занять слот", tone: "primary", link: { target: "slot-booking", id: mockPlaces[2].id } }],
    // 14:18 на кнопке в макете — это остаток до истечения предложения, поэтому он тикает, а не нарисован.
    deadlineSeconds: 14 * 60 + 18,
    // Единственная срочная запись набора: бронь и её отмена проходят сквозь тихие часы, всё остальное ждёт.
    urgent: true,
    read: false,
  },
  {
    id: "f1000000-0000-4000-8000-000000000004",
    type: "weather",
    actor: null,
    title: "В 19:00 возможен кратковременный дождь",
    body: "Перенести встречу компании с открытой лужайки под навес беседки №4?",
    quote: null,
    agoMinutes: 60,
    link: null,
    actions: [{ id: "pick-gazebo", label: "Выбрать беседку с навесом", tone: "confirm", link: { target: "slot-booking", id: mockPlaces[0].id } }],
    deadlineSeconds: null,
    urgent: false,
    read: true,
  },
  {
    id: "f1000000-0000-4000-8000-000000000005",
    type: "friend-activity",
    actor: 0,
    title: "записалась на джаз в «Эссе» — сегодня в 20:00",
    body: "",
    quote: null,
    agoMinutes: 3 * 60,
    link: { target: "event", id: mockEvents[0].id },
    actions: [],
    deadlineSeconds: null,
    urgent: false,
    read: true,
  },
  {
    id: "f1000000-0000-4000-8000-000000000006",
    type: "plan-message",
    actor: null,
    title: "В плане «Мангал в Горьком» новое сообщение:",
    quote: "кто берёт лимонад?",
    body: "",
    agoMinutes: 26 * 60,
    link: { target: "plan", id: mockPlans[0].plan.id },
    actions: [],
    deadlineSeconds: null,
    urgent: false,
    read: true,
  },
  {
    id: "f1000000-0000-4000-8000-000000000007",
    type: "achievement",
    actor: null,
    title: "Достижение «Собиратель»: 30 компаний собрано",
    body: "",
    quote: null,
    agoMinutes: 2 * 24 * 60,
    link: { target: "achievements", id: null },
    actions: [],
    deadlineSeconds: null,
    urgent: false,
    read: true,
  },
];

/** Ids read by the viewer; seeded from the fixtures so the header bell starts at the «3» of the design. */
const mockReadNotifications = new Set<string>(MOCK_NOTIFICATION_SEEDS.filter((seed) => seed.read).map((seed) => seed.id));

/** By notification id: which pill was pressed. An answered decision stops waiting and drops into «Раньше». */
const mockNotificationAnswers = new Map<string, string>();

function buildNotification(seed: NotificationSeed, now: number): AppNotification {
  const createdAt = new Date(now - seed.agoMinutes * MINUTE_MS);
  return {
    id: seed.id,
    type: seed.type,
    actor: seed.actor === null ? null : mockFriends[seed.actor],
    title: seed.title,
    body: seed.body,
    quote: seed.quote,
    createdAt: createdAt.toISOString(),
    // Точного момента прочтения мок не хранит: важен сам факт, и «прочитано» — это метка времени чтения.
    readAt: mockReadNotifications.has(seed.id) ? new Date(now).toISOString() : null,
    link: seed.link,
    actions: seed.actions.map((action) => ({ ...action, link: action.link === null ? null : { ...action.link } })),
    deadlineAt: seed.deadlineSeconds === null ? null : new Date(now + seed.deadlineSeconds * 1000).toISOString(),
    answeredActionId: mockNotificationAnswers.get(seed.id) ?? null,
    urgent: seed.urgent,
  };
}

/** The inbox of экран 07, newest first. The viewer is ignored: the mock has one demo user, and the parameter exists because the endpoint will read identity from the token. */
export function mockNotifications(): AppNotification[] {
  const now = Date.now();
  return MOCK_NOTIFICATION_SEEDS.map((seed) => buildNotification(seed, now)).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

/** What the header bell shows: the notifications nobody has read yet, counted rather than fixed. */
export function mockNotificationsSummary(): NotificationsSummary {
  return { unreadCount: MOCK_NOTIFICATION_SEEDS.filter((seed) => !mockReadNotifications.has(seed.id)).length };
}

/** Marks one entry read; idempotent. Null for an unknown id (mock 404). */
export function markMockNotificationRead(id: string): AppNotification | null {
  const seed = MOCK_NOTIFICATION_SEEDS.find((candidate) => candidate.id === id);
  if (seed === undefined) return null;
  mockReadNotifications.add(id);
  return buildNotification(seed, Date.now());
}

/** Marks the whole inbox read and answers with the count the bell should now show. */
export function markAllMockNotificationsRead(): NotificationsSummary {
  for (const seed of MOCK_NOTIFICATION_SEEDS) mockReadNotifications.add(seed.id);
  return mockNotificationsSummary();
}

/**
 * Records the answer to a decision. Answering also reads the entry: you cannot decide something you
 * have not seen, and leaving it unread would keep the bell counting a question already settled.
 */
export function answerMockNotification(id: string, actionId: string): AppNotification | "no_notification" | "no_action" {
  const seed = MOCK_NOTIFICATION_SEEDS.find((candidate) => candidate.id === id);
  if (seed === undefined) return "no_notification";
  if (!seed.actions.some((action) => action.id === actionId)) return "no_action";
  mockNotificationAnswers.set(id, actionId);
  mockReadNotifications.add(id);
  return buildNotification(seed, Date.now());
}

export function resetMockNotifications(): void {
  mockReadNotifications.clear();
  for (const seed of MOCK_NOTIFICATION_SEEDS) {
    if (seed.read) mockReadNotifications.add(seed.id);
  }
  mockNotificationAnswers.clear();
}
