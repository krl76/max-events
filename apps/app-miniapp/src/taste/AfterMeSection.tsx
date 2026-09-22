// START_MODULE_CONTRACT
// PURPOSE: «После меня» block: what the taste graph suggests next, on the home screen and the profile.
// SCOPE: AfterMeView is presentational and renders nothing at all when the graph has nothing to say — a suggestion with no events is the same silence as no suggestion, and an empty block would be worse than none. AfterMeSection loads GET /taste/after-me and stays quiet on failure, since this is a suggestion, not a screen.
// DEPENDS: ../api/client.js (apiClient), @max-events/api-contracts (AfterMeResponse, AfterMeSuggestion, Event), ../catalog/CatalogPage.js (CATEGORY_LABELS, formatStartsAt), ../routing/router.js, ../ui/primitives.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - afterMeSuggestions - the suggestions worth showing: those that actually carry events
// - AfterMeView - presentational: explanation line and the suggested events, or nothing
// - AfterMeSection - container: loads the suggestions, hides itself on failure
// END_MODULE_MAP

import { useEffect, useState } from "react";
import type { AfterMeResponse, AfterMeSuggestion } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { CATEGORY_LABELS, formatStartsAt } from "../catalog/CatalogPage";
import { useRoute } from "../routing/router";
import { AppMedia, AppSection } from "../ui/primitives";

/**
 * The backend answers a suggestion even when it found nothing to suggest — no city on the profile, or
 * no upcoming event of that category. Such a suggestion is an explanation with an empty list, and
 * showing it would promise a recommendation that is not there.
 */
export function afterMeSuggestions(response: AfterMeResponse | null): AfterMeSuggestion[] {
  return (response?.suggestions ?? []).filter((suggestion) => suggestion.events.length > 0);
}

export function AfterMeView({ response, onOpen = () => {}, title = "После меня" }: { response: AfterMeResponse | null; onOpen?: (eventId: string) => void; title?: string }) {
  const suggestions = afterMeSuggestions(response);
  // Nothing to say: a visitor with no visits yet gets no block at all, not an empty one.
  if (suggestions.length === 0) return null;
  return (
    <AppSection title={title} className="app-cards-flat">
      {suggestions.map((suggestion) => (
        <div key={`${suggestion.fromCategory}>${suggestion.toCategory}`}>
          <p className="app-today-summary">{suggestion.explanation}</p>
          {suggestion.events.map((event) => (
            <button key={event.id} type="button" className="app-card app-card--link" onClick={() => onOpen(event.id)}>
              <AppMedia category={event.category} />
              <div className="app-card-body">
                <span className="app-card-title">{event.title}</span>
                <span className="app-card-subtitle">{formatStartsAt(event.startsAt)}</span>
                <span className="app-today-chip">{CATEGORY_LABELS[event.category]}</span>
              </div>
            </button>
          ))}
        </div>
      ))}
    </AppSection>
  );
}

export function AfterMeSection() {
  const { navigate } = useRoute();
  const [response, setResponse] = useState<AfterMeResponse | null>(null);

  useEffect(() => {
    let alive = true;
    apiClient.getAfterMe().then(
      (loaded) => {
        if (alive) setResponse(loaded);
      },
      // A suggestion that failed to load is not an error the screen has to report: it stays hidden,
      // the way the profile treats its secondary blocks.
      () => {},
    );
    return () => {
      alive = false;
    };
  }, []);

  return <AfterMeView response={response} onOpen={(id) => navigate({ name: "event", id })} />;
}
