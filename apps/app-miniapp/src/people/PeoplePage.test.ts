import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { lookingLabel, peopleDistance, personMetaLine, sentenceCase, PeopleView, type PeopleState } from "./PeoplePage";
import { peopleSuggest } from "../api/mock";

const noop = () => {};
/** The centre of Moscow, the same origin the people screen asks from without a geo fix. */
const data = peopleSuggest(55.7522, 37.6156);
const none: ReadonlySet<string> = new Set();

const view = (state: PeopleState, hidden: ReadonlySet<string> = none) => renderToStaticMarkup(createElement(PeopleView, { state, hidden, onInvite: noop, onHide: noop, onRetry: noop }));

describe("peopleDistance", () => {
  it("writes the distance with a russian decimal comma", () => {
    expect(peopleDistance(1.2)).toBe("1,2 км");
    expect(peopleDistance(4)).toBe("4,0 км");
  });
});

describe("personMetaLine", () => {
  const candidate = data.people[0];

  it("joins the distance and the looking-for-company flag the way the design does", () => {
    expect(personMetaLine({ ...candidate, distanceKm: 1.2, lookingForCompanyToday: true })).toBe("1,2 км · сегодня ищет компанию");
    expect(personMetaLine({ ...candidate, distanceKm: 4.1, lookingForCompanyToday: false })).toBe("4,1 км");
    expect(personMetaLine({ ...candidate, distanceKm: null, lookingForCompanyToday: true })).toBe("сегодня ищет компанию");
  });

  it("stays empty when neither half is known, instead of printing a lone separator", () => {
    expect(personMetaLine({ ...candidate, distanceKm: null, lookingForCompanyToday: false })).toBe("");
  });
});

describe("lookingLabel", () => {
  it("picks the right russian plural form", () => {
    expect(lookingLabel(1)).toBe("сегодня ищет компанию");
    expect(lookingLabel(5)).toBe("сегодня ищут компанию");
    expect(lookingLabel(0)).toBe("сегодня ищут компанию");
  });
});

describe("sentenceCase", () => {
  it("raises the first letter of an explanation that arrives lowercase", () => {
    expect(sentenceCase("общий интерес: джаз")).toBe("Общий интерес: джаз");
    expect(sentenceCase("")).toBe("");
  });
});

describe("PeopleView", () => {
  it("opens with the two counters and the privacy line", () => {
    const html = view({ status: "ready", data });

    expect(html).toContain(`>${data.nearbyCount}<`);
    expect(html).toContain(`>${data.lookingForCompanyTodayCount}<`);
    expect(html).toContain("рядом");
    expect(html).toContain(lookingLabel(data.lookingForCompanyTodayCount));
    expect(html).toContain("Точное местоположение не передаётся — только расстояние.");
  });

  it("shows a first name, the match context and the shared interests as chips", () => {
    const html = view({ status: "ready", data });
    const candidate = data.people[0];

    expect(html).toContain(candidate.person.name.split(" ")[0]);
    expect(html).toContain(sentenceCase(candidate.context.explanation));
    expect(html).toContain(sentenceCase(candidate.sharedInterests[0]));
  });

  it("keeps the calm register: an invite and a dismiss, no messaging and no likes", () => {
    const html = view({ status: "ready", data });

    expect(html).toContain("Позвать на событие");
    expect(html).toContain("Скрыть");
    expect(html).not.toContain("Написать");
    expect(html).not.toContain("Знакомств");
  });

  it("marks who is looking for company with a dot rather than with cyan text", () => {
    const looking = data.people.find((candidate) => candidate.lookingForCompanyToday)!;
    const html = view({ status: "ready", data: { ...data, people: [looking] } });

    expect(html).toContain("app-people-live");
    expect(html).toContain("сегодня ищет компанию");
  });

  it("drops a hidden candidate without touching the counters above", () => {
    const hidden = new Set([data.people[0].person.id]);
    const html = view({ status: "ready", data }, hidden);

    expect(html).not.toContain(`Скрыть ${data.people[0].person.name.split(" ")[0]}`);
    expect(html).toContain(`>${data.nearbyCount}<`);
  });

  it("renders loading, error and empty states", () => {
    expect(view({ status: "loading" })).toContain("app-skeleton");
    expect(view({ status: "error" })).toContain("Не удалось найти людей рядом.");
    expect(view({ status: "ready", data: { nearbyCount: 0, lookingForCompanyTodayCount: 0, people: [] } })).toContain("Рядом пока никого с общими интересами.");
  });
});
