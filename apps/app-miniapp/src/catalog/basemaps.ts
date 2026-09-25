// START_MODULE_CONTRACT
// PURPOSE: Подложки карты (экран 16): каталог растровых тайл-серверов на данных OpenStreetMap, подложка по умолчанию и сохранённый выбор пользователя.
// SCOPE: Чистые данные и функции плюс ключ localStorage. Сам слой Leaflet создаёт и меняет ./MapScreen.tsx, переключатель — его чипы. Все источники публичные и без ключа, у каждого своя строка источника, которую экран обязан показывать; политика использования у каждого сервера своя, и для продакшена с заметной нагрузкой нужен либо свой тайл-сервер, либо договор с провайдером.
// DEPENDS: window.localStorage
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - BASEMAP_STORAGE_KEY - ключ сохранённого выбора подложки (соседи: max-events:theme, max-events:onboarding)
// - MapBasemapTone - light | dark: тёмной подложке не нужна инверсия тёмной схемы, светлая под неё инвертируется фильтром
// - MapBasemap - одна подложка: id, подпись чипа, шаблон URL, поддомены, предельный зум, тон и части строки источника
// - MAP_BASEMAPS - каталог подложек в порядке чипов; стандартная OSM первая, потому что была единственной до переключателя
// - DEFAULT_BASEMAP - подложка по умолчанию — стандартная OSM
// - basemapById - подложка по id; незнакомый id (устаревший или испорченный сохранённый выбор) отдаёт подложку по умолчанию
// - readBasemapPreference - сохранённый выбор или подложка по умолчанию; сбой storage читается как «не выбирали»
// - writeBasemapPreference - сохранить выбор; сбой storage не отменяет переключения на экране
// - basemapCredit - строка источника под картой: «© OpenStreetMap · © CARTO»
// END_MODULE_MAP

export const BASEMAP_STORAGE_KEY = "max-events:basemap";

export type MapBasemapTone = "light" | "dark";

export interface MapBasemap {
  id: string;
  /** Подпись чипа: коротко, чтобы десять подложек уместились в прокручиваемый ряд. */
  label: string;
  /** Шаблон Leaflet: {z}/{x}/{y}, {s} — поддомен, {r} — «@2x» на ретине (Leaflet подставляет сам). */
  url: string;
  subdomains?: string;
  maxZoom: number;
  tone: MapBasemapTone;
  /** Части строки источника; «© OpenStreetMap» есть у всех, потому что данные везде из OSM. */
  credit: readonly string[];
}

const OSM = "© OpenStreetMap";

/**
 * Все URL проверены живым запросом тайла Москвы (z11) и загрузкой в браузере 2026-09-19: каждый отвечает
 * 200 без ключа и без водяных знаков. Не вошли: CARTO (Voyager, Positron, Dark Matter) — тайлы приходят с
 * надписью «API KEY REQUIRED», то есть только по бесплатному ключу; Stadia/Stamen — 401 без ключа;
 * Esri — не OSM-данные. Тёмной подложки среди бесключевых нет, поэтому тёмная схема инвертирует светлую
 * фильтром (theme.css); поле tone готово принять тёмный источник, когда появится ключ.
 */
export const MAP_BASEMAPS: readonly MapBasemap[] = [
  { id: "osm", label: "Стандарт", url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", maxZoom: 19, tone: "light", credit: [OSM] },
  { id: "osm-de", label: "Немецкий", url: "https://tile.openstreetmap.de/{z}/{x}/{y}.png", maxZoom: 18, tone: "light", credit: [OSM, "openstreetmap.de"] },
  { id: "osm-fr", label: "Французский", url: "https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png", subdomains: "abc", maxZoom: 20, tone: "light", credit: [OSM, "OSM France"] },
  { id: "hot", label: "Гуманитарный", url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", subdomains: "abc", maxZoom: 19, tone: "light", credit: [OSM, "HOT", "OSM France"] },
  { id: "cyclosm", label: "Велосипедный", url: "https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png", subdomains: "abc", maxZoom: 20, tone: "light", credit: [OSM, "CyclOSM"] },
  { id: "opnv", label: "Транспорт", url: "https://tileserver.memomaps.de/tilegen/{z}/{x}/{y}.png", maxZoom: 18, tone: "light", credit: [OSM, "memomaps.de"] },
  { id: "opentopo", label: "Рельеф", url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", subdomains: "abc", maxZoom: 17, tone: "light", credit: [OSM, "SRTM", "© OpenTopoMap"] },
];

export const DEFAULT_BASEMAP: MapBasemap = MAP_BASEMAPS[0];

/** Незнакомый id — не ошибка, а старый или испорченный сохранённый выбор: карта открывается на подложке по умолчанию. */
export function basemapById(id: string | null | undefined): MapBasemap {
  return MAP_BASEMAPS.find((item) => item.id === id) ?? DEFAULT_BASEMAP;
}

export function readBasemapPreference(): MapBasemap {
  if (typeof window === "undefined") return DEFAULT_BASEMAP;
  try {
    return basemapById(window.localStorage.getItem(BASEMAP_STORAGE_KEY));
  } catch {
    // Приватный режим / отключённое хранилище: подложка по умолчанию лучше сломанной карты.
    return DEFAULT_BASEMAP;
  }
}

export function writeBasemapPreference(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BASEMAP_STORAGE_KEY, id);
  } catch {
    // Потеря сохранения не должна отменять переключение, которое уже произошло на экране.
  }
}

export function basemapCredit(basemap: MapBasemap): string {
  return basemap.credit.join(" · ");
}
