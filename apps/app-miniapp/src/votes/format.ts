// START_MODULE_CONTRACT
// PURPOSE: Shared ru formatting of the two vote screens (макет, экраны 32 и 33), so neither has to import the other.
// SCOPE: Pure formatting only, no DOM or API access.
// DEPENDS: —
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - voteOptionMeta - «Пт 20:00 · 800 ₽» under an option title; a free event says so in words
// END_MODULE_MAP

/** The option line of both vote screens: the weekday and time of the event, then what it costs. */
export function voteOptionMeta(event: { startsAt: string; isPaid: boolean; priceRub: number | null }): string {
  const date = new Date(event.startsAt);
  const weekday = date.toLocaleDateString("ru-RU", { weekday: "short" });
  const when = `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
  return `${when} · ${event.isPaid && event.priceRub !== null ? `${event.priceRub.toLocaleString("ru-RU")} ₽` : "бесплатно"}`;
}
