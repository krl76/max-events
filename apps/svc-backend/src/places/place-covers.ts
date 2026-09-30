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
  "Патриаршие пруды": "/covers/places/patriarshie.jpg",
  "Чистые пруды": "/covers/places/chistye.jpg",
  "Воробьёвы горы": "/covers/dawn.jpg",
  Музеон: "/covers/graphics.jpg",
  "Новодевичий монастырь": "/covers/places/novodevichy.jpg",
  "Сад «Эрмитаж»": "/covers/places/hermitage.jpg",
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

function isAppPhoto(url: string): boolean {
  return url.startsWith("/") && !url.startsWith("//");
}

function kudagoCoverProxy(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" && parsed.hostname === "media.kudago.com") {
      return `/api/media/cover?src=${encodeURIComponent(url)}`;
    }
  } catch {
    return null;
  }
  return null;
}

function knownCover(title: string): string | null {
  const key = normalize(title);
  const exact = PLACE_LOGOS[title];
  if (exact) return exact;
  for (const [knownTitle, url] of Object.entries(PLACE_LOGOS)) {
    if (normalize(knownTitle) === key) return url;
  }
  for (const [knownTitle, url] of Object.entries(PLACE_LOGOS)) {
    const known = normalize(knownTitle);
    if (known.length >= 6 && (key.includes(known) || known.includes(key))) return url;
  }
  return null;
}

/** A photograph for the venue: same-origin stored logo, then a known Moscow cover, then a proxied KudaGo image, then the category. */
export function placePhotoUrl(place: { title: string; category?: string; logoUrl?: string | null }): string {
  const stored = place.logoUrl?.trim() ?? "";
  if (stored !== "" && isAppPhoto(stored)) return stored;
  const known = knownCover(place.title);
  if (known) return known;
  if (stored !== "") {
    const proxied = kudagoCoverProxy(stored);
    if (proxied) return proxied;
    return stored;
  }
  return CATEGORY_PHOTOS[place.category ?? ""] ?? "/onboarding/gorky.jpg";
}
