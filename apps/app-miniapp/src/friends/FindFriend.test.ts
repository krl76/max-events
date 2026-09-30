import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FindFriendButton, FindFriendDialog, findFriendQuery } from "./FindFriend";

describe("findFriendQuery", () => {
  it("normalizes a numeric MAX id, an @nick and a name", () => {
    expect(findFriendQuery("  @anna_s  ")).toBe("anna_s");
    expect(findFriendQuery("id123456")).toBe("123456");
    expect(findFriendQuery("Анна Соколова")).toBe("Анна Соколова");
  });
});

describe("FindFriendDialog", () => {
  it("asks for a MAX id and offers an invite link", () => {
    const html = renderToStaticMarkup(createElement(FindFriendDialog, { onClose: () => {}, onOpen: () => {}, onAdd: () => {}, onInvite: () => {} }));
    expect(html).toContain("Найти друга");
    expect(html).toContain("цифровому id");
    expect(html).not.toContain("@нику");
    expect(html).toContain("Отправить ссылку в MAX");
  });
});

describe("FindFriendButton", () => {
  it("is a search control in the friends bar", () => {
    const html = renderToStaticMarkup(createElement(FindFriendButton, { onClick: () => {} }));
    expect(html).toContain("Найти друга");
  });
});

describe("FindFriendDialog missing person", () => {
  it("offers a mutual-add invite when the person has not opened the app", () => {
    const html = renderToStaticMarkup(createElement(FindFriendDialog, { onClose: () => {}, onOpen: () => {}, onAdd: () => {}, onInvite: () => {} }));
    expect(html).toContain("Отправить ссылку в MAX");
  });
});
