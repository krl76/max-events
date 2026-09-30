// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DEFAULT_SMART_ALERTS, type Profile, type User } from "@max-events/api-contracts";
import type { ProfilePost } from "../api/client";
import { ProfileView } from "./ProfilePage";

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
  interests: [],
  smartAlerts: { ...DEFAULT_SMART_ALERTS },
  privacy: { visitHistory: "friends", routes: "friends" },
  recommendationsEnabled: true,
  bio: "",
  coverUrl: null,
};

const posts: ProfilePost[] = [{ postId: "33000000-0000-4000-8000-000000000001", eventId: "c0000001-0000-4000-8000-000000000001", eventTitle: "Вечер Рахманинова", category: "afisha", photoUrl: null, likesCount: 14, commentsCount: 3 }];

const noop = () => {};

async function mount(node: ReactElement): Promise<{ host: HTMLDivElement; root: Root }> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(node);
  });
  await act(async () => {
    await Promise.resolve();
  });
  return { host, root };
}

async function unmount(host: HTMLDivElement, root: Root): Promise<void> {
  await act(async () => {
    root.unmount();
  });
  host.remove();
}

describe("profile post delete", () => {
  it("asks in a sheet and deletes only after confirm", async () => {
    const deleted: string[] = [];
    const { host, root } = await mount(
      createElement(ProfileView, {
        user,
        profile,
        lists: null,
        subscriptions: null,
        following: null,
        followers: null,
        achievements: null,
        weGroups: null,
        friendsCount: null,
        posts,
        postsFailed: false,
        visitedPlaces: [],
        tab: "posts",
        onSettings: noop,
        onShare: noop,
        onLists: noop,
        onPlans: noop,
        onCreatePlan: noop,
        onBookings: noop,
        onOpenBooking: noop,
        onCalendar: noop,
        onSubscriptions: noop,
        onFollowers: noop,
        onAchievements: noop,
        onWeGroups: noop,
        onFriends: noop,
        onSubscribe: noop,
        onWrite: noop,
        onInvite: noop,
        onOpenPost: noop,
        onDeletePost: (post) => deleted.push(post.postId),
        onNewPost: noop,
        onOpenPlace: noop,
        onTab: noop,
      }),
    );

    const trash = host.querySelector('[aria-label="Удалить пост"]') as HTMLButtonElement;
    expect(trash).not.toBeNull();
    await act(async () => {
      trash.click();
    });
    expect(host.querySelector('[role="dialog"]')?.getAttribute("aria-label")).toBe("Удалить пост?");
    expect(deleted).toEqual([]);

    const keep = [...host.querySelectorAll("button")].find((button) => button.textContent === "Оставить") as HTMLButtonElement;
    await act(async () => {
      keep.click();
    });
    expect(deleted).toEqual([]);
    expect(host.querySelector('[role="dialog"]')).toBeNull();

    await act(async () => {
      trash.click();
    });
    const confirm = [...host.querySelectorAll("button")].find((button) => button.textContent === "Удалить") as HTMLButtonElement;
    await act(async () => {
      confirm.click();
    });
    expect(deleted).toEqual(["33000000-0000-4000-8000-000000000001"]);

    await unmount(host, root);
  });
});
