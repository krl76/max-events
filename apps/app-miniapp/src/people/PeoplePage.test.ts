import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { peopleSuggest, mockEvents } from "../api/mock";
import { candidateInterests, filterCandidates, lookingLabel, PeopleView, type PeopleState } from "./PeoplePage";

const MOSCOW: [number, number] = [55.7522, 37.6156];
const noop = () => {};

function readyPeople() {
  return peopleSuggest(...MOSCOW);
}

function viewHtml(over: { state?: PeopleState; chips?: string[]; selected?: ReadonlySet<string> } = {}): string {
  return renderToStaticMarkup(createElement(PeopleView, { state: over.state ?? { status: "ready", data: readyPeople() }, chips: over.chips ?? candidateInterests(readyPeople().people), selected: over.selected ?? new Set<string>(), onToggle: noop, onOpenEvent: noop }));
}

describe("lookingLabel", () => {
  it("picks the right russian plural form", () => {
    expect(lookingLabel(1)).toBe("1 ищет компанию сегодня");
    expect(lookingLabel(3)).toBe("3 ищут компанию сегодня");
    expect(lookingLabel(11)).toBe("11 ищут компанию сегодня");
    expect(lookingLabel(21)).toBe("21 ищет компанию сегодня");
  });
});

describe("candidateInterests", () => {
  it("collects the sorted union of shared interests", () => {
    expect(candidateInterests(readyPeople().people)).toEqual(["гастрономия", "кино", "музыка"]);
  });
});

describe("filterCandidates", () => {
  it("keeps everyone without a selection and filters by the selected interests", () => {
    const people = readyPeople().people;

    expect(filterCandidates(people, new Set())).toHaveLength(people.length);
    const filtered = filterCandidates(people, new Set(["музыка"]));
    expect(filtered).toHaveLength(3);
    expect(filtered.every((candidate) => candidate.sharedInterests.includes("музыка"))).toBe(true);
  });
});

describe("PeopleView", () => {
  it("renders the counters, chips and candidate cards with match context", () => {
    const html = viewHtml();

    expect(html).toContain("5 человек рядом с похожими интересами, 2 ищут компанию сегодня");
    expect(html).toContain("Катя Орлова");
    expect(html).toContain(`вы оба хотите на «${mockEvents[11].title}»`);
    expect(html).toContain("общий интерес: музыка");
    expect(html).toContain("км");
    expect(html.match(/Ищет компанию сегодня/g)).toHaveLength(2);
    expect(html.match(/aria-pressed/g)!.length).toBeGreaterThanOrEqual(3);
  });

  it("renders the event CTA only for shared_event contexts", () => {
    const html = viewHtml();

    expect(html.match(/Открыть событие/g)).toHaveLength(1);
  });

  it("filters candidates by the selected interest", () => {
    const html = viewHtml({ selected: new Set(["музыка"]) });

    expect(html).toContain("Катя Орлова");
    expect(html).toContain("Анна Соколова");
    expect(html).not.toContain("Игорь Фомин");
  });

  it("renders loading, error and empty states", () => {
    expect(viewHtml({ state: { status: "loading" } })).toContain("Ищем людей рядом");

    const error = viewHtml({ state: { status: "error" } });
    expect(error).toContain("app-state--error");
    expect(error).toContain("Не удалось найти людей рядом");

    const empty = viewHtml({ state: { status: "ready", data: { nearbyCount: 0, lookingForCompanyTodayCount: 0, people: [] } }, chips: [] });
    expect(empty).toContain("Никого рядом с такими интересами не нашлось");
    expect(empty).not.toContain("Открыть событие");
  });
});
