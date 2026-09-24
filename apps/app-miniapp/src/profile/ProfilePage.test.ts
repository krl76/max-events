import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Achievement, Friend, Profile, Subscription, User, WeGroupScreen } from "@max-events/api-contracts";
import type { ListSummary, ProfileCounters, ProfilePost, VisitedPlace } from "../api/client";
import { ProfileView, achievementsHint, followMetrics, friendsHint, listsHint, profileAbout, profileMetrics, profileTabLabel, visitsLabel, weGroupsHint } from "./ProfilePage";

const user: User = {
  id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  maxUserId: "1001",
  firstName: "Кирилл",
  lastName: "Соколов",
  username: null,
  avatarUrl: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const profile: Profile = {
  userId: user.id,
  city: "Москва",
  interests: ["джаз", "падел"],
  smartAlerts: { leaveNow: true, weather: true, friendLeft: true, listDigest: true },
  privacy: { visitHistory: "friends", routes: "friends" },
  recommendationsEnabled: true,
};

const counters: ProfileCounters = { userId: user.id, eventsCount: 112, placesCount: 47, companiesCount: 38 };

const visitedPlaces: VisitedPlace[] = [
  { placeId: "b0000001-0000-4000-8000-000000000001", title: "Парк Горького", visits: 12 },
  { placeId: "b0000003-0000-4000-8000-000000000003", title: "«Лужники»", visits: 9 },
];

function list(id: string, preset: string | null): ListSummary {
  return { list: { id, userId: user.id, preset: preset as ListSummary["list"]["preset"], title: "Полка", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" }, itemsCount: 0, savedItemId: null, participants: [] };
}

function subscription(id: string, type: Subscription["type"]): Subscription {
  return { id, userId: user.id, type, organizerUserId: type === "organizer" ? user.id : null, placeId: type === "place" ? "b0000001-0000-4000-8000-000000000001" : null, interest: type === "interest" ? "джаз" : null, title: "Что-то", createdAt: "2026-01-01T00:00:00Z" };
}

function achievement(code: Achievement["code"], granted: boolean): Achievement {
  return { code, title: code, threshold: 5, progress: granted ? 5 : 1, grantedAt: granted ? "2026-09-06T10:00:00Z" : null };
}

function weGroup(id: string, archived: boolean): WeGroupScreen {
  return {
    group: { id, ownerUserId: user.id, title: "Компания", chatLink: null, status: archived ? "archived" : "active", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", archivedAt: archived ? "2026-02-01T00:00:00Z" : null },
    members: [],
    events: [],
    places: [],
    bookings: [],
    route: null,
    budget: null,
    photos: [],
  };
}

function person(id: string, name: string): Friend {
  return { id, name, avatarUrl: null };
}

function post(postId: string, overrides: Partial<ProfilePost> = {}): ProfilePost {
  return { postId, eventId: "c0000001-0000-4000-8000-000000000001", eventTitle: "Вечер Рахманинова", category: "afisha", photoUrl: null, likesCount: 14, commentsCount: 3, ...overrides };
}

const posts = [post("33000000-0000-4000-8000-000000000001"), post("33000000-0000-4000-8000-000000000002", { category: "sport", eventTitle: "Трейл-забег", likesCount: 9, commentsCount: 1 })];

function renderProfileView(overrides: Partial<Parameters<typeof ProfileView>[0]> = {}): string {
  const noop = () => {};
  return renderToStaticMarkup(
    createElement(ProfileView, {
      user,
      profile,
      counters,
      lists: null,
      subscriptions: null,
      following: null,
      followers: null,
      achievements: null,
      weGroups: null,
      friendsCount: null,
      posts,
      postsFailed: false,
      visitedPlaces,
      tab: "posts",
      onSettings: noop,
      onShare: noop,
      onLists: noop,
      onSubscriptions: noop,
      onFollowers: noop,
      onAchievements: noop,
      onWeGroups: noop,
      onFriends: noop,
      onSubscribe: noop,
      onWrite: noop,
      onInvite: noop,
      onOpenPost: noop,
      onNewPost: noop,
      onOpenPlace: noop,
      onTab: noop,
      ...overrides,
    }),
  );
}

describe("profileAbout", () => {
  it("joins the city and the interests into the one line under the name", () => {
    expect(profileAbout(profile)).toBe("Москва · джаз, падел");
  });

  it("leaves the city alone when there are no interests yet", () => {
    expect(profileAbout({ city: "Казань", interests: [] })).toBe("Казань");
  });
});

describe("profileMetrics", () => {
  it("declines every label for its number", () => {
    expect(profileMetrics(counters)).toEqual([
      { value: 112, label: "событий" },
      { value: 47, label: "мест" },
      { value: 38, label: "компаний" },
    ]);
    expect(profileMetrics({ ...counters, eventsCount: 1, placesCount: 2, companiesCount: 3 }).map((metric) => metric.label)).toEqual(["событие", "места", "компании"]);
  });

  it("drops «компании» rather than printing a zero nobody counted", () => {
    expect(profileMetrics({ ...counters, companiesCount: null }).map((metric) => metric.label)).toEqual(["событий", "мест"]);
  });

  it("has nothing to show before the counters arrive", () => {
    expect(profileMetrics(null)).toEqual([]);
  });
});

describe("followMetrics", () => {
  const following = [person("p1", "Анна"), person("p2", "Дима")];
  const followers = [person("p3", "Катя")];

  it("counts everything the viewer follows as one number over the two stores", () => {
    const metrics = followMetrics({ subscriptions: [subscription("1", "organizer"), subscription("2", "place")], following, followers });

    expect(metrics).toEqual([
      { id: "subscriptions", value: 4, label: "подписки" },
      { id: "followers", value: 1, label: "подписчик" },
    ]);
  });

  it("declines both labels for their number", () => {
    const many = followMetrics({ subscriptions: [], following: [], followers: [] });

    expect(many.map((metric) => metric.label)).toEqual(["подписок", "подписчиков"]);
  });

  it("leaves out a direction that has not answered rather than printing a zero nobody counted", () => {
    expect(followMetrics({ subscriptions: null, following, followers }).map((metric) => metric.id)).toEqual(["followers"]);
    expect(followMetrics({ subscriptions: [], following: null, followers }).map((metric) => metric.id)).toEqual(["followers"]);
    expect(followMetrics({ subscriptions: [], following, followers: null }).map((metric) => metric.id)).toEqual(["subscriptions"]);
    expect(followMetrics({ subscriptions: null, following: null, followers: null })).toEqual([]);
  });
});

describe("profileTabLabel", () => {
  it("carries the count of the grid behind the tab, and drops it while the count is unknown", () => {
    expect(profileTabLabel("posts", 8)).toBe("Посты · 8");
    expect(profileTabLabel("places", 4)).toBe("Впечатления · 4");
    expect(profileTabLabel("posts", null)).toBe("Посты");
  });
});

describe("row hints", () => {
  it("splits the lists into the preset shelves and the viewer's own", () => {
    expect(listsHint([list("1", "want_to_go"), list("2", "favorites"), list("3", null)])).toBe("2 готовые полки и 1 своя");
    expect(listsHint([])).toBe("0 готовых полок и 0 своих");
  });

  it("counts the collected achievements out of all four", () => {
    expect(achievementsHint([achievement("city_explorer", true), achievement("music_fan", false), achievement("weekend_city", false), achievement("volunteer", false)])).toBe("1 из 4 собрано");
  });

  it("counts only the groups still open as companies", () => {
    expect(weGroupsHint([weGroup("1", false), weGroup("2", false), weGroup("3", true)])).toBe("2 активные компании");
  });

  it("says where the friends came from", () => {
    expect(friendsHint(24)).toBe("24 из чатов MAX");
  });

  it("declines the visit counter of an impression cell", () => {
    expect(visitsLabel(12)).toBe("12 визитов");
    expect(visitsLabel(1)).toBe("1 визит");
    expect(visitsLabel(2)).toBe("2 визита");
  });
});

describe("ProfileView", () => {
  it("renders the identity, the counters and the three actions of the design", () => {
    const html = renderProfileView();

    expect(html).toContain("Кирилл Соколов");
    expect(html).toContain("Москва · джаз, падел");
    expect(html).toContain(">112</span>");
    expect(html).toContain("Подписаться");
    expect(html).toContain("Написать");
    expect(html).toContain("Позвать");
  });

  it("renders the avatar letter without a MAX photo and the photo with one", () => {
    expect(renderProfileView()).toContain(">К</span>");
    expect(renderProfileView({ user: { ...user, avatarUrl: "https://example.com/a.png" } })).toContain('src="https://example.com/a.png"');
  });

  it("carries the four entry rows and leaves a row without its counter until the count arrives", () => {
    const html = renderProfileView();

    expect(html.match(/class="app-me-row"/g)).toHaveLength(4);
    expect(html).toContain("Списки");
    expect(html).toContain("Достижения");
    expect(html).toContain("Мы · группы");
    expect(html).toContain("Друзья");
    expect(html).not.toContain("app-me-row-hint");
  });

  it("puts the two follow counters in the header and makes them the only clickable numbers", () => {
    const html = renderProfileView({ subscriptions: [subscription("1", "organizer")], following: [person("p1", "Анна")], followers: [person("p2", "Дима"), person("p3", "Катя")] });

    expect(html).toContain("подписки");
    expect(html).toContain("подписчика");
    expect(html.match(/app-me-metric app-me-metric--link/g)).toHaveLength(2);
    // Подписки больше не спрятаны отдельным входом: строки в списке разделов нет
    expect(html).not.toMatch(/app-me-row-title">Подписки/);
  });

  it("shows no follow counter at all while neither direction has answered", () => {
    expect(renderProfileView()).not.toContain("app-me-metric--link");
  });

  it("prints the counter hints once the counts are in", () => {
    const html = renderProfileView({ lists: [list("1", "want_to_go")], friendsCount: 24, achievements: [achievement("volunteer", true)] });

    expect(html).toContain("1 готовая полка и 0 своих");
    expect(html).toContain("24 из чатов MAX");
    expect(html).toContain("1 из 1 собрано");
  });

  it("opens on the posts and keeps the impressions behind the second tab", () => {
    const html = renderProfileView();

    expect(html).toContain("Посты · 2");
    expect(html).toContain("Впечатления · 2");
    expect(html).toContain("app-me-posts");
    expect(html).not.toContain("app-me-grid");
  });

  it("draws one impressions cell per visited place, rotating the four tile tones", () => {
    const html = renderProfileView({ tab: "places" });

    expect(html).toContain("Парк Горького");
    expect(html).toContain("12 визитов");
    expect(html).toContain("app-me-cell--1");
    expect(html).toContain("app-me-cell--2");
  });

  it("explains the impressions tab instead of leaving it blank when the viewer has been nowhere", () => {
    const html = renderProfileView({ tab: "places", visitedPlaces: [] });

    expect(html).not.toContain("app-me-grid");
    expect(html).toContain("Мест пока нет");
  });
});

describe("the post grid", () => {
  it("draws a tile per post, the cover coming from the category of its event", () => {
    const html = renderProfileView();

    expect(html.match(/class="app-me-post"/g)).toHaveLength(2);
    expect(html).toContain("app-media--afisha");
    expect(html).toContain("app-media--sport");
    expect(html).toContain("Пост о событии «Вечер Рахманинова»");
  });

  it("recognises a tile by its counters, since the text of a post does not fit one", () => {
    const html = renderProfileView();

    expect(html.match(/class="app-me-post-stat"/g)).toHaveLength(4);
    expect(html).toContain(">14</span>");
    expect(html).toContain(">3</span>");
  });

  it("shows the author's own photo instead of the category cover when the post has one", () => {
    const html = renderProfileView({ posts: [post("33000000-0000-4000-8000-000000000003", { photoUrl: "https://example.com/p.png" })] });

    expect(html).toContain('src="https://example.com/p.png"');
    expect(html).not.toContain("app-me-post-media");
  });

  it("invites the viewer to publish rather than showing an empty grid", () => {
    const html = renderProfileView({ posts: [] });

    expect(html).toContain("Постов пока нет");
    expect(html).toContain("Опубликовать впечатление");
    expect(html).not.toContain('class="app-me-post"');
  });

  it("holds the height of the grid with placeholders while the posts are on their way", () => {
    const html = renderProfileView({ posts: null });

    expect(html.match(/app-me-post-skeleton/g)).toHaveLength(6);
    expect(html).toContain('aria-label="Загружаем посты"');
    // Счётчик в ярлыке вкладки не выдумывает ноль, пока считать нечего
    expect(html).toContain(">Посты</button>");
  });

  it("says the posts failed instead of loading for ever", () => {
    const html = renderProfileView({ posts: null, postsFailed: true });

    expect(html).toContain("Не удалось загрузить посты.");
    expect(html).not.toContain("app-me-post-skeleton");
  });

  it("keeps editing off the profile screen", () => {
    const html = renderProfileView();

    expect(html).not.toContain("app-profile-form");
    expect(html).not.toContain("Сохранить");
  });
});
