import type { CatalogCard } from "../api/client";
import { pluralRu } from "../catalog/format";
import { pictured } from "../ui/photos";

function posterWhen(startsAt: string): string {
  return new Date(startsAt).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Seats, not a rating: the event has not happened yet. */
export function posterHighlight(card: CatalogCard): string | null {
  const event = card.event;
  if (event.capacity !== null && event.capacity > 0) {
    const taken = event.bookedCount ?? 0;
    const free = Math.max(0, event.capacity - taken);
    return `${taken} из ${event.capacity} · свободно ${free} ${pluralRu(free, "место", "места", "мест")}`;
  }
  if (!event.isPaid) return "Вход свободный";
  return event.priceRub !== null ? `${event.priceRub} ₽` : null;
}

export function EventPoster({ card, reason, onOpen }: { card: CatalogCard; reason?: string | null; onOpen: (eventId: string) => void }) {
  const event = card.event;
  const photo = pictured(event.id, event.coverUrl);
  const host = event.organizerName;
  const highlight = posterHighlight(card);
  return (
    <button type="button" className="app-poster" onClick={() => onOpen(event.id)}>
      <span className="app-poster-photo">
        <img alt="" src={photo} />
      </span>
      <span className="app-poster-copy">
        {host !== null && host !== undefined && host !== "" && <span className="app-poster-host">{host}</span>}
        <span className="app-poster-title">{event.title}</span>
        <span className="app-poster-meta">
          {posterWhen(event.startsAt)}
          {card.placeTitle ? ` · ${card.placeTitle}` : ""}
        </span>
        {reason !== null && reason !== undefined && reason !== "" && <span className="app-poster-reason">{reason}</span>}
        {highlight !== null && <span className="app-poster-highlight">{highlight}</span>}
      </span>
    </button>
  );
}
