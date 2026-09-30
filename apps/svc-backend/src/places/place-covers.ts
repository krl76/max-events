// START_MODULE_CONTRACT
// PURPOSE: Same-origin photographs for Moscow venues, by exact title and by category fallback.
// SCOPE: PLACE_LOGOS, placePhotoUrl. No I/O.
// DEPENDS: none
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT

export const PLACE_LOGOS: Readonly<Record<string, string>> = {
  "Парк Горького": "/onboarding/gorky.jpg",
  Сокольники: "/covers/places/sokolniki.jpg",
  ВДНХ: "/covers/places/vdnh.jpg",
  "Парк «Зарядье»": "/covers/places/zaryadye.jpg",
  Зарядье: "/covers/places/zaryadye.jpg",
  Коломенское: "/covers/kolomenskoe.jpg",
  Царицыно: "/covers/visits/tsaritsyno.jpg",
  Кусково: "/covers/places/kuskovo.jpg",
  "Аптекарский огород": "/covers/places/apothecary.jpg",
  "Измайловский парк": "/covers/places/izmailovo.jpg",
  "Парк Победы": "/covers/places/pobedy.jpg",
  "Нескучный сад": "/covers/places/neskuchny.jpg",
  "Третьяковская галерея": "/covers/visits/museum.jpg",
  "ГМИИ им. А.С. Пушкина": "/covers/places/pushkin.jpg",
  "ГМИИ им. А. С. Пушкина": "/covers/places/pushkin.jpg",
  "Музей космонавтики": "/covers/places/cosmos.jpg",
  "Дарвиновский музей": "/covers/places/darwin.jpg",
  "Музей «Гараж»": "/covers/places/garage.jpg",
  "Кофейня «Даблби»": "/covers/visits/cafe.jpg",
  "Пекарня «Батон»": "/covers/places/baton.jpg",
  "Кофейня «Сёрф»": "/covers/places/surf.jpg",
  "Антикафе «Циферблат»": "/covers/concert.jpg",
  Лужники: "/covers/places/luzhniki.jpg",
  "«Лужники»": "/covers/places/luzhniki.jpg",
  "СК «Олимпийский»": "/covers/places/olympic.jpg",
  "ВТБ Арена": "/covers/places/vtb.jpg",
  "УСЗ «Москвич»": "/covers/places/moskvich.jpg",
  "ДК «Москва»": "/covers/places/dk.jpg",
  "Кинотеатр «Иллюзион»": "/covers/places/illusion.jpg",
};

const CATEGORY_PHOTOS: Readonly<Record<string, string>> = {
  park: "/onboarding/gorky.jpg",
  museum: "/covers/visits/museum.jpg",
  food: "/covers/visits/cafe.jpg",
  sport: "/covers/places/luzhniki.jpg",
  other: "/covers/concert.jpg",
};

function normalize(title: string): string {
  return title.toLowerCase().replace(/[«»"'.,]/g, "").replace(/\s+/g, " ").trim();
}

/** A photograph for the venue: stored logo, then a known Moscow cover, then the category. */
export function placePhotoUrl(place: { title: string; category?: string; logoUrl?: string | null }): string {
  if (place.logoUrl && place.logoUrl.trim() !== "") return place.logoUrl;
  const key = normalize(place.title);
  const exact = PLACE_LOGOS[place.title];
  if (exact) return exact;
  for (const [title, url] of Object.entries(PLACE_LOGOS)) {
    if (normalize(title) === key) return url;
  }
  for (const [title, url] of Object.entries(PLACE_LOGOS)) {
    const known = normalize(title);
    if (known.length >= 6 && (key.includes(known) || known.includes(key))) return url;
  }
  return CATEGORY_PHOTOS[place.category ?? ""] ?? "/onboarding/gorky.jpg";
}
