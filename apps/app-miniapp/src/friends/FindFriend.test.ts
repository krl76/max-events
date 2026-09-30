import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FindFriendButton, FindFriendDialog, findFriendQuery } from "./FindFriend";

describe("findFriendQuery", () => {
  it("strips @ and spaces from a MAX id or nick", () => {
    expect(findFriendQuery("  @regina  ")).toBe("regina");
    expect(findFriendQuery("123456")).toBe("123456");
  });
});

describe("FindFriendDialog", () => {
  it("asks for a MAX id and offers an invite link", () => {
    const html = renderToStaticMarkup(createElement(FindFriendDialog, { onClose: () => {}, onOpen: () => {}, onAdd: () => {}, onInvite: () => {} }));
    expect(html).toContain("Найти друга");
    expect(html).toContain("id MAX");
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
