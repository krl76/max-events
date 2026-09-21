// START_MODULE_CONTRACT
// PURPOSE: Shared ru formatting helpers for the catalog, event page, friends, calendar, today and whereto screens.
// SCOPE: Pure formatting only, no DOM or API access.
// DEPENDS: —
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - formatStartsAt - ru "day month, hh:mm" formatting (reused by the event page and other screens)
// - formatEventWeather - catalog chip: "+12°, облачно"
// - formatEventWeatherDetail - event page line: chip plus rain probability
// - pluralRu - ru plural form (one/few/many) via Intl.PluralRules, backs every counter label across screens
// END_MODULE_MAP

import type { EventWeather } from "@max-events/api-contracts";

export function formatStartsAt(startsAt: string): string {
  return new Date(startsAt).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

export function formatEventWeather(weather: EventWeather): string {
  const rounded = Math.round(weather.temperatureC);
  const signed = rounded > 0 ? `+${rounded}` : `${rounded}`;
  return `${signed}°, ${weather.condition}`;
}

export function formatEventWeatherDetail(weather: EventWeather): string {
  return `${formatEventWeather(weather)} · дождь ${weather.precipitationProbability}%`;
}

export function pluralRu(n: number, one: string, few: string, many: string): string {
  const rule = new Intl.PluralRules("ru").select(n);
  return rule === "one" ? one : rule === "few" ? few : many;
}
