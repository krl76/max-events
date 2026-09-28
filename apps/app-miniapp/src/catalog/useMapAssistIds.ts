import { useEffect, useState } from "react";
import { apiClient } from "../api/client";

/** Debounced assist picks for the map search. Empty query and a failed ask leave the local filter in charge. */
export function useMapAssistIds(query: string): ReadonlySet<string> | null {
  const [ids, setIds] = useState<ReadonlySet<string> | null>(null);
  useEffect(() => {
    const asked = query.trim();
    setIds(null);
    if (asked === "") return;
    let alive = true;
    const timer = window.setTimeout(() => {
      apiClient.assistQuery(asked).then(
        (result) => {
          if (!alive) return;
          const next = new Set(result.items.map((item) => item.event.id));
          setIds(next.size > 0 ? next : null);
        },
        () => {
          if (alive) setIds(null);
        },
      );
    }, 400);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [query]);
  return ids;
}
