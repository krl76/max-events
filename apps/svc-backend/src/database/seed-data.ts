// START_MODULE_CONTRACT
// PURPOSE: Starter catalog pool for Moscow — places with geo and future events in all four categories.
// SCOPE: Seed place/event records consumed by seedDatabase; no I/O.
// DEPENDS: @max-events/api-contracts (CreatePlace, EventCategory)
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - SEED_CITY - default seed city
// - SeedEventSpec - seed event record shape
// - SEED_PLACES - Moscow venues
// - SEED_EVENTS - catalog events keyed by place title and dayOffset
// END_MODULE_MAP

import type { CreatePlace, EventCategory } from "@max-events/api-contracts";

export const SEED_CITY = "Москва";

export const SEED_PLACES: CreatePlace[] = [
  { title: "Парк Горького", address: "ул. Крымский Вал, 9", city: SEED_CITY, category: "park", latitude: 55.7297, longitude: 37.6014 },
  { title: "Третьяковская галерея", address: "Лаврушинский пер., 10", city: SEED_CITY, category: "museum", latitude: 55.7415, longitude: 37.6208 },
  { title: "Столовая №57 ВДНХ", address: "пр-т Мира, 119", city: SEED_CITY, category: "food", latitude: 55.8304, longitude: 37.6315 },
  { title: "Лужники", address: "ул. Лужники, 24", city: SEED_CITY, category: "sport", latitude: 55.7158, longitude: 37.5536 },
  { title: "ВДНХ", address: "пр-т Мира, 119, стр. 1", city: SEED_CITY, category: "other", latitude: 55.8263, longitude: 37.6377 },
];

export type SeedEventSpec = {
  title: string;
  description: string;
  category: EventCategory;
  city: string;
  placeTitle: string;
  dayOffset: number;
  hourUtc: number;
  durationHours?: number;
  isPaid?: boolean;
  priceRub?: number | null;
  paymentUrl?: string | null;
  capacity?: number | null;
};

export const SEED_EVENTS: SeedEventSpec[] = [
  {
    title: "Джаз в Парке Горького",
    description: "Вечерний концерт на открытой сцене у Голицынских прудов.",
    category: "afisha",
    city: SEED_CITY,
    placeTitle: "Парк Горького",
    dayOffset: 7,
    hourUtc: 16,
    durationHours: 2,
    capacity: 120,
  },
  {
    title: "Субботник на ВДНХ",
    description: "Совместная уборка дорожек и посадка кустарников у главного входа.",
    category: "volunteering",
    city: SEED_CITY,
    placeTitle: "ВДНХ",
    dayOffset: 10,
    hourUtc: 8,
    durationHours: 3,
    capacity: 40,
  },
  {
    title: "Прогулка по Замоскворечью",
    description: "Пеший маршрут от Третьяковки к набережной с остановками у купеческих дворов.",
    category: "tourism",
    city: SEED_CITY,
    placeTitle: "Третьяковская галерея",
    dayOffset: 14,
    hourUtc: 10,
    durationHours: 3,
    capacity: 25,
  },
  {
    title: "Утренняя пробежка в Лужниках",
    description: "Лёгкая групповая пробежка по набережной вокруг стадиона.",
    category: "sport",
    city: SEED_CITY,
    placeTitle: "Лужники",
    dayOffset: 5,
    hourUtc: 6,
    durationHours: 1,
    capacity: 30,
  },
];
