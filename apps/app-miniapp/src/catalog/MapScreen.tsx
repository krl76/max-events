// START_MODULE_CONTRACT
// PURPOSE: Экран 16 «Карта»: the Leaflet map with OSM-based tiles (the project's own vector basemap by default plus seven raster ones, the choice remembered on the device), event/place/friend pins, the «Вы здесь» marker, the weather chip, the layer and basemap chips, the card of the selected object with its travel times and the route it draws.
// SCOPE: The canvas is unconditional — every data source of this screen (places, friends, weather, travel, and the events handed in by the page) may fail or come back empty, and the map still opens with «Вы здесь» and a line saying what is missing. Places fetched via apiClient.listPlaces and the friend layer via apiClient.listFriendPlaces; the weather and the travel estimates come from apiClient.getMapWeather / getTravelOptions, both mock-backed (#495, #504). Leaflet is loaded lazily (dynamic import) so it stays out of the main bundle; the map instance is created once and fed updates, so a filter or a layer toggle no longer resets pan and zoom. The vector basemap mounts asynchronously through ./vectorBasemap.ts (MapLibre lazy too) and follows the rendered colour scheme; when it cannot mount the screen falls back to the standard raster tiles and says so.
// DEPENDS: leaflet (dynamic import + css), ../api/client.js (apiClient, MapWeather, TravelOption), ./basemaps.js (MAP_BASEMAPS, STANDARD_BASEMAP, MapBasemap, basemapCredit, read/writeBasemapPreference), ./vectorBasemap.js (mountVectorBasemap, VectorBasemapLayer), ../ui/theme.js (useAppliedScheme, ThemeScheme), ./mapMarkers.js (buildMapMarkers, clusterMapMarkers, MapMarker, MapPinGlyph), ./useLeafletMap.js, ../geo/profile-city.js, ../ui/icons.js, ../ui/primitives.js
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - MOSCOW_CENTER - fixed Moscow city center coords (shared with the nearby screen)
// - MOSCOW_ZOOM - shared Leaflet initial zoom (imported by the MyCity map)
// - OSM_TILE_URL - shared OpenStreetMap tile URL (imported by the MyCity map)
// - escapeHtml - escape text going into a Leaflet divIcon, which takes html rather than nodes
// - MAP_LAYERS - the three layer chips of экран 16 in design order
// - MapLayer - union of the layer names
// - mapWrapClass - the wrapper class by basemap tone: dark raster and the own vector basemap escape the dark-scheme inversion (theme.css)
// - formatMapTemperature - «+19°», with the sign the chip prints
// - mapWeatherChipText - chip temperature, or «—» while the forecast is missing so the chip never disappears
// - formatMapChange - «дождь в 19:00»; null when nothing is expected (#495)
// - MAP_HOURLY_COLUMNS - how many hours the map weather strip shows
// - mapHourGlyph - WMO code -> sun / cloud / rain on the map sheet strip
// - formatMapHour - «19:00» for one strip column
// - mapRainHint - «Дождь с 19:00 — метро суше, зонт не понадобится»; null without rain or without a metro option
// - formatTravelOption - one travel tile: the big «18 мин» and the «пешком · 1,4 км» under it (#504)
// - mapFriendsLine - «Анна была здесь», «Анна и Дима были здесь»; null when no friend has
// - MapNoticeInput - everything the one line over the canvas has to weigh: failures, emptiness, filters, geolocation
// - MAP_EVENT_CATEGORIES - «Афиша», «Туризм», «Спорт», «Волонтёрство» on the map filter row
// - filterMapEvents - event pins after the category chip and the map search
// - mapNotice - the single line the map says about itself; null when there is nothing to explain
// - MapView - the data the map is drawn from: markers, viewer origin, route, selected key, the basemap the tiles come from and the rendered colour scheme
// - MapCallbacks - what the map calls back into React: open event, open place, select a pin, report dead tiles, fall back from a vector basemap that could not mount
// - MapHandle - the live map: take a new view, zoom by a step, fly to a point, dispose
// - initEventMap - create Leaflet map + the basemap layer of the view (raster L.tileLayer or the vector MapLibre layer via ./vectorBasemap.ts; swapped in place when the view brings another, the dead-tiles report re-armed with it, a late-arriving vector layer dropped if the user moved on, a scheme change restyling the vector one) + the pin layer (clustered by a screen gap; a zoom that opens that gap draws each pin at its own lat/lng, a tap on a number only flies the camera there, promoted events highlighted #205, the friends layer keeping its tile pin #472), the «Вы здесь» marker and the dotted route; returns the handle
// - MapSelectionCard - the card of the selected object: photo, title, address, brief walk/car/transit times and «Построить маршрут»
// - MapScreen - экран 16: pins, layers, the basemap picker (chips under the layers, the choice persisted through ./basemaps.js, the credit line following it), weather, selection, route and the map search over the Leaflet lifecycle via useLeafletMap
// - mapHourlyWindow - the eight-hour window the map weather chip asks the backend for
// END_MODULE_MAP

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Event, EventCategory, FriendPlaceVisit, Place } from "@max-events/api-contracts";
import "leaflet/dist/leaflet.css";
import { apiClient, type EventForecast, type EventWeatherHour, type MapWeather, type TravelOption } from "../api/client";
import { CATEGORY_LABELS, pluralRu } from "./format";
import { metroGeometry, planMetroRide } from "./metroRoute";
import { osrmTrip, stitchWalkingRoute } from "./walkingRoute";
import { intentForStopKind, mapRouteProfileFor, type MapRouteProfile } from "./mapRoutePolicy";
import { useProfileCityPoint } from "../geo/profile-city";
import { ActionIcon, type ActionIconName } from "../ui/icons";
import { pictured } from "../ui/photos";
import { useAppliedScheme, type ThemeScheme } from "../ui/theme";
import { basemapCredit, MAP_BASEMAPS, readBasemapPreference, STANDARD_BASEMAP, writeBasemapPreference, type MapBasemap } from "./basemaps";
import { buildMapMarkers, clusterMapMarkers, type MapMarker, type MapPinGlyph } from "./mapMarkers";
import { droppedPinCardVisible, droppedPinKey, droppedPinStop, DROPPED_PIN_TITLE, placeRouteStop, routeBarLabel, type MapRouteStop } from "./droppedPinRoute";
import { pinLabel } from "../ui/pin-label";
import { useLeafletMap } from "./useLeafletMap";
import { mountVectorBasemap, paintableBasemap, type VectorBasemapLayer } from "./vectorBasemap";
import { useMapAssistIds } from "./useMapAssistIds";

/** Fixtures and P0 scope are Moscow-only, so the map opens on the city center; also the anchor point of the nearby screen. */
export const MOSCOW_CENTER: [number, number] = [55.7522, 37.6156];
export const MOSCOW_ZOOM = 11;
export const OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

/** Leaflet divIcon takes an html string rather than a node, so anything from the data has to be escaped first. */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export type MapLayer = "friends" | "events" | "places";

export const MAP_LAYERS: readonly MapLayer[] = ["friends", "events", "places"];

/**
 * Класс обёртки экрана по тону подложки (theme.css): тёмная растровая и своя векторная не инвертируются
 * тёмной схемой, светлая растровая — инвертируется. Висит на обёртке, а не на контейнере leaflet, чей
 * classList React перезаписал бы целиком вместе с классами самого leaflet.
 */
export function mapWrapClass(basemap: MapBasemap): string {
  if (basemap.tone === "dark") return "app-map-wrap app-map16 app-map16--tiles-dark";
  if (basemap.tone === "scheme") return "app-map-wrap app-map16 app-map16--tiles-scheme";
  return "app-map-wrap app-map16";
}

/** «+19°» — the chip always carries the sign, so a zero reads as measured rather than missing. */
export function formatMapTemperature(weather: MapWeather): string {
  const rounded = Math.round(weather.temperatureC);
  return `${rounded > 0 ? "+" : ""}${rounded}°`;
}

/** The weather chip stays on the map even when the forecast request failed. */
export function mapWeatherChipText(weather: MapWeather | null): string {
  return weather === null ? "—" : formatMapTemperature(weather);
}

/** «дождь в 19:00»; null when the forecast expects no change (#495). */
export function formatMapChange(weather: MapWeather): string | null {
  if (weather.changesAt === null || weather.changesTo === null) return null;
  return `${weather.changesTo} в ${new Date(weather.changesAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
}

/** Hours the map sheet asks from GET /weather/hourly: now through the next seven. */
export const MAP_HOURLY_COLUMNS = 8;

export function mapHourlyWindow(now = new Date()): { from: Date; to: Date } {
  const from = new Date(now);
  from.setUTCMinutes(0, 0, 0);
  const to = new Date(from.getTime() + (MAP_HOURLY_COLUMNS - 1) * 60 * 60 * 1000);
  return { from, to };
}

export function mapHourGlyph(conditionCode: number): ActionIconName {
  if (conditionCode >= 51) return "rain";
  return conditionCode === 0 ? "sun" : "weather";
}

export function formatMapHour(at: string): string {
  return new Date(at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

/**
 * «Дождь с 19:00 — метро суше, зонт не понадобится». The advice is only honest when there is rain to
 * dodge and a metro option to dodge it with, so it stays silent otherwise rather than inventing one.
 */
export function mapRainHint(weather: MapWeather | null, options: TravelOption[]): string | null {
  if (weather === null || weather.changesAt === null || weather.changesTo === null) return null;
  if (!/дожд|ливен|ливн/i.test(weather.changesTo)) return null;
  if (!options.some((option) => option.mode === "metro")) return null;
  const at = new Date(weather.changesAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const change = `${weather.changesTo.charAt(0).toUpperCase()}${weather.changesTo.slice(1)}`;
  return `${change} с ${at} — метро суше, зонт не понадобится`;
}

const TRAVEL_MODE_NOTE: Record<TravelOption["mode"], string> = { walk: "пешком", metro: "метро", car: "на машине" };

/** «18 мин» over «пешком · 1,4 км»: the number carries the decision, the line under it the reason (#504). */
export function formatTravelOption(option: TravelOption): { value: string; note: string } {
  const parts = [TRAVEL_MODE_NOTE[option.mode]];
  if ((option.mode === "walk" || option.mode === "car") && option.distanceKm !== null) parts.push(`${option.distanceKm.toLocaleString("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} км`);
  if (option.mode === "metro" && option.transfers !== null) parts.push(option.transfers === 0 ? "без пересадок" : `${option.transfers} ${pluralRu(option.transfers, "пересадка", "пересадки", "пересадок")}`);
  return { value: `${option.minutes} мин`, note: parts.join(" · ") };
}

export function travelIcon(mode: TravelOption["mode"]): ActionIconName {
  if (mode === "car") return "car";
  if (mode === "metro") return "metro";
  return "walk";
}

/** Icons that match the drawn OSM line: walk, walk+metro, or car. */
export function routeGlyphs(profile: MapRouteProfile): ActionIconName[] {
  if (profile === "metro") return ["walk", "metro"];
  if (profile === "driving") return ["car"];
  return ["walk"];
}

export function formatDrawnRoute(minutes: number): string {
  return `${minutes} мин`;
}

function minutesForProfile(options: readonly TravelOption[], profile: MapRouteProfile): number | null {
  const mode: TravelOption["mode"] = profile === "foot" ? "walk" : profile === "metro" ? "metro" : "car";
  return options.find((option) => option.mode === mode)?.minutes ?? null;
}

/**
 * «Анна и Дима были здесь» — the layer answers past visits, so the line is in the past tense. Russian
 * has no gender-neutral past tense and the friend list carries no gender, so a single name takes the
 * colon form the map popups already use («Были: …») instead of guessing «был» or «была».
 */
export function mapFriendsLine(visit: FriendPlaceVisit | undefined): string | null {
  const names = (visit?.friends ?? []).map((friend) => friend.name.split(" ")[0]);
  if (names.length === 0) return null;
  if (names.length === 1) return `Были здесь: ${names[0]}`;
  if (names.length === 2) return `${names[0]} и ${names[1]} были здесь`;
  return `${names[0]}, ${names[1]} и ещё ${names.length - 2} были здесь`;
}

export interface MapNoticeInput {
  /** Leaflet не поднялся вовсе: холста нет, и сказать об этом обязаны словами. */
  mapFailed: boolean;
  tilesFailed: boolean;
  /** Своя векторная подложка не поднялась и карта вернулась к стандартной: человек видит не то, что выбрал. */
  vectorFallback: boolean;
  loading: boolean;
  placesFailed: boolean;
  eventsFailed: boolean;
  /** Прогулка не открылась: карта остаётся, строка — та же, что при упавшем списке объектов. */
  walkFailed?: boolean;
  markerCount: number;
  query: string;
  /** Set when a category chip is hiding the other events. */
  categoryLabel?: string | null;
  anyLayerOn: boolean;
  geoDenied: boolean;
  locateOn: boolean;
  /** False when the canvas is centered on the city, so «рядом» would name the wrong place. */
  inCity?: boolean;
}

/**
 * Одна строка поверх карты вместо экрана ошибки. Порядок — по тому, что мешает сильнее: сначала
 * сломанное, потом пустое, потом объяснение пустоты. Возвращает null, когда объяснять нечего:
 * карта с объектами молчит.
 */
export function mapNotice(input: MapNoticeInput): string | null {
  if (input.mapFailed) return "Карта не загрузилась. Обновите экран — объекты и поиск на месте.";
  if (input.tilesFailed) return "Подложка карты не отвечает. Метки и маршрут работают.";
  if (input.vectorFallback) return "Своя подложка здесь не открылась — показана стандартная.";
  if (input.walkFailed === true) return input.markerCount > 0 ? "Часть объектов не загрузилась — на карте не всё." : "Объекты не загрузились. Карта на месте, попробуйте позже.";
  if (input.locateOn && input.geoDenied) return "Где вы — браузер не сказал. Показываем центр города.";
  if (input.markerCount > 0) return input.placesFailed || input.eventsFailed ? "Часть объектов не загрузилась — на карте не всё." : null;
  if (input.loading) return input.inCity === false ? "Ищем объекты в городе…" : "Ищем объекты рядом…";
  if (!input.anyLayerOn) return "Все слои выключены — включите хотя бы один.";
  // События без площадок остаются без координат, поэтому упавший listPlaces обнуляет карту целиком:
  // сказать «рядом ничего нет» было бы неправдой — искать было нечем.
  if (input.placesFailed || input.eventsFailed) return "Объекты не загрузились. Карта на месте, попробуйте позже.";
  if (input.query.trim() !== "") return `По запросу «${input.query.trim()}» на карте ничего нет.`;
  if (input.categoryLabel) return `В категории «${input.categoryLabel}» на карте ничего нет.`;
  return input.inCity === false ? "В городе ничего не нашлось." : "Рядом ничего не нашлось.";
}

/** Categories the map filter popup offers. Undefined is «Все». */
export const MAP_EVENT_CATEGORIES: readonly EventCategory[] = ["afisha", "tourism", "sport", "volunteering"];

/** Three basemaps are enough on a phone. The pictures are real tiles, not painted swatches. */
export const MAP_CHOICES = ["own", "osm", "opentopo"] as const;

export function basemapShot(basemap: MapBasemap): string | null {
  if (basemap.kind !== "raster") return null;
  return basemap.url.replaceAll("{s}", "a").replace("{z}", "11").replace("{x}", "1238").replace("{y}", "639");
}

const MAP_SPORT = /спорт|футбол|йог|пробеж|воркаут|трениров|теннис|стритбол|кроссфит|плаван|офп/;
const MAP_VOLUNTEER = /волонт|волонтер|субботник/;
const MAP_BILL = /афиш|концерт|музык|джаз|кино|лекци/;
const MAP_TRIP = /туризм|экскурс|поход|прогул/;

/** Event pins only. A category word, including a colloquial stem, matches that category. AI picks replace the local guess once they arrive. */
export function filterMapEvents(events: readonly Event[], category: EventCategory | undefined, needle: string, aiIds?: ReadonlySet<string> | null): Event[] {
  const query = needle.trim().toLowerCase();
  const named = query.replaceAll("ё", "е");
  const picked = aiIds != null && aiIds.size > 0 ? aiIds : null;
  return events.filter((item) => {
    if (category !== undefined && item.category !== category) return false;
    if (query === "") return true;
    if (picked !== null) return picked.has(item.id);
    const blob = `${item.title} ${item.description}`.toLowerCase();
    if (blob.includes(query)) return true;
    if (MAP_SPORT.test(named) && (item.category === "sport" || MAP_SPORT.test(blob))) return true;
    if (MAP_VOLUNTEER.test(named) && (item.category === "volunteering" || MAP_VOLUNTEER.test(blob))) return true;
    if (MAP_BILL.test(named) && (item.category === "afisha" || MAP_BILL.test(blob))) return true;
    if (MAP_TRIP.test(named) && (item.category === "tourism" || MAP_TRIP.test(blob))) return true;
    return false;
  });
}

function popupNode(marker: MapMarker, onOpenEvent: (id: string) => void, onOpenPlace: (id: string) => void): HTMLElement {
  const root = document.createElement("div");
  root.className = "app-map-popup";
  if (marker.promoted) {
    const chip = document.createElement("span");
    chip.className = "app-today-chip";
    chip.textContent = "Промо";
    root.append(chip);
  }
  const title = document.createElement("span");
  title.className = "app-map-popup-title";
  title.textContent = marker.title;
  const subtitle = document.createElement("span");
  subtitle.className = "app-map-popup-subtitle";
  subtitle.textContent = marker.subtitle;
  root.append(title, subtitle);
  if (marker.eventId !== null) {
    const eventId = marker.eventId;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "app-map-popup-open";
    button.textContent = "Открыть";
    button.addEventListener("click", () => onOpenEvent(eventId));
    root.append(button);
  } else if (marker.placeId !== null) {
    const placeId = marker.placeId;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "app-map-popup-open";
    button.textContent = "Открыть место";
    button.addEventListener("click", () => onOpenPlace(placeId));
    root.append(button);
  }
  return root;
}

/**
 * Рисунок внутри пина. Глифы повторяют язык ./ui/icons.tsx (сетка 24, скруглённый штрих), но живут
 * строками: divIcon принимает html, а не узлы, и тянуть ради восьми контуров react-dom/server
 * в клиентский бандл незачем.
 */
const PIN_GLYPH_PATHS: Record<MapPinGlyph, string> = {
  afisha: '<path d="M12 3.6l2.5 5.1 5.6.8-4 4 .9 5.6-5-2.7-5 2.7.9-5.6-4-4 5.6-.8Z"/>',
  volunteering: '<path d="M12 20.3S3.4 15.4 3.4 9.6a4.6 4.6 0 0 1 8.6-2.3A4.6 4.6 0 0 1 20.6 9.6c0 5.8-8.6 10.7-8.6 10.7Z"/>',
  tourism: '<path d="M5 20l6-16 3 7 5 2z"/>',
  sport: '<circle cx="12" cy="12" r="8.4"/><path d="M12 3.6c-3 2.6-3 14.2 0 16.8M12 3.6c3 2.6 3 14.2 0 16.8M3.8 9.4c5 2.3 11.4 2.3 16.4 0M3.8 14.6c5-2.3 11.4-2.3 16.4 0"/>',
  park: '<path d="M12 21v-5.4"/><circle cx="12" cy="10" r="5.4"/>',
  museum: '<path d="M4 21V9l8-5 8 5v12"/><path d="M9 21v-6h6v6"/>',
  food: '<path d="M7.4 3v8M10.9 3v8M9.2 11v10"/><path d="M17.4 3c-1.7 1.3-2.5 3.2-2.5 5.6 0 1.7.8 2.8 2.5 3.1V21"/>',
  place: '<path d="M12 21s-6.8-5.4-6.8-10.4a6.8 6.8 0 0 1 13.6 0C18.8 15.6 12 21 12 21Z"/><circle cx="12" cy="10.4" r="2.4"/>',
};

function glyphSvg(glyph: MapPinGlyph, size: number): string {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PIN_GLYPH_PATHS[glyph]}</svg>`;
}

/** Пин объекта: каплю рисует css, здесь — только глиф внутри неё. */
function pinHtml(marker: MapMarker): string {
  const badge = marker.badge === undefined ? "" : `<span class="app-map-mark-num">${marker.badge}</span>`;
  return `<span class="app-map-mark">${badge}<span class="app-map-mark-glyph">${glyphSvg(marker.glyph, 15)}</span></span>`;
}

/** The friend pin of the design is a tile with the friend initial and a short label, not a dot (макет, экран 16). */
function friendPinHtml(marker: MapMarker): string {
  const initial = escapeHtml(marker.subtitle.replace(/^Были:\s*/, "").charAt(0));
  return `<span class="app-map-pin-tile"><span class="app-map-pin-face">${initial}</span><span class="app-map-pin-label">${escapeHtml(marker.title)}</span></span>`;
}

/** Скопление: пузырь с числом. Растёт ступенями, а не пропорционально — иначе крупные закрывают карту. */
function clusterSize(count: number): number {
  if (count < 10) return 40;
  if (count < 25) return 48;
  return 56;
}

export interface MapView {
  markers: MapMarker[];
  /** Where the viewer stands: draws the «Вы здесь» marker and anchors the route. A city-center point uses another label. */
  origin: [number, number] | null;
  hereLabel?: string;
  /** Walking geometry from the origin to the selected object, or the walk's own line when walkRoute is set. */
  route: [number, number][] | null;
  /** The line is the walk itself: numbered stops, no «Вы здесь» pin on top of them. */
  walkRoute?: boolean;
  /** Ключ выбранного маркера: его пин приподнят, чтобы карточка внизу и точка на карте читались как одно. */
  selectedKey: string | null;
  /** Точка, которую поставили на посте: свой пин поверх каталога. */
  dropped?: [number, number] | null;
  /** Подложка, с которой карта берёт тайлы; смена id на месте меняет слой тайлов, ничего больше не пересобирая. */
  basemap: MapBasemap;
  /** Отрисованная схема приложения: своя векторная подложка перекрашивается под неё, растровым она безразлична (их инвертирует CSS). */
  scheme: ThemeScheme;
}

export interface MapCallbacks {
  onOpenEvent: (id: string) => void;
  onOpenPlace: (id: string) => void;
  /** Selecting a pin raises the card of экран 16; without a handler the popup is the whole interaction. */
  onSelect: (marker: MapMarker) => void;
  /** Тап по пину с поста снова открывает карточку маршрута, если её закрыли. */
  onSelectDropped?: () => void;
  /** Тайлы не пришли: экран объясняет пустую подложку вместо того, чтобы притворяться загруженным. */
  onTileTrouble: () => void;
  /** Векторная подложка не поднялась (нет WebGL, MapLibre не догрузился): экран возвращает стандартную растровую. */
  onBasemapFallback: () => void;
}

export interface MapHandle {
  update: (view: MapView) => void;
  zoomBy: (delta: number) => void;
  focus: (point: [number, number], zoom?: number) => void;
  /** Fit every stop of a walk, instead of flying into the first one. */
  frame: (points: readonly [number, number][]) => void;
  dispose: () => void;
}

export async function initEventMap(container: HTMLElement, initial: MapView, callbacks: MapCallbacks): Promise<MapHandle> {
  const L = await import("leaflet");
  const start = initial.origin ?? MOSCOW_CENTER;
  const map = L.map(container, { center: start, zoom: MOSCOW_ZOOM, attributionControl: false, zoomControl: false, zoomAnimation: true, fadeAnimation: true, wheelPxPerZoomLevel: 140 });
  // Подложка — отдельный слой, который меняется на месте: пины, «Вы здесь» и маршрут лежат в своих
  // панах и переключения не замечают. keepBuffer держит кольцо тайлов за краем экрана: панорама не
  // мигает серым на каждый сдвиг. Сообщение о мёртвых тайлах взводится заново с каждой подложкой:
  // молчавший сервер — не приговор следующему. Векторная подложка поднимается асинхронно (MapLibre
  // грузится лениво), поэтому у каждого монтажа свой номер: слой, приехавший после того, как человек
  // уже переключился дальше, снимается, не успев показаться.
  let tiles: { remove: () => unknown } | null = null;
  let vector: VectorBasemapLayer | null = null;
  let tileTroubleReported = false;
  let mountGeneration = 0;
  let view = initial;
  function reportTileTrouble(): void {
    if (tileTroubleReported) return;
    tileTroubleReported = true;
    callbacks.onTileTrouble();
  }
  function mountTiles(basemap: MapBasemap, scheme: ThemeScheme): void {
    tiles?.remove();
    tiles = null;
    vector = null;
    tileTroubleReported = false;
    const generation = ++mountGeneration;
    if (basemap.kind === "raster") {
      const raster = L.tileLayer(basemap.url, { subdomains: basemap.subdomains ?? "abc", maxZoom: basemap.maxZoom, minZoom: 3, keepBuffer: 2, updateWhenIdle: false }).addTo(map);
      raster.on("tileerror", reportTileTrouble);
      tiles = raster;
      return;
    }
    mountVectorBasemap(map, basemap, scheme, { onTrouble: () => generation === mountGeneration && reportTileTrouble() }).then(
      (layer) => {
        if (generation !== mountGeneration) {
          layer.remove();
          return;
        }
        // Схема могла смениться, пока MapLibre грузился: слой догоняет то, что сейчас на экране
        if (view.scheme !== scheme) layer.setScheme(view.scheme);
        tiles = layer;
        vector = layer;
      },
      () => {
        if (generation === mountGeneration) callbacks.onBasemapFallback();
      },
    );
  }
  mountTiles(initial.basemap, initial.scheme);

  const pins = L.layerGroup().addTo(map);
  const overlay = L.layerGroup().addTo(map);
  let drawn = "";

  function placePin(marker: MapMarker, lat: number, lng: number): void {
    const selected = marker.key === view.selectedKey ? " app-map-pin--active" : "";
    const icon = marker.badge !== undefined ? L.divIcon({ className: `app-map-pin app-map-pin--step${selected}`, iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -18], html: `<span class="app-map-step">${marker.badge}</span>` }) : marker.friends ? L.divIcon({ className: `app-map-pin app-map-pin--friends${selected}`, iconSize: [78, 78], iconAnchor: [39, 39], popupAnchor: [0, -40], html: friendPinHtml(marker) }) : L.divIcon({ className: `app-map-pin${marker.promoted ? " app-map-pin--promo" : ""}${selected}`, iconSize: [34, 42], iconAnchor: [17, 42], popupAnchor: [0, -38], html: pinHtml(marker) });
    L.marker([lat, lng], { icon, riseOnHover: true })
      .addTo(pins)
      .bindPopup(popupNode(marker, callbacks.onOpenEvent, callbacks.onOpenPlace))
      .on("click", () => callbacks.onSelect(marker));
  }

  function drawPins(): void {
    const zoom = map.getZoom();
    const steps = view.markers.filter((marker) => marker.badge !== undefined);
    const clusters = clusterMapMarkers(
      view.markers.filter((marker) => marker.badge === undefined),
      zoom,
    );
    const signature = `${view.selectedKey ?? ""}|${steps.map((marker) => marker.key).join("+")}|${clusters.map((cluster) => `${cluster.lat.toFixed(5)},${cluster.lng.toFixed(5)}:${cluster.markers.map((marker) => marker.key).join("+")}`).join(";")}`;
    if (signature === drawn) return;
    drawn = signature;
    pins.clearLayers();
    for (const marker of steps) placePin(marker, marker.lat, marker.lng);
    for (const cluster of clusters) {
      if (cluster.markers.length > 1) {
        const size = clusterSize(cluster.markers.length);
        const icon = L.divIcon({ className: "app-map-pin app-map-pin--cluster", iconSize: [size, size], iconAnchor: [size / 2, size / 2], html: `<span class="app-map-cluster" aria-label="${cluster.markers.length} точек"><span class="app-map-cluster-count">${cluster.markers.length}</span></span>` });
        const bubble = L.marker([cluster.lat, cluster.lng], { icon }).addTo(pins);
        bubble.on("click", () => {
          const bounds = L.latLngBounds(cluster.markers.map((marker) => [marker.lat, marker.lng] as [number, number]));
          map.flyToBounds(bounds.pad(0.4), { padding: [64, 64], maxZoom: map.getMaxZoom(), duration: 0.45 });
        });
        continue;
      }
      const marker = cluster.markers[0];
      placePin(marker, marker.lat, marker.lng);
    }
  }

  function onZoom(): void {
    drawPins();
  }

  function drawOverlay(): void {
    overlay.clearLayers();
    if (view.dropped) {
      L.marker(view.dropped, { icon: L.divIcon({ className: "app-pin-marker", iconSize: [28, 36], iconAnchor: [14, 34], html: '<span class="app-pin-marker-drop"></span>' }), zIndexOffset: 900 })
        .addTo(overlay)
        .on("click", () => callbacks.onSelectDropped?.());
    }
    if (view.route !== null && view.route.length >= 2) {
      L.polyline(view.route, { className: "app-map-route-casing", weight: 8, lineCap: "round", lineJoin: "round" }).addTo(overlay);
      L.polyline(view.route, { className: "app-map-route", weight: 4, lineCap: "round", lineJoin: "round" }).addTo(overlay);
    }
    if (view.origin === null || view.walkRoute === true) return;
    const hereLabel = view.hereLabel ?? "Вы здесь";
    L.marker(view.origin, { icon: L.divIcon({ className: "app-map-pin app-map-pin--me", iconSize: [22, 22], iconAnchor: [11, 11], html: `<span class="app-map-me-dot"></span><span class="app-map-me-label">${hereLabel}</span>` }) }).addTo(overlay);
  }

  map.on("zoom", onZoom);
  map.on("zoomend", onZoom);
  drawPins();
  drawOverlay();

  return {
    update(next) {
      // Смена подложки — единственное, что трогает тайлы; смена схемы перекрашивает векторную на месте;
      // всё остальное перерисовывает лишь пины и маршрут.
      if (next.basemap.id !== view.basemap.id) mountTiles(next.basemap, next.scheme);
      else if (next.scheme !== view.scheme) vector?.setScheme(next.scheme);
      view = next;
      drawPins();
      drawOverlay();
    },
    zoomBy(delta) {
      map.setZoom(map.getZoom() + delta);
    },
    focus(point, zoom) {
      map.flyTo(point, zoom ?? Math.max(map.getZoom(), 14), { duration: 0.6 });
    },
    frame(points) {
      if (points.length === 0) return;
      const line = points.map((point) => [point[0], point[1]] as [number, number]);
      const only = line[0];
      if (line.length === 1 && only !== undefined) {
        map.flyTo(only, 15, { duration: 0.45 });
        return;
      }
      map.flyToBounds(L.latLngBounds(line).pad(0.28), { padding: [72, 88], maxZoom: 16, duration: 0.45 });
    },
    dispose() {
      map.off("zoom", onZoom);
      map.off("zoomend", onZoom);
      map.remove();
    },
  };
}

function MapHourColumn({ hour, selected, onSelect }: { hour: EventWeatherHour; selected: boolean; onSelect: () => void }) {
  const rounded = Math.round(hour.temperatureC);
  return (
    <li className={selected ? "app-map16-weather-hour app-map16-weather-hour--on" : "app-map16-weather-hour"}>
      <button type="button" className="app-map16-weather-hour-btn" aria-pressed={selected} onClick={onSelect}>
        <span className="app-map16-weather-hour-bubble" aria-hidden="true">
          <ActionIcon name={mapHourGlyph(hour.conditionCode)} size={20} />
        </span>
        <span className="app-map16-weather-at">{formatMapHour(hour.at)}</span>
        <span className="app-map16-weather-temp">{`${rounded > 0 ? "+" : ""}${rounded}°`}</span>
      </button>
    </li>
  );
}

const EMPTY_VISITS: FriendPlaceVisit[] = [];
const EMPTY_MARKERS: readonly MapMarker[] = [];

type PlacesState = { status: "loading" } | { status: "error" } | { status: "ready"; places: Place[] };

interface MapSelectionCardProps {
  title: string;
  subtitle: string;
  category: Event["category"] | null;
  photoId?: string | null;
  friendsLine: string | null;
  travel: TravelOption[];
  rainHint: string | null;
  /** Как ехать на метро. null — плашка метро не обещает поездку. */
  metroSteps: readonly string[] | null;
  /** Минуты метро есть, а станции схемы рядом нет: минуты остаются по прямой. */
  metroFar: boolean;
  onRoute: () => void;
  /** Без обработчика кнопка не рисуется: мёртвая кнопка читается как сломанный экран. */
  onDiscuss?: () => void;
  onOpen?: () => void;
  onClose: () => void;
}

export function MapSelectionCard(props: MapSelectionCardProps) {
  return (
    <section className="app-map16-card" aria-label="Выбранный объект">
      <button type="button" className="app-map16-card-close" aria-label="Закрыть" onClick={props.onClose}>
        <ActionIcon name="close" size={16} strokeWidth={2.6} />
      </button>
      {(() => {
        const head = (
          <>
            {props.photoId ? <img className="app-map16-card-media" alt="" src={pictured(props.photoId)} /> : <span className={props.category === null ? "app-map16-card-media" : `app-map16-card-media app-media--${props.category}`} aria-hidden="true" />}
            <span className="app-map16-card-id">
              {props.friendsLine !== null && (
                <span className="app-map16-card-friends">
                  <span className="app-map16-card-dot" aria-hidden="true" />
                  {props.friendsLine}
                </span>
              )}
              <span className="app-map16-card-title">{props.title}</span>
              <span className="app-map16-card-meta">{props.subtitle}</span>
            </span>
          </>
        );
        return props.onOpen ? (
          <button type="button" className="app-map16-card-head" onClick={props.onOpen}>
            {head}
          </button>
        ) : (
          <div className="app-map16-card-head">{head}</div>
        );
      })()}
      {props.travel.length > 0 && (
        <div className="app-map16-travel" aria-label="Как добраться">
          {props.travel.map((option) => (
            <span key={option.mode} className="app-map16-travel-item">
              <ActionIcon name={travelIcon(option.mode)} size={16} />
              <span className="app-map16-travel-line">
                {option.minutes} мин
              </span>
            </span>
          ))}
        </div>
      )}
      <div className="app-map16-card-actions">
        <button type="button" className="app-map16-route" onClick={props.onRoute}>
          <ActionIcon name="navigation" size={18} />
          Построить маршрут
        </button>
      </div>
    </section>
  );
}

interface MapScreenProps {
  events: Event[];
  onOpenEvent: (id: string) => void;
  onOpenPlace: (id: string) => void;
  /** Экран 16 draws its own chrome; without these it stays the plain catalog map view. */
  onDiscuss?: () => void;
  city?: string;
  /** Страница не смогла получить события: карта всё равно открывается, но говорит, чего на ней нет. */
  eventsFailed?: boolean;
  eventsLoading?: boolean;
  /** Точка с поста: карта подлетает к ней и ставит свой пин. */
  pin?: { lat: number; lng: number } | null;
  /** Площадка с поста: карта подлетает к её пину. */
  focusPlaceId?: string | null;
  /** Открыть карту уже с построенным маршрутом до выбранной площадки. */
  drawRoute?: boolean;
  /** Остановки сохранённой прогулки. Идут тем же путём, что и остальные метки. */
  extraMarkers?: readonly MapMarker[];
  /** Линия прогулки по порядку остановок. Пока она есть, каталог с карты уходит: на экране сам маршрут. */
  walkPath?: readonly [number, number][] | null;
  /** Первая остановка прогулки. Не drawRoute: тот флаг смотрит только на одну площадку. */
  focusPoint?: { lat: number; lng: number } | null;
  walkFailed?: boolean;
}

export function MapScreen({ events, onOpenEvent, onOpenPlace, city = "Москва", eventsFailed = false, eventsLoading = false, pin = null, focusPlaceId = null, drawRoute = false, extraMarkers = EMPTY_MARKERS, walkPath = null, focusPoint = null, walkFailed = false }: MapScreenProps) {
  const located = useProfileCityPoint();
  const weatherCity = located.city ?? city;
  // Until the profile city is known the canvas stays on Moscow. A far GPS fix must not pan the map away from the catalog.
  const originPoint = useMemo<[number, number]>(() => (located.settled ? [located.latitude, located.longitude] : [MOSCOW_CENTER[0], MOSCOW_CENTER[1]]), [located.settled, located.latitude, located.longitude]);
  const hereLabel = located.settled && located.fromViewer ? "Вы здесь" : "Центр города";
  const [places, setPlaces] = useState<PlacesState>({ status: "loading" });
  const [friendVisits, setFriendVisits] = useState<FriendPlaceVisit[]>([]);
  const [friendsAsked, setFriendsAsked] = useState(false);
  const [layers, setLayers] = useState<Record<MapLayer, boolean>>({ friends: false, events: true, places: true });
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<EventCategory | undefined>(undefined);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<MapMarker | null>(null);
  const [routeOn, setRouteOn] = useState(drawRoute);
  const [routePlace, setRoutePlace] = useState<MapRouteStop | null>(null);
  const [routeProfile, setRouteProfile] = useState<MapRouteProfile>(walkPath !== null ? "foot" : "driving");
  const routePicked = useRef(false);
  const [dismissedPinKey, setDismissedPinKey] = useState<string | null>(null);
  const [routePath, setRoutePath] = useState<[number, number][] | null>(null);
  const [drawnRoute, setDrawnRoute] = useState<{ profile: MapRouteProfile; minutes: number } | null>(null);
  const [weatherOpen, setWeatherOpen] = useState(false);
  const [centered, setCentered] = useState(false);
  const [weather, setWeather] = useState<MapWeather | null>(null);
  const [hourly, setHourly] = useState<EventForecast | null>(null);
  const [weatherHourAt, setWeatherHourAt] = useState<string | null>(null);
  const [travel, setTravel] = useState<TravelOption[]>([]);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [vectorFallback, setVectorFallback] = useState(false);
  // Подложка читается из хранилища один раз. Без живого WebGL2 вектор не открываем: телефон сразу получает растр.
  const [basemap, setBasemap] = useState<MapBasemap>(() => paintableBasemap(readBasemapPreference(), STANDARD_BASEMAP));
  const [basemapsOpen, setBasemapsOpen] = useState(false);
  const basemapRef = useRef(basemap);
  basemapRef.current = basemap;
  // Своя векторная подложка красится под отрисованную схему, а не под предпочтение: карта показывает то же, что и остальной экран
  const scheme = useAppliedScheme();

  useEffect(() => {
    let alive = true;
    apiClient.listPlaces().then(
      (data) => {
        if (alive) setPlaces({ status: "ready", places: data });
      },
      () => {
        if (alive) setPlaces({ status: "error" });
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!friendsAsked) return;
    let alive = true;
    apiClient.listFriendPlaces().then(
      (visits) => {
        if (alive) setFriendVisits(visits);
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [friendsAsked]);

  useEffect(() => {
    let alive = true;
    const point = { latitude: originPoint[0], longitude: originPoint[1] };
    apiClient.getMapWeather(weatherCity, point).then(
      (loaded) => {
        if (alive) setWeather(loaded);
      },
      // The chip stays on the map with «—»; a failed now-cast must not hide it.
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [weatherCity, originPoint]);

  useEffect(() => {
    if (!weatherOpen) return;
    let alive = true;
    const point = { latitude: originPoint[0], longitude: originPoint[1] };
    const range = mapHourlyWindow();
    apiClient.getMapHourlyWeather(point, range.from, range.to).then(
      (loaded) => {
        if (alive) setHourly(loaded);
      },
      () => {
        if (alive) setHourly(null);
      },
    );
    return () => {
      alive = false;
    };
  }, [weatherOpen, originPoint]);

  const readyPlaces = places.status === "ready" ? places.places : [];
  const needle = query.trim().toLowerCase();
  const aiIds = useMapAssistIds(query);
  const shownEvents = useMemo(() => (layers.events ? filterMapEvents(events, category, needle, aiIds) : []), [events, layers.events, needle, category, aiIds]);
  const shownPlaces = useMemo(() => (layers.places ? readyPlaces.filter((item) => needle === "" || `${item.title} ${item.address}`.toLowerCase().includes(needle)) : []), [readyPlaces, layers.places, needle]);
  // A fresh [] on every render would land in the map's dependency list and rebuild Leaflet each time.
  const visits = useMemo(() => (layers.friends ? friendVisits : EMPTY_VISITS), [layers.friends, friendVisits]);
  const showingWalk = walkPath !== null && walkPath.length >= 2;
  const markers = useMemo(() => {
    if (showingWalk) return [...extraMarkers];
    const catalog = buildMapMarkers(shownEvents, shownPlaces, visits, { placeCatalog: readyPlaces });
    return extraMarkers.length === 0 ? catalog : [...extraMarkers, ...catalog];
  }, [showingWalk, shownEvents, shownPlaces, visits, readyPlaces, extraMarkers]);

  const selectedPlaceId = selected === null ? null : (selected.placeId ?? events.find((item) => item.id === selected.eventId)?.placeId ?? null);
  const travelTargetId = selectedPlaceId ?? (routePlace?.kind === "place" ? (routePlace.placeId ?? null) : null);
  const selectedPlace = selectedPlaceId === null ? undefined : readyPlaces.find((item) => item.id === selectedPlaceId);
  const selectedCategory = selected === null || selected.eventId === null ? null : (events.find((item) => item.id === selected.eventId)?.category ?? null);

  useEffect(() => {
    if (travelTargetId === null) {
      setTravel([]);
      return;
    }
    let alive = true;
    apiClient.getTravelOptions(travelTargetId, { latitude: originPoint[0], longitude: originPoint[1] }).then(
      (options) => {
        if (alive) setTravel(options);
      },
      // Without an estimate the card keeps its title and its route button; it just cannot promise minutes.
      () => {
        if (alive) setTravel([]);
      },
    );
    return () => {
      alive = false;
    };
  }, [travelTargetId, originPoint]);

  useEffect(() => {
    if (routePicked.current) return;
    if (!routeOn || routePlace === null || routePlace.kind !== "place") return;
    if (travel.length === 0) return;
    setRouteProfile(mapRouteProfileFor("event", travel));
  }, [travel, routeOn, routePlace]);

  useEffect(() => {
    if (walkPath !== null && walkPath.length >= 2) return;
    if (!routeOn || routePlace === null) {
      setRoutePath(null);
      setDrawnRoute(null);
      return;
    }
    const dest: [number, number] = [routePlace.latitude, routePlace.longitude];
    setRoutePath([originPoint, dest]);
    const seed = minutesForProfile(travel, routeProfile);
    setDrawnRoute(seed !== null ? { profile: routeProfile, minutes: seed } : null);
    let alive = true;
    const draw = async () => {
      if (routeProfile === "foot") {
        const trip = await osrmTrip(originPoint, dest, "foot");
        if (alive) {
          setRoutePath(trip.path);
          setDrawnRoute({ profile: "foot", minutes: trip.minutes });
        }
        return;
      }
      if (routeProfile === "driving") {
        const trip = await osrmTrip(originPoint, dest, "driving");
        if (alive) {
          setRoutePath(trip.path);
          setDrawnRoute({ profile: "driving", minutes: trip.minutes });
        }
        return;
      }
      const metro = await metroGeometry(originPoint, dest);
      const plan = planMetroRide({ lat: originPoint[0], lng: originPoint[1] }, { lat: dest[0], lng: dest[1] });
      if (!alive) return;
      if (metro !== null && plan !== null) {
        setRoutePath(metro);
        setDrawnRoute({ profile: "metro", minutes: plan.minutes });
        return;
      }
      const trip = await osrmTrip(originPoint, dest, "foot");
      if (alive) {
        setRoutePath(trip.path);
        setDrawnRoute({ profile: "foot", minutes: trip.minutes });
      }
    };
    void draw();
    return () => {
      alive = false;
    };
  }, [routeOn, originPoint, routePlace, walkPath, routeProfile, travel]);
  const select = useCallback((marker: MapMarker) => {
    setSelected(marker);
    setWeatherOpen(false);
    setBasemapsOpen(false);
    setFiltersOpen(false);
    setRouteOn(false);
    setRoutePlace(null);
    setRouteProfile("foot");
  }, []);
  const reopenPin = useCallback(() => {
    setSelected(null);
    setDismissedPinKey(null);
    setRouteOn(false);
    setRoutePlace(null);
    setWeatherOpen(false);
    setBasemapsOpen(false);
    setFiltersOpen(false);
  }, []);

  // Обработчики живут в ref, а не в зависимостях карты: CatalogPage пересоздаёт их на каждый рендер,
  // и карта перерисовывалась бы вхолостую, теряя открытый попап.
  const handlers = useRef({ onOpenEvent, onOpenPlace, select, reopenPin });
  handlers.current = { onOpenEvent, onOpenPlace, select, reopenPin };
  const callbacks = useMemo<MapCallbacks>(
    () => ({
      onOpenEvent: (id) => handlers.current.onOpenEvent(id),
      onOpenPlace: (id) => handlers.current.onOpenPlace(id),
      onSelect: (marker) => handlers.current.select(marker),
      onSelectDropped: () => handlers.current.reopenPin(),
      onTileTrouble: () => {
        setTilesFailed(true);
        if (basemapRef.current.id === STANDARD_BASEMAP.id) return;
        setBasemap(STANDARD_BASEMAP);
        setVectorFallback(true);
      },
      // Возврат к стандартной растровой, а не к подложке по умолчанию: та сама векторная, и цикл был бы бесконечным.
      // Выбор не сохраняется: на другом устройстве та же учётка может открыть свою подложку
      onBasemapFallback: () => {
        setBasemap(STANDARD_BASEMAP);
        setVectorFallback(true);
      },
    }),
    [],
  );
  const dropped = pin === null ? null : ([pin.lat, pin.lng] as [number, number]);
  const view = useMemo<MapView>(() => ({ markers, origin: originPoint, hereLabel, route: weatherOpen ? null : routePath, walkRoute: showingWalk, selectedKey: selected?.key ?? null, dropped, basemap, scheme }), [markers, originPoint, hereLabel, routePath, showingWalk, selected, dropped, basemap, scheme, weatherOpen]);
  const create = useCallback((container: HTMLElement, initial: MapView) => initEventMap(container, initial, callbacks), [callbacks]);
  const { containerRef, handleRef, status } = useLeafletMap<MapView, MapHandle>(create, view);

  // «Показать, где я» не пересоздаёт карту, а подлетает к точке: зум и сдвиг остаются пользовательскими.
  useEffect(() => {
    if (!centered || status !== "ready") return;
    handleRef.current?.focus(originPoint);
  }, [centered, status, originPoint, handleRef]);

  const placedCity = useRef(false);
  useEffect(() => {
    if (!located.settled || status !== "ready" || placedCity.current) return;
    if (pin !== null || focusPlaceId !== null || focusPoint !== null) return;
    placedCity.current = true;
    handleRef.current?.focus(originPoint);
  }, [located.settled, status, originPoint, pin, focusPlaceId, focusPoint, handleRef]);

  const flown = useRef("");
  useEffect(() => {
    if (status !== "ready") return;
    if (pin !== null) {
      const key = `${pin.lat.toFixed(5)},${pin.lng.toFixed(5)}`;
      if (!flown.current.startsWith(key)) {
        flown.current = key;
        handleRef.current?.focus([pin.lat, pin.lng], 16);
      }
      if (!drawRoute || focusPlaceId === null || places.status !== "ready") return;
      if (flown.current === `${key}:route`) return;
      const pinned = places.places.find((item) => item.id === focusPlaceId);
      if (pinned === undefined) return;
      flown.current = `${key}:route`;
      routePicked.current = false;
      setRoutePlace(placeRouteStop(pinned));
      setRouteProfile(mapRouteProfileFor("event", travel));
      setRouteOn(true);
      return;
    }
    if (walkPath !== null && walkPath.length >= 2) return;
    if (focusPoint !== null) {
      const key = `walk:${focusPoint.lat.toFixed(5)},${focusPoint.lng.toFixed(5)}`;
      if (flown.current === key) return;
      flown.current = key;
      handleRef.current?.focus([focusPoint.lat, focusPoint.lng], 16);
      return;
    }
    if (focusPlaceId === null || places.status !== "ready") return;
    if (flown.current === focusPlaceId) return;
    const place = places.places.find((item) => item.id === focusPlaceId);
    if (place === undefined) return;
    flown.current = focusPlaceId;
    handleRef.current?.focus([place.latitude, place.longitude], 16);
    if (drawRoute) {
      routePicked.current = false;
      setRoutePlace(placeRouteStop(place));
      setRouteProfile(mapRouteProfileFor("event", travel));
      setRouteOn(true);
      return;
    }
    const marker = markers.find((item) => item.placeId === focusPlaceId && item.eventId === null);
    if (marker) setSelected(marker);
  }, [status, pin, focusPoint, focusPlaceId, places, markers, handleRef, drawRoute, walkPath, travel]);

  const framed = useRef("");
  useEffect(() => {
    if (status !== "ready" || walkPath === null || walkPath.length < 2) return;
    const key = walkPath.map((point) => `${point[0].toFixed(5)},${point[1].toFixed(5)}`).join(";");
    if (framed.current === key) return;
    framed.current = key;
    const line = walkPath.map((point) => [point[0], point[1]] as [number, number]);
    setRoutePath(line);
    handleRef.current?.frame(line);
    let alive = true;
    stitchWalkingRoute(line).then((path) => {
      if (alive) setRoutePath(path);
    });
    return () => {
      alive = false;
    };
  }, [status, walkPath, handleRef]);

  const weatherChange = weather === null ? null : formatMapChange(weather);
  const friendsLine = mapFriendsLine(friendVisits.find((visit) => visit.place.id === selectedPlaceId));
  const customPin = pin !== null && droppedPinCardVisible({ pin, placeId: focusPlaceId, dismissedKey: dismissedPinKey }) ? pin : null;
  const metroAsked = travel.some((option) => option.mode === "metro");
  const metroPlan = selectedPlace === undefined || !metroAsked ? null : planMetroRide({ lat: originPoint[0], lng: originPoint[1] }, { lat: selectedPlace.latitude, lng: selectedPlace.longitude });
  const shownTravel = travel.map((option) => (option.mode === "metro" && metroPlan !== null ? { ...option, transfers: metroPlan.transfers } : option));
  const notice = mapNotice({
    mapFailed: status === "error",
    tilesFailed,
    vectorFallback,
    loading: places.status === "loading" || eventsLoading,
    placesFailed: places.status === "error",
    eventsFailed,
    walkFailed,
    markerCount: markers.length,
    query,
    categoryLabel: category === undefined ? null : CATEGORY_LABELS[category],
    anyLayerOn: MAP_LAYERS.some((layer) => layers[layer]),
    geoDenied: located.state === "denied",
    inCity: located.settled && located.fromViewer,
    locateOn: centered,
  });

  function pickBasemap(next: MapBasemap): void {
    setBasemap(next);
    writeBasemapPreference(next.id);
    // Сообщения о мёртвых тайлах и о возврате к стандартной относились к прежней подложке: новая начинает с чистого листа
    setTilesFailed(false);
    setVectorFallback(false);
  }

  const walkSteps = showingWalk ? extraMarkers.filter((marker) => marker.badge !== undefined).sort((left, right) => (left.badge ?? 0) - (right.badge ?? 0)) : [];

  return (
    // Тёмная и своя подложки тёмные сами: модификатор обёртки снимает с тайлов инверсию тёмной схемы (theme.css)
    <div className={mapWrapClass(basemap)}>
      {/* Класс этого контейнера после инициализации меняться не должен: React перезаписал бы classList
          целиком, вместе с классами leaflet (.leaflet-container и его правило max-width для тайлов —
          без него тайлы схлопываются в нулевую ширину). Тон подложки поэтому висит на обёртке выше. */}
      <div ref={containerRef} className={`app-map${status === "error" ? " app-map--blank" : ""}`} aria-label="Карта событий и мест" />
      {selected === null && walkSteps.length > 0 ? (
        <ol className="app-map-walk" aria-label="Шаги прогулки">
          {walkSteps.map((step) => (
            <li key={step.key}>
              <button type="button" className="app-map-walk-step" onClick={() => handleRef.current?.focus([step.lat, step.lng], 16)}>
                <span className="app-map-walk-num">{step.badge}</span>
                <span className="app-map-walk-title">{step.title}</span>
              </button>
            </li>
          ))}
        </ol>
      ) : null}
      {status === "loading" && (
        <span className="app-map-skeleton" aria-live="polite">
          <span className="app-map-here-chip">{hereLabel}</span>
        </span>
      )}
      <div className="app-map16-top">
        <div className="app-map16-top-right">
          <button
            type="button"
            className="app-map16-weather"
            aria-label="Погода"
            onClick={() => {
              setWeatherOpen(true);
              setBasemapsOpen(false);
              setFiltersOpen(false);
              setSelected(null);
            }}
          >
            <ActionIcon name="weather" size={20} />
            <span className="app-map16-weather-value">{weather === null ? "—" : `${formatMapTemperature(weather)} · ${weather.condition}`}</span>
          </button>
        </div>
        <div className="app-map16-filter-slot">
          <button
            type="button"
            className={category === undefined ? "app-map16-filter" : "app-map16-filter app-map16-filter--on"}
            aria-label="Фильтры"
            aria-haspopup="dialog"
            aria-expanded={filtersOpen}
            onClick={() => {
              setFiltersOpen((open) => !open);
              setWeatherOpen(false);
              setBasemapsOpen(false);
            }}
          >
            <ActionIcon name="filter" size={18} />
            {category !== undefined && <span>{CATEGORY_LABELS[category]}</span>}
          </button>
          {filtersOpen && (
            <div className="app-map16-filter-pop" role="dialog" aria-label="Фильтры карты">
              <button
                type="button"
                className={category === undefined ? "app-map16-filter-opt app-map16-filter-opt--on" : "app-map16-filter-opt"}
                onClick={() => {
                  setCategory(undefined);
                  setFiltersOpen(false);
                }}
              >
                Все
              </button>
              {MAP_EVENT_CATEGORIES.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={category === value ? "app-map16-filter-opt app-map16-filter-opt--on" : "app-map16-filter-opt"}
                  onClick={() => {
                    setCategory(value);
                    setFiltersOpen(false);
                  }}
                >
                  {CATEGORY_LABELS[value]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="app-map16-zoom">
        <button type="button" className="app-map16-zoom-btn" aria-label="Приблизить" onClick={() => handleRef.current?.zoomBy(1)}>
          <ActionIcon name="plus" size={18} strokeWidth={2} />
        </button>
        <button type="button" className="app-map16-zoom-btn" aria-label="Отдалить" onClick={() => handleRef.current?.zoomBy(-1)}>
          <ActionIcon name="minus" size={18} strokeWidth={2} />
        </button>
      </div>
      {notice !== null && (
        <p className="app-map16-notice" role="status">
          {notice}
        </p>
      )}
      {/* Тайлы требуют указания источника; собственная строка вместо контрола leaflet — чтобы она жила по сетке экрана
          и менялась вместе с подложкой. На запасном полотне тайлов нет, и ссылаться там не на что: подпись снимается с подложкой. */}
      {status !== "error" && <span className="app-map16-credit">{basemapCredit(basemap)}</span>}
      {selected !== null && !weatherOpen && !routeOn && (
        <MapSelectionCard
          title={selected.title}
          subtitle={selected.subtitle}
          category={selectedCategory}
          photoId={selected.eventId ?? selected.placeId}
          friendsLine={friendsLine}
          travel={shownTravel}
          metroSteps={metroPlan?.steps ?? null}
          metroFar={selectedPlace !== undefined && metroAsked && metroPlan === null}
          rainHint={mapRainHint(weather, shownTravel)}
          onRoute={() => {
            if (selectedPlace === undefined) return;
            routePicked.current = false;
            setRouteProfile(mapRouteProfileFor(intentForStopKind("place"), shownTravel));
            setRoutePlace(placeRouteStop(selectedPlace));
            setRouteOn(true);
            setSelected(null);
            setWeatherOpen(false);
            setBasemapsOpen(false);
            setFiltersOpen(false);
          }}
          onOpen={() => (selected.eventId !== null ? onOpenEvent(selected.eventId) : selected.placeId !== null ? onOpenPlace(selected.placeId) : undefined)}
          onClose={() => setSelected(null)}
        />
      )}
      {customPin !== null && selected === null && !weatherOpen && !routeOn && (
        <MapSelectionCard
          title={DROPPED_PIN_TITLE}
          subtitle={pinLabel(customPin.lat, customPin.lng)}
          category={null}
          friendsLine={null}
          travel={[]}
          metroSteps={null}
          metroFar={false}
          rainHint={null}
          onRoute={() => {
            routePicked.current = true;
            setRouteProfile("foot");
            setRoutePlace(droppedPinStop(customPin));
            setRouteOn(true);
            setDismissedPinKey(droppedPinKey(customPin));
            setSelected(null);
            setWeatherOpen(false);
            setBasemapsOpen(false);
            setFiltersOpen(false);
          }}
          onClose={() => setDismissedPinKey(droppedPinKey(customPin))}
        />
      )}
      {routeOn && routePlace !== null && selected === null && !weatherOpen && (
        <div className="app-map16-routebar">
          <div className="app-map16-routebar-row">
            <span>{routeBarLabel(routePlace)}</span>
            <button
              type="button"
              className="app-map16-routebar-hide"
              onClick={() => {
                setRouteOn(false);
                setRoutePlace(null);
                setDrawnRoute(null);
              }}
            >
              Скрыть
            </button>
          </div>
          {drawnRoute !== null && (
            <div className="app-map16-route-summary" aria-label="Маршрут">
              <span className="app-map16-route-glyphs">
                {routeGlyphs(drawnRoute.profile).map((name) => (
                  <ActionIcon key={name} name={name} size={18} />
                ))}
              </span>
              <span>{formatDrawnRoute(drawnRoute.minutes)}</span>
            </div>
          )}
        </div>
      )}
      {weatherOpen && (
        <section className="app-map16-weather-sheet" role="dialog" aria-label="Прогноз погоды">
          <div className="app-map16-weather-head">
            <h2 className="app-map16-card-title">Погода сейчас</h2>
            <button type="button" className="app-map16-weather-x" aria-label="Закрыть" onClick={() => setWeatherOpen(false)}>
              <ActionIcon name="close" size={16} strokeWidth={2.6} />
            </button>
          </div>
          {weather === null ? (
            <p className="app-map16-weather-now">Прогноз пока недоступен</p>
          ) : (
            <>
              <p className="app-map16-weather-now">
                {(() => {
                  const picked = hourly?.hours.find((hour) => hour.at === weatherHourAt) ?? hourly?.hours[0];
                  if (picked === undefined) return `${formatMapTemperature(weather)} · ${weather.condition}`;
                  const rounded = Math.round(picked.temperatureC);
                  return `${rounded > 0 ? "+" : ""}${rounded}° · ${formatMapHour(picked.at)}`;
                })()}
              </p>
              {weatherChange !== null && weatherHourAt === null && <p className="app-map16-weather-next">Ожидается: {weatherChange}</p>}
            </>
          )}
          {hourly !== null && hourly.hours.length > 0 && (
            <ol className="app-map16-weather-strip" aria-label="Прогноз на ближайшие часы">
              {hourly.hours.map((hour) => (
                <MapHourColumn key={hour.at} hour={hour} selected={(weatherHourAt ?? hourly.hours[0]?.at) === hour.at} onSelect={() => setWeatherHourAt(hour.at)} />
              ))}
            </ol>
          )}
          {hourly?.note != null && hourly.note !== "" && <p className="app-map16-weather-next">{hourly.note}</p>}
          {hourly !== null && <p className="app-map16-weather-source">{hourly.source}</p>}
        </section>
      )}
      {!weatherOpen && (
        <div className="app-map16-dock">
          {basemapsOpen && !weatherOpen && (
            <div className="app-map16-basemap-strip" role="listbox" aria-label="Подложка карты">
              {MAP_BASEMAPS.filter((item) => (MAP_CHOICES as readonly string[]).includes(item.id)).map((item) => {
                const shot = basemapShot(item);
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={basemap.id === item.id}
                    className={basemap.id === item.id ? "app-map16-basemap-pick app-map16-basemap-pick--on" : "app-map16-basemap-pick"}
                    onClick={() => {
                      pickBasemap(item);
                      setBasemapsOpen(false);
                    }}
                  >
                    {shot !== null ? <img className="app-map16-basemap-shot" alt="" src={shot} /> : <span className="app-map16-basemap-shot app-map16-basemap-shot--own" aria-hidden="true" />}
                    <span className="app-map16-basemap-label">{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
          <form className="app-map16-search" role="search" onSubmit={(event) => event.preventDefault()}>
            <ActionIcon name="search" size={18} />
            <input className="app-map16-search-input" type="search" aria-label="Поиск" placeholder="Поиск" value={query} onChange={(typed) => setQuery(typed.target.value)} />
            <button
              type="button"
              className={basemapsOpen ? "app-map16-locate app-map16-locate--on" : "app-map16-locate"}
              aria-expanded={basemapsOpen}
              aria-pressed={basemapsOpen}
              aria-label="Карта"
              onClick={() => {
                setBasemapsOpen((open) => !open);
                setWeatherOpen(false);
                setFiltersOpen(false);
              }}
            >
              <ActionIcon name="layers" size={18} />
            </button>
            <button
              type="button"
              className={layers.friends ? "app-map16-locate app-map16-locate--on" : "app-map16-locate"}
              aria-label="Друзья на карте"
              aria-pressed={layers.friends}
              onClick={() => {
                if (!layers.friends) setFriendsAsked(true);
                setLayers((current) => ({ ...current, friends: !current.friends }));
              }}
            >
              <ActionIcon name="users" size={18} />
            </button>
            <button type="button" className="app-map16-locate" aria-label="Показать, где я" aria-pressed={centered} onClick={() => setCentered((on) => !on)}>
              <ActionIcon name="locate" size={18} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
