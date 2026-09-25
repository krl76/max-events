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

  it("names the way out in the refusal, so the стенд case does not look impossible", () => {
    expect(() => assertLocalDatabaseUrl("postgres://u:p@postgres:5432/db")).toThrow(/SEED_DEMO_ALLOW_REMOTE=1/);
  });

  // Стенд без контура MAX держит базу в сети docker под именем `postgres`: локальной она не выглядит,
  // а демо-данные там и нужны. Ключ отдельный и в обычном запуске отсутствует.
  it("opens a deliberately named host when allowRemote is passed", () => {
    expect(() => assertLocalDatabaseUrl("postgres://u:p@postgres:5432/db", true)).not.toThrow();
    // Разрешение не отменяет проверку самой строки: мусор остаётся мусором.
    expect(() => assertLocalDatabaseUrl("not-a-url", true)).toThrow(/valid DATABASE_URL/);
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
    expect(data.pageViews).toHaveLength(DEMO_COUNTS.normal.pageViews);
    expect(data.feedLikes).toHaveLength(DEMO_COUNTS.normal.feedLikes);
    expect(data.feedComments).toHaveLength(DEMO_COUNTS.normal.feedComments);
    expect(data.reports).toHaveLength(DEMO_COUNTS.normal.reports);
  });

  // Срез зрителя добавляется поверх общего населения, поэтому счётчик масштаба — нижняя граница,
  // а не точное число: иначе любая новая строка «про меня» ломала бы тест на объёмы.
  it("puts the viewer's own rows on top of the configured volumes", () => {
    const data = build();
    expect(data.feedPosts.length).toBeGreaterThan(DEMO_COUNTS.normal.feedPosts);
    expect(data.reviews.length).toBeGreaterThan(DEMO_COUNTS.normal.reviews);
    expect(data.checkIns.length).toBeGreaterThan(DEMO_COUNTS.normal.checkIns);
    expect(data.bookings.length).toBeGreaterThan(DEMO_COUNTS.normal.bookings);
    expect(data.participations.length).toBeGreaterThan(DEMO_COUNTS.normal.participations);
    expect(data.plans.length).toBeGreaterThan(DEMO_COUNTS.normal.plans);
    expect(data.votes.length).toBeGreaterThan(DEMO_COUNTS.normal.votes);
    expect(data.weGroups.length).toBeGreaterThan(DEMO_COUNTS.normal.weGroups);
    expect(data.gatherings.length).toBeGreaterThan(DEMO_COUNTS.normal.gatherings);
    expect(data.microEvents.length).toBeGreaterThan(DEMO_COUNTS.normal.microEvents);
    expect(data.subscriptions.length).toBeGreaterThan(DEMO_COUNTS.normal.subscriptions);
    expect(data.waitlistEntries.length).toBeGreaterThan(DEMO_COUNTS.normal.waitlistEntries);
    expect(data.lists.length).toBeGreaterThan(ListPresetSchema.options.length);
  });

  it("scales the tables the viewer does not own with the demo scale", () => {
    const small = buildDemoData({ now, scale: "small", ownerUserId, devUserId });
    const big = buildDemoData({ now, scale: "big", ownerUserId, devUserId });
    expect(small.feedLikes.length).toBeLessThan(big.feedLikes.length);
    expect(small.feedComments.length).toBeLessThan(big.feedComments.length);
    expect(small.reports.length).toBeLessThan(big.reports.length);
    expect(small.waitlistEntries.length).toBeLessThan(big.waitlistEntries.length);
    expect(small.payments.length).toBeLessThan(big.payments.length);
    expect(small.userAchievements.length).toBeLessThan(big.userAchievements.length);
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

    // Бронь на прошедшее событие есть только у зрителя: без неё вкладка «прошедшие» в календаре пуста.
    for (const booking of data.bookings) {
      expect(userIds.has(booking.userId)).toBe(true);
      expect(eventIds.has(booking.eventId)).toBe(true);
      if (booking.userId !== devUserId) expect(futureEventIds.has(booking.eventId)).toBe(true);
    }
    const activeBookingPairs = data.bookings.filter((row) => row.status === "active").map((row) => `${row.userId}:${row.eventId}`);
    expect(new Set(activeBookingPairs).size).toBe(activeBookingPairs.length);

    // База держит визит уникальным по (человек, событие) и (человек, площадка, день); строка, которая
    // этого не уважает, просто теряется на вставке, и счётчик сида врёт.
    const visitTuples = new Set<string>();
    for (const checkIn of data.checkIns) {
      expect(userIds.has(checkIn.userId)).toBe(true);
      expect((checkIn.eventId !== null) !== (checkIn.placeId !== null)).toBe(true);
      if (checkIn.eventId !== null) expect(pastEventIds.has(checkIn.eventId)).toBe(true);
      if (checkIn.placeId !== null) expect(placeIds.has(checkIn.placeId)).toBe(true);
      visitTuples.add(checkIn.eventId !== null ? `event:${checkIn.userId}:${checkIn.eventId}` : `place:${checkIn.userId}:${checkIn.placeId}:${checkIn.visitDate}`);
    }
    expect(visitTuples.size).toBe(data.checkIns.length);

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
    for (const list of data.lists) expect([ownerUserId, devUserId]).toContain(list.userId);
    const presetPairs = data.lists.filter((list) => list.preset !== null).map((list) => `${list.userId}:${list.preset}`);
    expect(new Set(presetPairs).size).toBe(presetPairs.length);
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
    for (const vote of data.votes) expect(userIds.has(vote.hostUserId)).toBe(true);
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
      // MicroEventSchema отвергает запись, где участников больше лимита, и весь список отвечает 500.
      expect(data.microEventParticipants.filter((row) => row.microEventId === microEvent.id).length).toBeLessThanOrEqual(microEvent.participantsLimit);
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

  it("keeps referential integrity across the tables the seed used to skip", () => {
    const data = build();
    const userIds = new Set([...data.users.map((user) => user.id), ownerUserId, devUserId]);
    const eventIds = new Set(data.events.map((event) => event.id));
    const placeIds = new Set(data.places.map((place) => place.id));
    const postIds = new Set(data.feedPosts.map((post) => post.id));
    const microEventIds = new Set(data.microEvents.map((microEvent) => microEvent.id));

    const likePairs = new Set<string>();
    for (const like of data.feedLikes) {
      expect(postIds.has(like.postId)).toBe(true);
      expect(userIds.has(like.userId)).toBe(true);
      likePairs.add(`${like.postId}:${like.userId}`);
    }
    expect(likePairs.size).toBe(data.feedLikes.length);
    for (const comment of data.feedComments) {
      expect(postIds.has(comment.postId)).toBe(true);
      expect(userIds.has(comment.authorUserId)).toBe(true);
      expect(comment.createdAt.getTime()).toBeLessThanOrEqual(now.getTime());
    }

    // Очередь имеет смысл только на событии, где мест уже нет.
    const queuePairs = new Set<string>();
    for (const entry of data.waitlistEntries) {
      expect(userIds.has(entry.userId)).toBe(true);
      const event = data.events.find((row) => row.id === entry.eventId);
      expect(event?.startsAt.getTime()).toBeGreaterThan(now.getTime());
      expect(event?.capacity).not.toBeNull();
      expect(event!.bookedCount).toBeGreaterThanOrEqual(event!.capacity!);
      queuePairs.add(`${entry.userId}:${entry.eventId}`);
    }
    expect(queuePairs.size).toBe(data.waitlistEntries.length);

    const grantPairs = new Set<string>();
    for (const grant of data.userAchievements) {
      expect(userIds.has(grant.userId)).toBe(true);
      expect(grant.grantedAt.getTime()).toBeLessThanOrEqual(now.getTime());
      grantPairs.add(`${grant.userId}:${grant.code}`);
    }
    expect(grantPairs.size).toBe(data.userAchievements.length);

    const reportTargets = { event: eventIds, place: placeIds, feed_post: postIds, micro_event: microEventIds };
    const reportPairs = new Set<string>();
    for (const report of data.reports) {
      expect(userIds.has(report.userId)).toBe(true);
      expect(reportTargets[report.targetType].has(report.targetId)).toBe(true);
      reportPairs.add(`${report.userId}:${report.targetType}:${report.targetId}`);
    }
    expect(reportPairs.size).toBe(data.reports.length);

    const bookingById = new Map(data.bookings.map((booking) => [booking.id, booking]));
    const eventById = new Map(data.events.map((event) => [event.id, event]));
    for (const payment of data.payments) {
      const booking = bookingById.get(payment.bookingId);
      expect(booking).toBeDefined();
      const event = eventById.get(booking!.eventId);
      expect(event?.isPaid).toBe(true);
      expect(payment.amountRub).toBe(event!.priceRub);
      // Комиссия замораживается только на успешном платеже и всегда сходится с суммой.
      const frozen = payment.status === "succeeded";
      expect(payment.commissionFixedAt !== null).toBe(frozen);
      if (frozen) expect(payment.commissionRub! + payment.netRub!).toBe(payment.amountRub);
    }
    expect(new Set(data.payments.map((payment) => payment.bookingId)).size).toBe(data.payments.length);
    expect(new Set(data.payments.map((payment) => payment.providerPaymentId)).size).toBe(data.payments.length);

    const campaignIds = new Set(data.promoCampaigns.map((campaign) => campaign.id));
    for (const fulfillment of data.promoFulfillments) {
      expect(campaignIds.has(fulfillment.campaignId)).toBe(true);
      expect(userIds.has(fulfillment.referredUserId)).toBe(true);
      expect(bookingById.has(fulfillment.bookingId)).toBe(true);
    }
    // Счётчик кампании обещает столько же приведённых друзей, сколько строк за ним стоит.
    for (const campaign of data.promoCampaigns) {
      expect(campaign.fulfillmentCount).toBe(data.promoFulfillments.filter((row) => row.campaignId === campaign.id).length);
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
