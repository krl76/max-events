// START_MODULE_CONTRACT
// PURPOSE: Подложки карты (экран 16): каталог растровых тайл-серверов на данных OpenStreetMap плюс собственная векторная подложка проекта, подложка по умолчанию и сохранённый выбор пользователя.
// SCOPE: Чистые данные и функции плюс ключ localStorage. Растровый слой Leaflet создаёт и меняет ./MapScreen.tsx, векторный поднимает ./vectorBasemap.ts, стиль ему собирает ./basemapStyle.ts; переключатель — чипы экрана. Все внешние источники публичные и без ключа, у каждого своя строка источника, которую экран обязан показывать; политика использования у каждого сервера своя, и для продакшена с заметной нагрузкой нужна либо своя подложка (она здесь и есть: Москва и область), либо договор с провайдером.
// DEPENDS: window.localStorage
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - BASEMAP_STORAGE_KEY - ключ сохранённого выбора подложки (соседи: max-events:theme, max-events:onboarding)
// - MapBasemapTone - light | dark | scheme: тёмной подложке не нужна инверсия тёмной схемы, светлая под неё инвертируется фильтром, scheme — подложка сама следует схеме приложения
// - MapBasemapKind - raster | vector: растровые PNG-тайлы через Leaflet или векторный архив PMTiles через MapLibre
// - RasterBasemap - растровая подложка: шаблон URL, поддомены, предельный зум
// - VectorBasemap - векторная подложка: относительный путь к архиву PMTiles и шаблон глифов шрифтов на том же домене
// - MapBasemap - одна подложка любого вида: id, подпись чипа, тон и части строки источника общие
// - OWN_BASEMAP - собственная подложка «Своя»: Москва и область, собрана Planetiler из OSM в схеме OpenMapTiles и лежит рядом с приложением (/tiles, см. DEPLOY.md)
// - STANDARD_BASEMAP - стандартная растровая OSM: запасная, к которой экран возвращается, если своя не поднялась (нет WebGL, MapLibre не догрузился)
// - MAP_BASEMAPS - каталог подложек в порядке чипов; своя первая, потому что она по умолчанию, стандартная OSM сразу за ней
// - DEFAULT_BASEMAP - first paint is raster OSM; saved choice overrides; «Своя» stays first in the chip row
// - isVectorBasemap - сужение типа: подложке нужен MapLibre, а не L.tileLayer
// - basemapById - подложка по id; незнакомый id (устаревший или испорченный сохранённый выбор) отдаёт подложку по умолчанию
// - readBasemapPreference - сохранённый выбор или подложка по умолчанию; сбой storage читается как «не выбирали»
// - writeBasemapPreference - сохранить выбор; сбой storage не отменяет переключения на экране
// - basemapCredit - строка источника под картой: «© OpenStreetMap · © OpenMapTiles»
// END_MODULE_MAP

export const BASEMAP_STORAGE_KEY = "max-events:basemap";

export type MapBasemapTone = "light" | "dark" | "scheme";

export type MapBasemapKind = "raster" | "vector";

interface MapBasemapBase {
  id: string;
  /** Подпись чипа: коротко, чтобы десять подложек уместились в прокручиваемый ряд. */
  label: string;
  maxZoom: number;
  tone: MapBasemapTone;
  /** Части строки источника; «© OpenStreetMap» есть у всех, потому что данные везде из OSM. */
  credit: readonly string[];
}

export interface RasterBasemap extends MapBasemapBase {
  kind: "raster";
  /** Шаблон Leaflet: {z}/{x}/{y}, {s} — поддомен, {r} — «@2x» на ретине (Leaflet подставляет сам). */
  url: string;
  subdomains?: string;
}

export interface VectorBasemap extends MapBasemapBase {
  kind: "vector";
  /** Путь к архиву PMTiles относительно корня сайта: один файл, nginx отдаёт его по Range-запросам. */
  tiles: string;
  /** Шаблон глифов MapLibre с {fontstack} и {range}, тоже относительно корня сайта. */
  glyphs: string;
}

export type MapBasemap = RasterBasemap | VectorBasemap;

const OSM = "© OpenStreetMap";

/**
 * Москва и область (рамка 35.14..40.21 в.д., 54.25..56.96 с.ш.) из выгрузки Geofabrik по ЦФО, собрана
 * Planetiler в схеме OpenMapTiles до 14-го зума; дальше MapLibre дорисовывает те же векторы сам.
 * Стиль — ./basemapStyle.ts, он следует схеме приложения, поэтому тон здесь «scheme». За рамкой
 * данных нет: карта там пустая, и это честная граница своей подложки, а не ошибка.
 */
export const OWN_BASEMAP: VectorBasemap = { id: "own", label: "Своя", kind: "vector", tiles: "/tiles/moscow.pmtiles", glyphs: "/tiles/fonts/{fontstack}/{range}.pbf", maxZoom: 20, tone: "scheme", credit: [OSM, "© OpenMapTiles"] };

/** Единственная подложка до переключателя и запасная сейчас: растровые тайлы — обычные картинки, WebGL им не нужен. */
export const STANDARD_BASEMAP: RasterBasemap = { id: "osm", label: "Стандарт", kind: "raster", url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", maxZoom: 19, tone: "light", credit: [OSM] };

/**
 * Все внешние URL проверены живым запросом тайла Москвы (z11) и загрузкой в браузере 2026-09-19: каждый
 * отвечает 200 без ключа и без водяных знаков. Не вошли: CARTO (Voyager, Positron, Dark Matter) — тайлы
 * приходят с надписью «API KEY REQUIRED», то есть только по бесплатному ключу; Stadia/Stamen — 401 без
 * ключа; Esri — не OSM-данные. Тёмной растровой подложки среди бесключевых нет, поэтому тёмная схема
 * инвертирует светлую фильтром (theme.css); своя векторная подложка тёмная сама.
 */
export const MAP_BASEMAPS: readonly MapBasemap[] = [
  OWN_BASEMAP,
  STANDARD_BASEMAP,
  { id: "osm-de", label: "Немецкий", kind: "raster", url: "https://tile.openstreetmap.de/{z}/{x}/{y}.png", maxZoom: 18, tone: "light", credit: [OSM, "openstreetmap.de"] },
  { id: "osm-fr", label: "Французский", kind: "raster", url: "https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png", subdomains: "abc", maxZoom: 20, tone: "light", credit: [OSM, "OSM France"] },
  { id: "hot", label: "Гуманитарный", kind: "raster", url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", subdomains: "abc", maxZoom: 19, tone: "light", credit: [OSM, "HOT", "OSM France"] },
  { id: "cyclosm", label: "Велосипедный", kind: "raster", url: "https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png", subdomains: "abc", maxZoom: 20, tone: "light", credit: [OSM, "CyclOSM"] },
  { id: "opnv", label: "Транспорт", kind: "raster", url: "https://tileserver.memomaps.de/tilegen/{z}/{x}/{y}.png", maxZoom: 18, tone: "light", credit: [OSM, "memomaps.de"] },
  { id: "opentopo", label: "Рельеф", kind: "raster", url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", subdomains: "abc", maxZoom: 17, tone: "light", credit: [OSM, "SRTM", "© OpenTopoMap"] },
];

/** First paint is raster OSM so MapLibre (~1 MB) stays out until the viewer picks «Своя». */
export const DEFAULT_BASEMAP: MapBasemap = STANDARD_BASEMAP;

export function isVectorBasemap(basemap: MapBasemap): basemap is VectorBasemap {
  return basemap.kind === "vector";
}

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
