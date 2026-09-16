import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RatingView, ReviewForm, reviewsLabel } from "./ReviewSection";
import type { EventRating } from "../api/client";

const rating: EventRating = {
  summary: { eventId: "c0000001-0000-4000-8000-000000000001", placeId: null, averageStars: 4.8, reviewsCount: 12 },
  categoryAverages: { atmosphere: 4.9, organization: 4.7, price: null, place: 4.6 },
};

describe("RatingView", () => {
  it("renders the average, the review count and only the scored categories", () => {
    const html = renderToStaticMarkup(createElement(RatingView, { rating }));

    expect(html).toContain("4.8 ⭐ (12 отзывов)");
    expect(html).toContain("Атмосфера: 4.9 ⭐");
    expect(html).toContain("Организация: 4.7 ⭐");
    expect(html).toContain("Место: 4.6 ⭐");
    expect(html).not.toContain("Цена");
  });

  it("renders nothing for an event without reviews", () => {
    const empty: EventRating = { ...rating, summary: { ...rating.summary, reviewsCount: 0 } };

    expect(renderToStaticMarkup(createElement(RatingView, { rating: empty }))).toBe("");
  });
});

describe("reviewsLabel", () => {
  it("picks the right russian plural form", () => {
    expect(reviewsLabel(1)).toBe("отзыв");
    expect(reviewsLabel(3)).toBe("отзыва");
    expect(reviewsLabel(12)).toBe("отзывов");
    expect(reviewsLabel(21)).toBe("отзыв");
    expect(reviewsLabel(11)).toBe("отзывов");
    expect(reviewsLabel(14)).toBe("отзывов");
  });
});

describe("ReviewForm", () => {
  it("renders five stars, all four categories, the yes/no choice and the photo placeholder", () => {
    const html = renderToStaticMarkup(createElement(ReviewForm, { onSubmit: () => {}, sending: false }));

    expect(html).toContain("Атмосфера");
    expect(html).toContain("Организация");
    expect(html).toContain("Цена");
    expect(html).toContain("Место");
    expect(html).toContain("Да");
    expect(html).toContain("Нет");
    expect(html).toContain("Добавить фото");
    expect(html.match(/aria-pressed="true"/g)).toBeNull();
  });

  it("keeps the submit disabled until the stars and the choice are set", () => {
    const html = renderToStaticMarkup(createElement(ReviewForm, { onSubmit: () => {}, sending: false }));

    expect(html).toMatch(/type="submit"[^>]*disabled/);
  });

  it("disables the submit while the review is sending", () => {
    const html = renderToStaticMarkup(createElement(ReviewForm, { onSubmit: () => {}, sending: true }));

    expect(html).toMatch(/type="submit"[^>]*disabled/);
  });
});
