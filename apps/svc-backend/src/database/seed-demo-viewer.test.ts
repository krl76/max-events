import { describe, expect, it } from "vitest";
import { ACHIEVEMENT_CATALOG } from "../achievements/achievements.service";
import { buildDemoData } from "./seed-demo";

const now = new Date("2026-09-16T12:00:00Z");
const ownerUserId = "11111111-1111-4111-8111-111111111111";
const devUserId = "22222222-2222-4222-8222-222222222222";

function build() {
  return buildDemoData({ now, scale: "normal", ownerUserId, devUserId });
}

function futureEventIds(data: ReturnType<typeof build>): Set<string> {
  return new Set(data.events.filter((event) => event.startsAt.getTime() > now.getTime()).map((event) => event.id));
}

describe("the viewer's plans, groups and votes", () => {
  it("hosts one plan and joins another, with money shared in both", () => {
    const data = build();
    const hosted = data.plans.filter((plan) => plan.hostUserId === devUserId);
    const joined = data.planParticipants.filter((row) => row.userId === devUserId);
    expect(hosted.length).toBeGreaterThanOrEqual(1);
    expect(joined.length).toBeGreaterThanOrEqual(1);
    for (const plan of hosted) expect(data.planParticipants.filter((row) => row.planId === plan.id).length).toBeGreaterThanOrEqual(2);
    const mine = new Set([...hosted.map((plan) => plan.id), ...joined.map((row) => row.planId)]);
    const expenses = data.planExpenses.filter((row) => mine.has(row.planId));
    expect(expenses.length).toBeGreaterThanOrEqual(2);
    for (const expense of expenses) expect(expense.shareUserIds).toContain(devUserId);
    // Приглашение имеет смысл, только если хозяин — не сам зритель.
    expect(data.plans.some((plan) => plan.hostUserId !== devUserId && joined.some((row) => row.planId === plan.id))).toBe(true);
  });

  it("puts the viewer in two live groups and one archive", () => {
    const data = build();
    const membership = new Set(data.weGroupMembers.filter((row) => row.userId === devUserId).map((row) => row.groupId));
    const groups = data.weGroups.filter((group) => membership.has(group.id));
    expect(groups.filter((group) => group.status === "active").length).toBeGreaterThanOrEqual(2);
    expect(groups.filter((group) => group.status === "archived")).toHaveLength(1);
    for (const group of groups) expect(group.archivedAt === null).toBe(group.status === "active");
  });

  it("fills the viewer's own group with events, a place, a budget and photos", () => {
    const data = build();
    const owned = data.weGroups.find((group) => group.ownerUserId === devUserId);
    expect(owned).toBeDefined();
    const items = data.weGroupItems.filter((row) => row.groupId === owned!.id);
    const groupEventIds = new Set(items.flatMap((row) => (row.eventId === null ? [] : [row.eventId])));
    expect(groupEventIds.size).toBeGreaterThanOrEqual(2);
    expect(items.some((row) => row.placeId !== null)).toBe(true);
    const memberIds = new Set(data.weGroupMembers.filter((row) => row.groupId === owned!.id).map((row) => row.userId));
    expect(memberIds.size).toBeGreaterThanOrEqual(3);
    // Бюджет группы считается по расходам плана участника на событии группы — без такого плана экран пуст.
    const groupPlans = data.plans.filter((plan) => groupEventIds.has(plan.eventId) && memberIds.has(plan.hostUserId));
    expect(groupPlans.length).toBeGreaterThanOrEqual(1);
    expect(data.planExpenses.some((row) => groupPlans.some((plan) => plan.id === row.planId))).toBe(true);
    // Галерея группы — это фото из отзывов участников на её события.
    expect(data.reviews.some((row) => memberIds.has(row.userId) && groupEventIds.has(row.eventId) && row.photoUrls.length > 0)).toBe(true);
    expect(data.bookings.some((row) => memberIds.has(row.userId) && groupEventIds.has(row.eventId) && row.status === "active")).toBe(true);
  });

  it("leaves one vote open for the viewer and closes another with a clear winner", () => {
    const data = build();
    const visible = data.votes.filter((vote) => vote.hostUserId === devUserId || data.voteParticipants.some((row) => row.voteId === vote.id && row.userId === devUserId));
    expect(visible.length).toBeGreaterThanOrEqual(2);
    const voted = (voteId: string) => data.voteBallots.some((row) => row.voteId === voteId && row.userId === devUserId);
    const open = visible.filter((vote) => !voted(vote.id));
    const closed = visible.filter((vote) => voted(vote.id));
    expect(open.length).toBeGreaterThanOrEqual(1);
    expect(closed.length).toBeGreaterThanOrEqual(1);
    // В открытом уже есть чужие голоса — экран показывает расклад, но ждёт выбора зрителя.
    for (const vote of open) expect(data.voteBallots.filter((row) => row.voteId === vote.id).length).toBeGreaterThanOrEqual(1);
    for (const vote of closed) {
      const tally = new Map<string, number>();
      for (const ballot of data.voteBallots.filter((row) => row.voteId === vote.id)) tally.set(ballot.eventId, (tally.get(ballot.eventId) ?? 0) + 1);
      const counts = [...tally.values()].sort((a, b) => b - a);
      expect(counts[0]).toBeGreaterThan(counts[1] ?? 0);
      const participants = data.voteParticipants.filter((row) => row.voteId === vote.id).length;
      expect(data.voteBallots.filter((row) => row.voteId === vote.id).length).toBeGreaterThanOrEqual(participants);
    }
  });
});

describe("the viewer's tickets, queue and subscriptions", () => {
  it("holds an active ticket, a past booking, a cancelled one and a paid receipt", () => {
    const data = build();
    const mine = data.bookings.filter((row) => row.userId === devUserId);
    const future = futureEventIds(data);
    expect(mine.some((row) => row.status === "active" && future.has(row.eventId))).toBe(true);
    expect(mine.some((row) => row.status === "active" && !future.has(row.eventId))).toBe(true);
    expect(mine.some((row) => row.status === "cancelled")).toBe(true);
    const receipts = data.payments.filter((payment) => mine.some((booking) => booking.id === payment.bookingId));
    expect(receipts.some((payment) => payment.status === "succeeded" && payment.commissionFixedAt !== null)).toBe(true);
  });

  it("stands in a queue behind other people and holds one offer with a deadline", () => {
    const data = build();
    const queue = data.waitlistEntries.filter((row) => row.userId === devUserId);
    expect([...queue.map((row) => row.status)].sort()).toEqual(["offered", "waiting"]);
    // Позиция считается FIFO по createdAt: впереди зрителя должны стоять чужие заявки, иначе
    // экран покажет «вы первый» и о позиции рассказать будет нечего.
    const waiting = queue.find((row) => row.status === "waiting")!;
    const ahead = data.waitlistEntries.filter((row) => row.eventId === waiting.eventId && row.createdAt.getTime() < waiting.createdAt.getTime());
    expect(ahead.length).toBeGreaterThanOrEqual(1);
    const offered = queue.find((row) => row.status === "offered")!;
    expect(offered.offeredUntil!.getTime()).toBeGreaterThan(now.getTime());
    const aheadOfOffer = data.waitlistEntries.filter((row) => row.eventId === offered.eventId && row.createdAt.getTime() < offered.createdAt.getTime());
    expect(aheadOfOffer).toHaveLength(0);
  });

  it("subscribes the viewer to organizers, places and interests alike", () => {
    const data = build();
    const mine = data.subscriptions.filter((row) => row.userId === devUserId);
    expect(new Set(mine.map((row) => row.type))).toEqual(new Set(["organizer", "place", "interest"]));
    expect(new Set(mine.map((row) => row.organizerUserId ?? row.placeId ?? row.interest)).size).toBe(mine.length);
  });
});

describe("the viewer's lists, visits and company", () => {
  it("fills every preset list and adds a custom one", () => {
    const data = build();
    const mine = data.lists.filter((row) => row.userId === devUserId);
    expect(mine.filter((row) => row.preset !== null)).toHaveLength(2);
    expect(mine.filter((row) => row.preset === null).length).toBeGreaterThanOrEqual(1);
    for (const list of mine) expect(data.listItems.filter((item) => item.listId === list.id).length).toBeGreaterThanOrEqual(1);
  });

  it("grants part of the viewer's achievements and leaves part in progress", () => {
    const data = build();
    const granted = data.userAchievements.filter((row) => row.userId === devUserId).map((row) => row.code);
    expect(granted.length).toBeGreaterThanOrEqual(1);
    expect(granted.length).toBeLessThan(ACHIEVEMENT_CATALOG.length);
    // Значок держится на визитах, а не на выдумке: у выданного достижения порог должен быть закрыт.
    const visits = data.checkIns.filter((row) => row.userId === devUserId);
    const visitedPlaceIds = new Set(visits.flatMap((row) => (row.placeId === null ? [] : [row.placeId])));
    for (const visit of visits) {
      const event = data.events.find((row) => row.id === visit.eventId);
      if (event?.placeId) visitedPlaceIds.add(event.placeId);
    }
    expect(granted).toContain("city_explorer");
    expect(visitedPlaceIds.size).toBeGreaterThanOrEqual(ACHIEVEMENT_CATALOG.find((item) => item.code === "city_explorer")!.threshold);
    // «Музыкальный фанат» остаётся недобранным — экран рисует прогресс, а не только выданное.
    expect(granted).not.toContain("music_fan");
    expect(visits.filter((row) => data.events.find((event) => event.id === row.eventId)?.category === "afisha").length).toBeGreaterThanOrEqual(1);
  });

  it("leaves the viewer reviews, visits and a company gathered both ways", () => {
    const data = build();
    const reviews = data.reviews.filter((row) => row.userId === devUserId);
    expect(reviews.length).toBeGreaterThanOrEqual(2);
    expect(reviews.some((row) => row.photoUrls.length > 0)).toBe(true);
    expect(data.checkIns.filter((row) => row.userId === devUserId && row.eventId !== null).length).toBeGreaterThanOrEqual(1);
    expect(data.gatherings.some((row) => row.hostUserId === devUserId)).toBe(true);
    expect(data.gatheringInvitees.some((row) => row.userId === devUserId)).toBe(true);
    expect(data.microEvents.some((row) => row.authorId === devUserId)).toBe(true);
    expect(data.microEventParticipants.some((row) => row.userId === devUserId)).toBe(true);
    expect(data.participations.filter((row) => row.userId === devUserId).length).toBeGreaterThanOrEqual(3);
  });
});
