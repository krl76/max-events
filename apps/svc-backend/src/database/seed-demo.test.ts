import { describe, expect, it } from "vitest";
import { EventCategorySchema, ListPresetSchema } from "@max-events/api-contracts";
import { assertLocalDatabaseUrl, buildDemoData, DEMO_COUNTS, parseDemoScale } from "./seed-demo";

const now = new Date("2026-09-16T12:00:00Z");
const ownerUserId = "11111111-1111-4111-8111-111111111111";
const devUserId = "22222222-2222-4222-8222-222222222222";

function build() {
  return buildDemoData({ now, scale: "normal", ownerUserId, devUserId });
}

describe("parseDemoScale", () => {
  it("defaults to normal and validates the allowed values", () => {
    expect(parseDemoScale(undefined)).toBe("normal");
    expect(parseDemoScale("")).toBe("normal");
    expect(parseDemoScale("small")).toBe("small");
    expect(parseDemoScale("big")).toBe("big");
    expect(() => parseDemoScale("huge")).toThrow(/SEED_DEMO_SCALE/);
  });
});

describe("assertLocalDatabaseUrl", () => {
  it("allows only localhost and 127.0.0.1 hosts", () => {
    expect(() => assertLocalDatabaseUrl("postgres://u:p@localhost:5443/db")).not.toThrow();
    expect(() => assertLocalDatabaseUrl("postgres://u:p@127.0.0.1:5443/db")).not.toThrow();
    expect(() => assertLocalDatabaseUrl("postgres://u:p@db.prod.example.com:5432/db")).toThrow(/non-local/);
    expect(() => assertLocalDatabaseUrl("not-a-url")).toThrow(/valid DATABASE_URL/);
  });
});

describe("buildDemoData", () => {
  it("is deterministic for the same config", () => {
    expect(JSON.stringify(build())).toBe(JSON.stringify(build()));
  });

  it("generates the configured volumes", () => {
    const data = build();
    expect(data.users).toHaveLength(DEMO_COUNTS.normal.users);
    expect(data.places).toHaveLength(DEMO_COUNTS.normal.places);
    expect(data.events).toHaveLength(DEMO_COUNTS.normal.events);
    expect(data.stories).toHaveLength(DEMO_COUNTS.normal.stories);
    expect(data.feedPosts).toHaveLength(DEMO_COUNTS.normal.feedPosts);
    expect(data.reviews).toHaveLength(DEMO_COUNTS.normal.reviews);
    expect(data.checkIns).toHaveLength(DEMO_COUNTS.normal.checkIns);
    expect(data.bookings).toHaveLength(DEMO_COUNTS.normal.bookings);
    expect(data.participations).toHaveLength(DEMO_COUNTS.normal.participations);
    expect(data.plans).toHaveLength(DEMO_COUNTS.normal.plans);
    expect(data.votes).toHaveLength(DEMO_COUNTS.normal.votes);
    expect(data.weGroups).toHaveLength(DEMO_COUNTS.normal.weGroups);
    expect(data.gatherings).toHaveLength(DEMO_COUNTS.normal.gatherings);
    expect(data.microEvents).toHaveLength(DEMO_COUNTS.normal.microEvents);
    expect(data.subscriptions).toHaveLength(DEMO_COUNTS.normal.subscriptions);
    expect(data.pageViews).toHaveLength(DEMO_COUNTS.normal.pageViews);
    expect(data.lists).toHaveLength(ListPresetSchema.options.length);
  });

  it("keeps referential integrity across every generated table", () => {
    const data = build();
    const userIds = new Set([...data.users.map((user) => user.id), ownerUserId, devUserId]);
    const placeIds = new Set(data.places.map((place) => place.id));
    const eventIds = new Set(data.events.map((event) => event.id));
    const pastEventIds = new Set(data.events.filter((event) => event.startsAt.getTime() < now.getTime()).map((event) => event.id));
    const futureEventIds = new Set(data.events.filter((event) => event.startsAt.getTime() > now.getTime()).map((event) => event.id));
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

    expect(new Set(data.users.map((user) => user.maxUserId)).size).toBe(data.users.length);
    for (const user of data.users) {
      expect(user.id).toMatch(uuidPattern);
      expect(user.username === null || user.username.length <= 64).toBe(true);
    }
    for (const profile of data.profiles) {
      expect(userIds.has(profile.userId)).toBe(true);
    }
    expect(new Set(data.profiles.map((profile) => profile.userId))).toEqual(new Set(data.users.map((user) => user.id)));

    for (const friendship of data.friendships) {
      expect(userIds.has(friendship.userId)).toBe(true);
      expect(userIds.has(friendship.friendUserId)).toBe(true);
    }
    const friendshipEdges = data.friendships.map((edge) => `${edge.userId}->${edge.friendUserId}`);
    expect(new Set(friendshipEdges).size).toBe(friendshipEdges.length);
    const friendTargets = new Set(data.friendships.filter((edge) => edge.userId === ownerUserId).map((edge) => edge.friendUserId));
    expect(friendTargets.size).toBeGreaterThanOrEqual(10);

    for (const place of data.places) {
      expect(place.city).toBe("Москва");
      expect(place.published).toBe(true);
      expect(place.latitude).toBeGreaterThan(55);
      expect(place.latitude).toBeLessThan(56);
      expect(place.longitude).toBeGreaterThan(37);
      expect(place.longitude).toBeLessThan(38);
      if (place.organizerUserId !== null) expect(userIds.has(place.organizerUserId)).toBe(true);
    }

    const categories = new Set<string>();
    for (const event of data.events) {
      categories.add(event.category);
      expect(event.published).toBe(true);
      expect(event.placeId === null || placeIds.has(event.placeId)).toBe(true);
      expect(event.organizerUserId === null || userIds.has(event.organizerUserId)).toBe(true);
      if (event.isPaid) {
        expect(event.priceRub).toBeGreaterThan(0);
        expect(event.paymentUrl).toMatch(/^https:\/\//);
      } else {
        expect(event.priceRub).toBeNull();
        expect(event.paymentUrl).toBeNull();
      }
      expect(event.startsAt.getTime()).toBeGreaterThanOrEqual(now.getTime() - 8 * 24 * 3_600_000);
      expect(event.startsAt.getTime()).toBeLessThanOrEqual(now.getTime() + 31 * 24 * 3_600_000);
    }
    expect([...EventCategorySchema.options].every((category) => categories.has(category))).toBe(true);

    const organizerEventIds = new Set(data.events.filter((event) => event.organizerUserId !== null).map((event) => event.id));
    for (const promoCode of data.promoCodes) expect(organizerEventIds.has(promoCode.eventId)).toBe(true);
    for (const campaign of data.promoCampaigns) expect(organizerEventIds.has(campaign.eventId)).toBe(true);
    for (const promotion of data.promotionCampaigns) {
      expect(eventIds.has(promotion.eventId)).toBe(true);
      expect(userIds.has(promotion.organizerUserId)).toBe(true);
    }

    const participationPairs = new Set<string>();
    for (const participation of data.participations) {
      expect(userIds.has(participation.userId)).toBe(true);
      expect(eventIds.has(participation.eventId)).toBe(true);
      participationPairs.add(`${participation.userId}:${participation.eventId}`);
    }
    expect(participationPairs.size).toBe(data.participations.length);

    for (const booking of data.bookings) {
      expect(userIds.has(booking.userId)).toBe(true);
      expect(futureEventIds.has(booking.eventId)).toBe(true);
    }

    for (const checkIn of data.checkIns) {
      expect(userIds.has(checkIn.userId)).toBe(true);
      expect((checkIn.eventId !== null) !== (checkIn.placeId !== null)).toBe(true);
      if (checkIn.eventId !== null) expect(pastEventIds.has(checkIn.eventId)).toBe(true);
      if (checkIn.placeId !== null) expect(placeIds.has(checkIn.placeId)).toBe(true);
    }

    for (const story of data.stories) {
      expect(userIds.has(story.userId)).toBe(true);
      expect(story.imageUrl).toMatch(/^https:\/\/picsum\.photos\/seed\//);
    }
    for (const post of data.feedPosts) {
      expect(userIds.has(post.authorUserId)).toBe(true);
      expect(eventIds.has(post.eventId)).toBe(true);
      expect(post.text.length).toBeGreaterThan(0);
    }
    for (const review of data.reviews) {
      expect(userIds.has(review.userId)).toBe(true);
      expect(pastEventIds.has(review.eventId)).toBe(true);
      expect(review.stars).toBeGreaterThanOrEqual(1);
      expect(review.stars).toBeLessThanOrEqual(5);
    }
    for (const subscription of data.subscriptions) {
      expect(userIds.has(subscription.userId)).toBe(true);
      expect(subscription.type === "organizer" ? subscription.organizerUserId !== null : true).toBe(true);
      expect(subscription.type === "place" ? subscription.placeId !== null : true).toBe(true);
      expect(subscription.type === "interest" ? subscription.interest !== null : true).toBe(true);
    }

    const viewTuples = new Set<string>();
    for (const view of data.pageViews) {
      expect(userIds.has(view.userId)).toBe(true);
      expect(view.targetType === "event" ? eventIds.has(view.targetId) : placeIds.has(view.targetId)).toBe(true);
      expect(view.viewedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      viewTuples.add(`${view.userId}:${view.targetType}:${view.targetId}:${view.viewedOn}`);
    }
    expect(viewTuples.size).toBe(data.pageViews.length);

    const listIds = new Set(data.lists.map((list) => list.id));
    for (const list of data.lists) expect(list.userId).toBe(ownerUserId);
    for (const item of data.listItems) {
      expect(listIds.has(item.listId)).toBe(true);
      expect((item.eventId !== null) !== (item.placeId !== null)).toBe(true);
      if (item.eventId !== null) expect(eventIds.has(item.eventId)).toBe(true);
      if (item.placeId !== null) expect(placeIds.has(item.placeId)).toBe(true);
    }

    const voteOptionEvents = new Map<string, Set<string>>();
    for (const option of data.voteOptions) {
      expect(eventIds.has(option.eventId)).toBe(true);
      const events = voteOptionEvents.get(option.voteId) ?? new Set<string>();
      events.add(option.eventId);
      voteOptionEvents.set(option.voteId, events);
    }
    for (const vote of data.votes) expect(vote.hostUserId).toBe(ownerUserId);
    for (const participant of data.voteParticipants) expect(userIds.has(participant.userId)).toBe(true);
    const ballotPairs = new Set<string>();
    for (const ballot of data.voteBallots) {
      expect(userIds.has(ballot.userId)).toBe(true);
      expect(voteOptionEvents.get(ballot.voteId)?.has(ballot.eventId)).toBe(true);
      ballotPairs.add(`${ballot.voteId}:${ballot.userId}`);
    }
    expect(ballotPairs.size).toBe(data.voteBallots.length);

    const groupIds = new Set(data.weGroups.map((group) => group.id));
    for (const member of data.weGroupMembers) {
      expect(groupIds.has(member.groupId)).toBe(true);
      expect(userIds.has(member.userId)).toBe(true);
    }
    const memberPairs = new Set(data.weGroupMembers.map((member) => `${member.groupId}:${member.userId}`));
    expect(memberPairs.size).toBe(data.weGroupMembers.length);
    for (const item of data.weGroupItems) {
      expect(groupIds.has(item.groupId)).toBe(true);
      expect((item.eventId !== null) !== (item.placeId !== null)).toBe(true);
      if (item.eventId !== null) expect(eventIds.has(item.eventId)).toBe(true);
      if (item.placeId !== null) expect(placeIds.has(item.placeId)).toBe(true);
    }

    const gatheringIds = new Set(data.gatherings.map((gathering) => gathering.id));
    for (const gathering of data.gatherings) {
      expect(userIds.has(gathering.hostUserId)).toBe(true);
      expect(futureEventIds.has(gathering.eventId)).toBe(true);
    }
    const inviteePairs = new Set<string>();
    for (const invitee of data.gatheringInvitees) {
      expect(gatheringIds.has(invitee.gatheringId)).toBe(true);
      expect(userIds.has(invitee.userId)).toBe(true);
      inviteePairs.add(`${invitee.gatheringId}:${invitee.userId}`);
    }
    expect(inviteePairs.size).toBe(data.gatheringInvitees.length);

    const microEventIds = new Set(data.microEvents.map((microEvent) => microEvent.id));
    for (const microEvent of data.microEvents) {
      expect(userIds.has(microEvent.authorId)).toBe(true);
      expect(microEvent.participantsLimit).toBeGreaterThan(0);
      expect(microEvent.startsAt.getTime()).toBeGreaterThan(now.getTime());
    }
    const microPairs = new Set<string>();
    for (const participant of data.microEventParticipants) {
      expect(microEventIds.has(participant.microEventId)).toBe(true);
      expect(userIds.has(participant.userId)).toBe(true);
      microPairs.add(`${participant.microEventId}:${participant.userId}`);
    }
    expect(microPairs.size).toBe(data.microEventParticipants.length);

    const planIds = new Set(data.plans.map((plan) => plan.id));
    for (const plan of data.plans) {
      expect(userIds.has(plan.hostUserId)).toBe(true);
      expect(futureEventIds.has(plan.eventId)).toBe(true);
    }
    const planParticipantPairs = new Set<string>();
    for (const participant of data.planParticipants) {
      expect(planIds.has(participant.planId)).toBe(true);
      expect(userIds.has(participant.userId)).toBe(true);
      const plan = data.plans.find((row) => row.id === participant.planId);
      expect(participant.userId).not.toBe(plan?.hostUserId);
      planParticipantPairs.add(`${participant.planId}:${participant.userId}`);
    }
    expect(planParticipantPairs.size).toBe(data.planParticipants.length);
    for (const expense of data.planExpenses) {
      expect(planIds.has(expense.planId)).toBe(true);
      expect(userIds.has(expense.payerUserId)).toBe(true);
      const allowed = new Set([...data.plans.filter((plan) => plan.id === expense.planId).flatMap((plan) => [plan.hostUserId]), ...data.planParticipants.filter((row) => row.planId === expense.planId).map((row) => row.userId)]);
      for (const shared of expense.shareUserIds) expect(allowed.has(shared)).toBe(true);
      expect(expense.amountRub).toBeGreaterThan(0);
    }
  });

  it("befriends both dev users with a share of generated users", () => {
    const data = build();
    const ownerFriends = new Set(data.friendships.filter((edge) => edge.userId === ownerUserId).map((edge) => edge.friendUserId));
    const devFriends = new Set(data.friendships.filter((edge) => edge.userId === devUserId).map((edge) => edge.friendUserId));
    expect(ownerFriends.size).toBeGreaterThan(5);
    expect(devFriends.size).toBeGreaterThan(5);
    expect(data.plans.filter((plan) => plan.hostUserId === ownerUserId).length).toBeGreaterThanOrEqual(2);
  });
});
