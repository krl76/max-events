import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { TargetedPromotion } from "@max-events/api-contracts";
import { PromotionSectionsView } from "./PromoSections";
import { mockEvents, mockPromotionPlacements, mockTargetedPromotions } from "../api/mock";

const placements = mockPromotionPlacements();
const collection: TargetedPromotion = mockTargetedPromotions().collections[0];

describe("PromotionSectionsView", () => {
  it("renders the banner row with clickable promoted cards", () => {
    const html = renderToStaticMarkup(createElement(PromotionSectionsView, { banners: placements.banners, collections: [], onOpenEvent: () => {} }));

    expect(html).toContain("app-promo-banners");
    expect(html.match(/app-card app-card--link app-promo-banner/g)).toHaveLength(placements.banners.length);
    expect(html).toContain(placements.banners[0].title);
    expect(html).toContain("Промо");
    expect(html).not.toContain("Подборки для тебя");
  });

  it("renders the targeted collections with the explanation", () => {
    const html = renderToStaticMarkup(createElement(PromotionSectionsView, { banners: [], collections: [collection], onOpenEvent: () => {} }));

    expect(html).toContain("Подборки для тебя");
    expect(html).toContain(collection.event.title);
    expect(html).toContain(collection.explanation);
    expect(html).not.toContain("app-promo-banners");
  });

  it("renders nothing when both blocks are empty", () => {
    const html = renderToStaticMarkup(createElement(PromotionSectionsView, { banners: [], collections: [], onOpenEvent: () => {} }));

    expect(html).toBe("");
  });

  it("renders exactly the given banners, not fixture data of its own", () => {
    const unknown = { ...mockEvents[0], id: "c00000ff-0000-4000-8000-0000000000ff", title: "Неизвестная акция" };
    const html = renderToStaticMarkup(createElement(PromotionSectionsView, { banners: [unknown], collections: [], onOpenEvent: () => {} }));

    expect(html).toContain("Неизвестная акция");
    expect(html).not.toContain(mockEvents[5].title);
  });
});
