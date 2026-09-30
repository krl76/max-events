import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FRIENDS_INVITE_LABEL, FriendsInviteButton, friendsInvitePayload } from "./invite";

describe("friendsInvitePayload", () => {
  it("opens the viewer's profile inside the bot window", () => {
    expect(friendsInvitePayload("u1")).toEqual({ text: "Добавь меня в друзья в Афише MAX", link: "https://max.ru/t691_hakaton_max_bot?startapp=user-u1" });
  });
});

describe("FriendsInviteButton", () => {
  it("is the blue pill that shares a MAX chat link", () => {
    const html = renderToStaticMarkup(createElement(FriendsInviteButton, { onClick: () => {} }));

    expect(html).toContain(FRIENDS_INVITE_LABEL);
    expect(html).toContain("app-friends-invite");
  });
});
