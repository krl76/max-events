import type { CatalogCard } from "../api/client";
import { pluralRu } from "../catalog/format";
import { pictured } from "../ui/photos";

function posterWhen(startsAt: string): string {
  return new Date(startsAt).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** One line that tells a person why this event is worth opening: who runs it, and what stands out. */
export function posterHighlight(card: CatalogCard): string {
  const event = card.event;
  if (card.rating !== null) return `Оценка ${card.rating.toFixed(1).replace(".", ",")}`;
  if (event.capacity !== null && event.capacity > 0) {
    const taken = event.bookedCount ?? 0;
    const free = Math.max(0, event.capacity - taken);
    if (free > 0 && free <= 12) return `Осталось ${free} ${pluralRu(free, "место", "места", "мест")}`;
  }
  if (!event.isPaid) return "Вход свободный";
  return event.priceRub !== null ? `${event.priceRub} ₽` : "Билеты у организатора";
}

export function EventPoster({ card, reason, onOpen }: { card: CatalogCard; reason?: string | null; onOpen: (eventId: string) => void }) {
  const event = card.event;
  const photo = pictured(event.id, event.coverUrl);
  const host = event.organizerName ?? card.placeTitle ?? event.city;
  return (
    <button type="button" className="app-poster" onClick={() => onOpen(event.id)}>
      <span className="app-poster-photo">
        <img alt="" src={photo} />
      </span>
      <span className="app-poster-copy">
        <span className="app-poster-host">{host}</span>
        <span className="app-poster-title">{event.title}</span>
        <span className="app-poster-meta">
          {posterWhen(event.startsAt)}
          {card.placeTitle ? ` · ${card.placeTitle}` : ""}
        </span>
        {reason !== null && reason !== undefined && reason !== "" && <span className="app-poster-reason">{reason}</span>}
        <span className="app-poster-highlight">{posterHighlight(card)}</span>
      </span>
    </button>
  );
}
