// START_MODULE_CONTRACT
// PURPOSE: Home promotion surface (#205): banner row from /promotions/placements and the «Подборки для тебя» targeted collections from /promotions/for-me.
// SCOPE: Data via apiClient.getPromotionPlacements/getTargetedPromotions (mock or live); both blocks are decorative — loading, error and empty states render nothing; cards navigate to the event route.
// DEPENDS: ../api/client.js (apiClient), @max-events/api-contracts (Event, TargetedPromotion), ../catalog/CatalogPage.js (CATEGORY_LABELS, formatStartsAt), ../routing/router.js, ../ui/primitives.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PromoSectionsData - banners + targeted collections of the home surface
// - PromotionSectionsView - presentational: «Промо» banner row and targeted collection cards; null when both are empty
// - PromotionSections - home container: fetches placements + for-me once, wires navigation
// END_MODULE_MAP

import { useEffect, useState } from "react";
import type { Event, TargetedPromotion } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { CATEGORY_LABELS, formatStartsAt } from "../catalog/CatalogPage";
import { useRoute } from "../routing/router";
import { AppTitle } from "../ui/primitives";

export interface PromoSectionsData {
  banners: Event[];
  collections: TargetedPromotion[];
}

interface PromotionSectionsViewProps extends PromoSectionsData {
  onOpenEvent: (id: string) => void;
}

export function PromotionSectionsView({ banners, collections, onOpenEvent }: PromotionSectionsViewProps) {
  if (banners.length === 0 && collections.length === 0) return null;
  return (
    <>
      {banners.length > 0 && (
        <section aria-label="Акции">
          <div className="app-promo-banners">
            {banners.map((event) => (
              <button key={event.id} type="button" className="app-card app-card--link app-promo-banner" onClick={() => onOpenEvent(event.id)}>
                <div className="app-card-body">
                  <span className="app-today-chip">Промо</span>
                  <span className="app-card-title">{event.title}</span>
                  <span className="app-card-subtitle">
                    {formatStartsAt(event.startsAt)} · {CATEGORY_LABELS[event.category]}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
      {collections.length > 0 && (
        <section aria-label="Подборки для тебя">
          <AppTitle asChild>
            <h2 className="app-today-heading">Подборки для тебя</h2>
          </AppTitle>
          {collections.map((row) => (
            <button key={row.campaign.id} type="button" className="app-card app-card--link" onClick={() => onOpenEvent(row.event.id)}>
              <div className="app-card-body">
                <span className="app-card-title">{row.event.title}</span>
                <span className="app-card-subtitle">
                  {formatStartsAt(row.event.startsAt)} · {CATEGORY_LABELS[row.event.category]}
                </span>
                <span className="app-card-subtitle">{row.explanation}</span>
              </div>
            </button>
          ))}
        </section>
      )}
    </>
  );
}

export function PromotionSections() {
  const { navigate } = useRoute();
  const [data, setData] = useState<PromoSectionsData | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([apiClient.getPromotionPlacements(), apiClient.getTargetedPromotions()]).then(
      ([placements, targeted]) => {
        if (alive) setData({ banners: placements.banners, collections: targeted.collections });
      },
      () => {
        if (alive) setData({ banners: [], collections: [] });
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  if (data === null) return null;
  return <PromotionSectionsView banners={data.banners} collections={data.collections} onOpenEvent={(id) => navigate({ name: "event", id })} />;
}
