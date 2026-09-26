// START_MODULE_CONTRACT
// PURPOSE: Onboarding mechanism (макет, экран 02): step order вступление → город → друзья → интересы, the content of every step, the "run once" flag and the pure labels the screen renders.
// SCOPE: Pure data and functions plus the localStorage flag; the screen is ./OnboardingFlow.tsx, the city/interests write goes through apiClient.updateProfile.
// DEPENDS: ../catalog/format.js (pluralRu), window.localStorage
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ONBOARDING_STORAGE_KEY - localStorage key holding the "already passed" flag (the theme key neighbour, same max-events: namespace)
// - OnboardingStep - intro | city | friends | interests
// - ONBOARDING_STEPS - the step order of the макет: вступление → город → друзья → интересы
// - nextOnboardingStep - the step after this one, null when the flow is over
// - previousOnboardingStep - the step before this one, null on the intro; the destination of the back gesture and the back button
// - onboardingForwardBlock - why this step does not let the viewer forward yet, worded for a human; null when it does
// - onboardingRailIndex - position on the Город · Друзья · Интересы rail; -1 for intro, which carries dots instead
// - IntroSlide - one intro slide: hero label, title, description and which of the three hero gradients it wears
// - INTRO_SLIDES - the three intro slides
// - IntroDirection - forward | back: the side the next slide's copy enters from
// - introDirection - from/to slide indexes -> IntroDirection (back when the index went down, forward otherwise)
// - OnboardingCity - a city of the picker with the coordinates the geolocation match runs against
// - ONBOARDING_CITIES - Москва, Санкт-Петербург, Казань, Екатеринбург, Новосибирск
// - nearestOnboardingCity - the city closest to a viewer origin ("определили по геолокации" without a geocoder)
// - cityDetectionHint - the city step subtitle, honest about a fallback origin instead of claiming a detection that did not happen
// - ONBOARDING_INTERESTS - the twelve interest chips
// - MIN_INTERESTS - "Выбери хотя бы три": the CTA stays disabled below this
// - contactsLine - the friends step subtitle with the contact count declined in Russian
// - followCtaLabel - the friends CTA; following nobody is a valid choice, so at zero it drops the "Подписаться на 0"
// - interestsCtaLabel - the interests CTA with the running counter
// - isOnboardingDone - whether the flow already ran on this device (storage failures read as "not yet")
// - markOnboardingDone - persist the flag (storage failures are non-fatal: the flow must still finish)
// - bioCtaLabel - «Пропустить» until the bio has something in it, «Готово» after
// END_MODULE_MAP

import { pluralRu } from "../catalog/format";

export const ONBOARDING_STORAGE_KEY = "max-events:onboarding";

export type OnboardingStep = "intro" | "city" | "friends" | "interests" | "bio";

export const ONBOARDING_STEPS: readonly OnboardingStep[] = ["intro", "city", "friends", "interests", "bio"];

/** null means the flow is over — the caller hands the viewer to the feed. */
export function nextOnboardingStep(step: OnboardingStep): OnboardingStep | null {
  return ONBOARDING_STEPS[ONBOARDING_STEPS.indexOf(step) + 1] ?? null;
}

/** null on the intro: there is nothing before the first step to go back to. */
export function previousOnboardingStep(step: OnboardingStep): OnboardingStep | null {
  const index = ONBOARDING_STEPS.indexOf(step);
  return index > 0 ? ONBOARDING_STEPS[index - 1] : null;
}

/**
 * Почему шаг пока не пускает вперёд — словами для человека; null, когда пускает.
 *
 * Кнопку на незаполненном шаге можно просто запереть, а жест запереть нечем: смахнуть палец может
 * всегда, и молча проглоченный свайп читается как сломанный экран, а не как невыполненное условие.
 * Поэтому у отказа есть текст — тот самый, который экран уже обещал в подзаголовке.
 */
export function onboardingForwardBlock(step: OnboardingStep, interestsCount: number): string | null {
  if (step !== "interests" || interestsCount >= MIN_INTERESTS) return null;
  const left = MIN_INTERESTS - interestsCount;
  return `Выбери ещё ${left} ${pluralRu(left, "интерес", "интереса", "интересов")} — и пойдём дальше`;
}

/** The intro is not on the rail: it carries slide dots, the other steps carry the Город · Друзья · Интересы · О себе progress. */
export function onboardingRailIndex(step: OnboardingStep): number {
  return step === "intro" ? -1 : ONBOARDING_STEPS.indexOf(step) - 1;
}

export function bioCtaLabel(bio: string): string {
  return bio.trim() === "" ? "Пропустить" : "Готово";
}

export interface IntroSlide {
  label: string;
  title: string;
  description: string;
  hero: 1 | 2 | 3;
}

export const INTRO_SLIDES: readonly IntroSlide[] = [
  { label: "Видно, кто из друзей куда идёт", title: "Планы друзей — в твоей ленте", description: "Друзья из чатов MAX собираются на события. Присоединяйся к ним одним тапом.", hero: 1 },
  { label: "Подборка вечера за три вопроса", title: "«Куда пойдём?»", description: "Не знаешь, чего хочешь? Ответь на три вопроса — подберём под настроение, компанию и бюджет.", hero: 2 },
  { label: "Один общий план на всех", title: "Запись, чат, маршрут, напоминания", description: "Собери компанию, договоритесь о месте встречи — напомним, когда выходить.", hero: 3 },
];

export type IntroDirection = "forward" | "back";

/** Going back, the copy enters from the left; forward and standing still, from the right. */
export function introDirection(from: number, to: number): IntroDirection {
  return to < from ? "back" : "forward";
}

export interface OnboardingCity {
  name: string;
  latitude: number;
  longitude: number;
}

export const ONBOARDING_CITIES: readonly OnboardingCity[] = [
  { name: "Москва", latitude: 55.7558, longitude: 37.6173 },
  { name: "Санкт-Петербург", latitude: 59.9311, longitude: 30.3609 },
  { name: "Казань", latitude: 55.7887, longitude: 49.1221 },
  { name: "Екатеринбург", latitude: 56.8389, longitude: 60.6057 },
  { name: "Новосибирск", latitude: 55.0084, longitude: 82.9357 },
];

/**
 * No geocoder in the product, and the five cities are hundreds of kilometres apart, so the nearest
 * one is an honest answer: an equirectangular approximation (longitude shrunk by cos(latitude))
 * ranks them exactly like a great circle would at this scale, without a second haversine in the app.
 */
export function nearestOnboardingCity(latitude: number, longitude: number): OnboardingCity {
  const scale = Math.cos((latitude * Math.PI) / 180);
  let nearest = ONBOARDING_CITIES[0];
  let best = Number.POSITIVE_INFINITY;
  for (const city of ONBOARDING_CITIES) {
    const distance = (city.latitude - latitude) ** 2 + ((city.longitude - longitude) * scale) ** 2;
    if (distance < best) {
      best = distance;
      nearest = city;
    }
  }
  return nearest;
}

/** The макет line claims a detection; without a real fix the screen must not claim it. */
export function cityDetectionHint(source: "geo" | "fallback"): string {
  return source === "geo" ? "Определили по геолокации. Можно поменять в любой момент." : "Геолокация недоступна — выбери город сам. Можно поменять в любой момент.";
}

export const ONBOARDING_INTERESTS: readonly string[] = ["Концерты", "Спорт", "На природе", "Волонтёрство", "С детьми", "Еда и рынки", "Театр", "Лекции", "Настолки", "Выставки", "Йога", "Ночная жизнь"];

export const MIN_INTERESTS = 3;

/** 1 контакт / 2 контакта / 5 контактов — the count is data, so the ending cannot be baked into the string. */
function contactsWord(count: number): string {
  const tens = count % 100;
  const ones = count % 10;
  if (tens >= 11 && tens <= 14) return "контактов";
  if (ones === 1) return "контакт";
  if (ones >= 2 && ones <= 4) return "контакта";
  return "контактов";
}

export function contactsLine(count: number): string {
  return `${count} ${contactsWord(count)} из чатов MAX пользуются Афишей. Подпишись — их планы появятся в ленте.`;
}

export function followCtaLabel(count: number): string {
  return count === 0 ? "Продолжить" : `Подписаться на ${count} и продолжить`;
}

export function interestsCtaLabel(count: number): string {
  return `Дальше · выбрано ${count}`;
}

export function isOnboardingDone(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === "done";
  } catch {
    // Private mode / disabled storage: showing the flow again beats blocking the app.
    return false;
  }
}

export function markOnboardingDone(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "done");
  } catch {
    // Losing persistence must not lose the finish itself.
  }
}
