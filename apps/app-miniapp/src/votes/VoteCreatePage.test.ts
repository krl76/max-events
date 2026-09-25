import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mockEvents, mockFriends } from "../api/mock";
import { voteOptionMeta } from "./format";
import { VOTE_MAX_OPTIONS, VOTE_MIN_OPTIONS, VoteCreateView, voteCreateBlockers, voteCreateReady, voteFriendsCounter, voteInviteNote, voteOptionsCounter } from "./VoteCreatePage";

const noop = () => {};
const EVENTS = mockEvents.slice(0, 4);
const FRIENDS = mockFriends.slice(0, 7);

function render(over: { title?: string; selectedEvents?: string[]; selectedFriends?: string[]; rosterOpen?: boolean; catalogOpen?: boolean; catalogLoading?: boolean; submitting?: boolean; failed?: boolean; cancelLabel?: string | null } = {}): string {
  return renderToStaticMarkup(
    createElement(VoteCreateView, {
      events: EVENTS,
      friends: FRIENDS,
      title: over.title ?? "Куда идем в пятницу?",
      selectedEvents: over.selectedEvents ?? EVENTS.slice(0, 3).map((event) => event.id),
      selectedFriends: over.selectedFriends ?? [],
      rosterOpen: over.rosterOpen ?? false,
      catalogOpen: over.catalogOpen ?? false,
      catalogLoading: over.catalogLoading ?? false,
      submitting: over.submitting ?? false,
      failed: over.failed ?? false,
      cancelLabel: over.cancelLabel === undefined ? "Назад к подборке" : over.cancelLabel,
      onTitle: noop,
      onToggleEvent: noop,
      onToggleFriend: noop,
      onOpenCatalog: noop,
      onOpenRoster: noop,
      onSubmit: noop,
      onCancel: noop,
    }),
  );
}

const ids = (count: number) => Array.from({ length: count }, (_, index) => `event-${index}`);

describe("voteCreateBlockers", () => {
  it("holds the launch until there is a question, 2..10 options and at least one friend", () => {
    expect(voteCreateBlockers("Куда идем?", ids(3), ["f1"])).toEqual([]);
    expect(voteCreateBlockers("  ", ids(3), ["f1"])).toContain("Задай вопрос голосования");
    expect(voteCreateBlockers("Куда идем?", ids(1), ["f1"])).toContain(`Выбери хотя бы ${VOTE_MIN_OPTIONS} варианта`);
    expect(voteCreateBlockers("Куда идем?", ids(11), ["f1"])).toContain(`Вариантов не больше ${VOTE_MAX_OPTIONS}`);
    expect(voteCreateBlockers("Куда идем?", ids(3), [])).toContain("Позови хотя бы одного друга");
  });

  it("accepts exactly the edges of the 2..10 range", () => {
    expect(voteCreateReady("Куда идем?", ids(2), ["f1"])).toBe(true);
    expect(voteCreateReady("Куда идем?", ids(10), ["f1"])).toBe(true);
    expect(voteCreateReady("Куда идем?", ids(1), ["f1"])).toBe(false);
    expect(voteCreateReady("Куда идем?", ids(11), ["f1"])).toBe(false);
    expect(voteCreateReady("Куда идем?", ids(2), [])).toBe(false);
  });

  it("names the first unmet condition first, in the order the form is filled", () => {
    expect(voteCreateBlockers("", ids(1), [])[0]).toBe("Задай вопрос голосования");
    expect(voteCreateBlockers("Куда идем?", ids(1), [])[0]).toBe(`Выбери хотя бы ${VOTE_MIN_OPTIONS} варианта`);
  });
});

describe("counters and the MAX note", () => {
  it("counts the picked options against the ceiling", () => {
    expect(voteOptionsCounter(3)).toBe("выбрано 3 из 10");
  });

  it("pluralizes «друг» by ru rules", () => {
    expect(voteFriendsCounter(1)).toBe("1 друг");
    expect(voteFriendsCounter(4)).toBe("4 друга");
    expect(voteFriendsCounter(7)).toBe("7 друзей");
  });

  it("says how many invitations the chat card will carry", () => {
    expect(voteInviteNote(4)).toBe("При создании откроется чат в MAX, приглашения уйдут всем четверым.");
    expect(voteInviteNote(2)).toContain("двоим");
    expect(voteInviteNote(9)).toContain("всем 9");
    expect(voteInviteNote(1)).toContain("приглашение уйдёт");
    expect(voteInviteNote(0)).toContain("осталось выбрать, кто голосует");
  });
});

describe("voteOptionMeta", () => {
  it("writes the weekday, the time and the price of an option", () => {
    const paid = voteOptionMeta({ startsAt: new Date(2026, 8, 18, 20, 0).toISOString(), isPaid: true, priceRub: 800 });
    expect(paid).toBe(`Пт 20:00 · ${(800).toLocaleString("ru-RU")} ₽`);

    expect(voteOptionMeta({ startsAt: new Date(2026, 8, 18, 19, 0).toISOString(), isPaid: false, priceRub: null })).toBe("Пт 19:00 · бесплатно");
  });
});

describe("VoteCreateView", () => {
  it("renders the question, the option rows with their meta and the roster", () => {
    const html = render();

    expect(html).toContain("Куда идем в пятницу?");
    expect(html).toContain(voteOptionsCounter(3));
    for (const event of EVENTS) {
      expect(html).toContain(event.title);
      expect(html).toContain(voteOptionMeta(event));
    }
    expect(html).toContain("Добавить событие");
    expect(html).toContain("Кто голосует");
  });

  it("marks the picked options and only the picked ones", () => {
    const html = render({ selectedEvents: [EVENTS[0].id] });

    expect(html.match(/app-poll-option--on/g)).toHaveLength(1);
    expect(html).toContain('aria-pressed="true"');
  });

  it("keeps the launch inactive with the reason next to it, and enables it once the conditions are met", () => {
    const blocked = render({ selectedFriends: [] });
    expect(blocked).toContain("disabled");
    expect(blocked).toContain("Позови хотя бы одного друга");

    const ready = render({ selectedFriends: [FRIENDS[0].id] });
    expect(ready).not.toContain("disabled");
    expect(ready).not.toContain("Позови хотя бы одного друга");
    expect(ready).toContain("Запустить голосование");
  });

  it("previews part of the friend list and opens the rest behind «Ещё»", () => {
    const preview = render({ selectedFriends: [] });
    expect(preview).toContain("Ещё");

    const opened = render({ selectedFriends: [], rosterOpen: true });
    expect(opened).not.toContain(">Ещё<");
    for (const friend of FRIENDS) expect(opened).toContain(friend.name.split(" ")[0]);
  });

  it("hides the cancel button when the screen has a back arrow of its own", () => {
    expect(render()).toContain("Назад к подборке");
    expect(render({ cancelLabel: null })).not.toContain("Назад к подборке");
  });

  it("reports a creation failure", () => {
    const failed = render({ failed: true });

    expect(failed).toContain("app-state--error");
    expect(failed).toContain("Не удалось создать голосование.");
  });
});
