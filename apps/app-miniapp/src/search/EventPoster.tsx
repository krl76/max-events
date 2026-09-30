import type { CatalogCard } from "../api/client";
import { pictured } from "../ui/photos";

function posterWhen(startsAt: string): string {
  return new Date(startsAt).toLocaleString("ru-RU", { timeZone: "Europe/Moscow", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Price or free entry on the mini-card. Seat counts live on the event page. */
export function posterHighlight(card: CatalogCard): string | null {
  const event = card.event;
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
        <img alt="" src={photo} loading="lazy" decoding="async" />
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
