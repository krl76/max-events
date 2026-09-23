// START_MODULE_CONTRACT
// PURPOSE: Экран 16 «Карта»: the Leaflet map with OSM tiles, event/place/friend pins, the «Вы здесь» marker, the weather chip, the layer chips, the card of the selected object with its travel times and the route it draws.
// SCOPE: Places fetched via apiClient.listPlaces and the friend layer via apiClient.listFriendPlaces (a failure leaves the layer empty instead of breaking the map); the weather and the travel estimates come from apiClient.getMapWeather / getTravelOptions, both mock-backed (#495, #504). Leaflet is loaded lazily (dynamic import) so it stays out of the main bundle; the map is disposed on unmount or data change.
// DEPENDS: leaflet (dynamic import + css), ../api/client.js (apiClient, MapWeather, TravelOption), ./mapMarkers.js (buildMapMarkers, MapMarker), ./useLeafletMap.js, ../geo/viewer-origin.js, ../ui/icons.js, ../ui/primitives.js
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
// - formatMapTemperature - «+19°», with the sign the chip prints
// - formatMapChange - «дождь в 19:00»; null when nothing is expected (#495)
// - mapRainHint - «Дождь с 19:00 — метро суше, зонт не понадобится»; null without rain or without a metro option
// - formatTravelOption - one travel tile: the big «18 мин» and the «пешком · 1,4 км» under it (#504)
// - mapFriendsLine - «Анна была здесь», «Анна и Дима были здесь»; null when no friend has
// - initEventMap - create Leaflet map + OSM tile layer without the attribution bar + markers with popup mini-cards (promoted events get the highlighted pin and the «Промо» chip, #205; the friends layer gets its own tile pin and a «Были: …» subtitle, #472), the optional «Вы здесь» marker and the optional route line; returns a dispose function
// - MapSelectionCard - the card of the selected object: friends, title, the two travel tiles, the rain hint and «Построить маршрут»
// - MapScreen - экран 16: pins, layers, weather, selection, route and the map search over the Leaflet lifecycle via useLeafletMap
// END_MODULE_MAP

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Event, FriendPlaceVisit, Place } from "@max-events/api-contracts";
import "leaflet/dist/leaflet.css";
import { apiClient, type MapWeather, type TravelOption } from "../api/client";
import { pluralRu } from "./format";
import { useViewerOrigin } from "../geo/viewer-origin";
import { ActionIcon } from "../ui/icons";
import { AppChip, AppState } from "../ui/primitives";
import { buildMapMarkers, type MapMarker } from "./mapMarkers";
import { useLeafletMap } from "./useLeafletMap";

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

const MAP_LAYER_LABELS: Record<MapLayer, string> = { friends: "Друзья", events: "События", places: "Места" };

/** «+19°» — the chip always carries the sign, so a zero reads as measured rather than missing. */
export function formatMapTemperature(weather: MapWeather): string {
  const rounded = Math.round(weather.temperatureC);
  return `${rounded > 0 ? "+" : ""}${rounded}°`;
}

/** «дождь в 19:00»; null when the forecast expects no change (#495). */
export function formatMapChange(weather: MapWeather): string | null {
  if (weather.changesAt === null || weather.changesTo === null) return null;
  return `${weather.changesTo} в ${new Date(weather.changesAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
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

/** «18 мин» over «пешком · 1,4 км»: the number carries the decision, the line under it the reason (#504). */
export function formatTravelOption(option: TravelOption): { value: string; note: string } {
  const parts = [option.mode === "walk" ? "пешком" : "метро"];
  if (option.mode === "walk" && option.distanceKm !== null) parts.push(`${option.distanceKm.toLocaleString("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} км`);
  if (option.mode === "metro" && option.transfers !== null) parts.push(option.transfers === 0 ? "без пересадок" : `${option.transfers} ${pluralRu(option.transfers, "пересадка", "пересадки", "пересадок")}`);
  return { value: `${option.minutes} мин`, note: parts.join(" · ") };
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

/** The friend pin of the design is a tile with the friend initial and a short label, not a dot (макет, экран 16). */
function friendPinHtml(marker: MapMarker): string {
  const initial = escapeHtml(marker.subtitle.replace(/^Были:\s*/, "").charAt(0));
  return `<span class="app-map-pin-tile"><span class="app-map-pin-face">${initial}</span><span class="app-map-pin-label">${escapeHtml(marker.title)}</span></span>`;
}

interface InitMapInput {
  events: Event[];
  places: Place[];
  friendVisits?: FriendPlaceVisit[];
  onOpenEvent: (id: string) => void;
  onOpenPlace: (id: string) => void;
  /** Selecting a pin raises the card of экран 16; without a handler the popup is the whole interaction. */
  onSelect?: (marker: MapMarker) => void;
  center?: [number, number];
  /** Where the viewer stands: draws the «Вы здесь» marker and anchors the route. */
  origin?: [number, number] | null;
  /** Straight line from the origin to the selected object; the routing domain answers no geometry yet (#504). */
  route?: [number, number] | null;
}

export async function initEventMap(container: HTMLElement, input: InitMapInput): Promise<() => void> {
  const L = await import("leaflet");
  const map = L.map(container, { center: input.center ?? MOSCOW_CENTER, zoom: MOSCOW_ZOOM, attributionControl: false });
  L.tileLayer(OSM_TILE_URL, { maxZoom: 19 }).addTo(map);
  for (const marker of buildMapMarkers(input.events, input.places, input.friendVisits ?? [])) {
    const icon = marker.friends ? L.divIcon({ className: "app-map-pin app-map-pin--friends", iconSize: [78, 78], html: friendPinHtml(marker) }) : L.divIcon({ className: `app-map-pin${marker.promoted ? " app-map-pin--promo" : ""}`, iconSize: [18, 18] });
    const placed = L.marker([marker.lat, marker.lng], { icon })
      .addTo(map)
      .bindPopup(popupNode(marker, input.onOpenEvent, input.onOpenPlace));
    if (input.onSelect !== undefined) placed.on("click", () => input.onSelect?.(marker));
  }
  if (input.origin) {
    L.marker(input.origin, { icon: L.divIcon({ className: "app-map-pin app-map-pin--me", iconSize: [22, 22], html: '<span class="app-map-me-label">Вы здесь</span>' }) }).addTo(map);
    // The line is the honest shape of what we know: a distance, not a turn-by-turn route (#504).
    if (input.route) L.polyline([input.origin, input.route], { className: "app-map-route", weight: 5 }).addTo(map);
  }
  return () => map.remove();
}

const EMPTY_VISITS: FriendPlaceVisit[] = [];

type PlacesState = { status: "loading" } | { status: "error" } | { status: "ready"; places: Place[] };

interface MapSelectionCardProps {
  title: string;
  subtitle: string;
  category: Event["category"] | null;
  friendsLine: string | null;
  travel: TravelOption[];
  rainHint: string | null;
  routeOn: boolean;
  onRoute: () => void;
  /** Без обработчика кнопка не рисуется: мёртвая кнопка читается как сломанный экран. */
  onDiscuss?: () => void;
  onOpen: () => void;
  onClose: () => void;
}

export function MapSelectionCard(props: MapSelectionCardProps) {
  return (
    <section className="app-map16-card" aria-label="Выбранный объект">
      <button type="button" className="app-map16-card-close" aria-label="Закрыть карточку" onClick={props.onClose}>
        <ActionIcon name="close" size={16} strokeWidth={2} />
      </button>
      <button type="button" className="app-map16-card-head" onClick={props.onOpen}>
        <span className={props.category === null ? "app-map16-card-media" : `app-map16-card-media app-media--${props.category}`} aria-hidden="true" />
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
      </button>
      {props.travel.length > 0 && (
        <div className="app-map16-travel">
          {props.travel.map((option) => {
            const { value, note } = formatTravelOption(option);
            return (
              <span key={option.mode} className="app-map16-travel-item">
                <ActionIcon name={option.mode === "walk" ? "navigation" : "metro"} size={18} />
                <span className="app-map16-travel-text">
                  <span className="app-map16-travel-value">{value}</span>
                  <span className="app-map16-travel-note">{note}</span>
                </span>
              </span>
            );
          })}
        </div>
      )}
      {props.rainHint !== null && (
        <p className="app-map16-rain">
          <ActionIcon name="rain" size={18} />
          {props.rainHint}
        </p>
      )}
      <div className="app-map16-card-actions">
        <button type="button" className="app-map16-route" aria-pressed={props.routeOn} onClick={props.onRoute}>
          <ActionIcon name="navigation" size={18} />
          Построить маршрут
        </button>
        {props.onDiscuss !== undefined && (
          <button type="button" className="app-map16-discuss" aria-label="Обсудить с друзьями" onClick={props.onDiscuss}>
            <ActionIcon name="comment" size={20} />
          </button>
        )}
      </div>
    </section>
  );
}

interface MapScreenProps {
  events: Event[];
  onOpenEvent: (id: string) => void;
  onOpenPlace: (id: string) => void;
  /** Экран 16 draws its own chrome; without these it stays the plain catalog map view. */
  onBack?: () => void;
  onDiscuss?: () => void;
  city?: string;
}

export function MapScreen({ events, onOpenEvent, onOpenPlace, onBack, onDiscuss, city = "Москва" }: MapScreenProps) {
  const origin = useViewerOrigin();
  const [places, setPlaces] = useState<PlacesState>({ status: "loading" });
  const [friendVisits, setFriendVisits] = useState<FriendPlaceVisit[]>([]);
  const [layers, setLayers] = useState<Record<MapLayer, boolean>>({ friends: true, events: true, places: true });
  const [layersOpen, setLayersOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<MapMarker | null>(null);
  const [routeOn, setRouteOn] = useState(false);
  const [centered, setCentered] = useState(false);
  const [weather, setWeather] = useState<MapWeather | null>(null);
  const [travel, setTravel] = useState<TravelOption[]>([]);

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

  // The layer chip counts the friends, so the visits load with the map rather than with the toggle.
  useEffect(() => {
    let alive = true;
    apiClient.listFriendPlaces().then(
      (visits) => {
        if (alive) setFriendVisits(visits);
      },
      // The layer is an extra, not the map: a failed load leaves it empty rather than taking the screen down.
      () => {},
    );
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    apiClient.getMapWeather(city).then(
      (loaded) => {
        if (alive) setWeather(loaded);
      },
      // The chip is decoration on a working map; a failed forecast simply does not show up.
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [city]);

  const readyPlaces = places.status === "ready" ? places.places : [];
  const needle = query.trim().toLowerCase();
  const shownEvents = useMemo(() => (layers.events ? events.filter((item) => needle === "" || item.title.toLowerCase().includes(needle)) : []), [events, layers.events, needle]);
  const shownPlaces = useMemo(() => (layers.places ? readyPlaces.filter((item) => needle === "" || item.title.toLowerCase().includes(needle)) : []), [readyPlaces, layers.places, needle]);
  // A fresh [] on every render would land in the map's dependency list and rebuild Leaflet each time.
  const visits = useMemo(() => (layers.friends ? friendVisits : EMPTY_VISITS), [layers.friends, friendVisits]);

  const selectedPlaceId = selected === null ? null : (selected.placeId ?? events.find((item) => item.id === selected.eventId)?.placeId ?? null);
  const selectedPlace = selectedPlaceId === null ? undefined : readyPlaces.find((item) => item.id === selectedPlaceId);
  const selectedCategory = selected === null || selected.eventId === null ? null : (events.find((item) => item.id === selected.eventId)?.category ?? null);

  useEffect(() => {
    if (selectedPlaceId === null) {
      setTravel([]);
      return;
    }
    let alive = true;
    apiClient.getTravelOptions(selectedPlaceId, { latitude: origin.latitude, longitude: origin.longitude }).then(
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
  }, [selectedPlaceId, origin.latitude, origin.longitude]);

  const originPoint = useMemo<[number, number]>(() => [origin.latitude, origin.longitude], [origin.latitude, origin.longitude]);
  const routePoint = useMemo<[number, number] | null>(() => (routeOn && selectedPlace !== undefined ? [selectedPlace.latitude, selectedPlace.longitude] : null), [routeOn, selectedPlace]);
  const center = centered ? originPoint : MOSCOW_CENTER;
  const select = useCallback((marker: MapMarker) => {
    setSelected(marker);
    setRouteOn(false);
  }, []);

  const containerRef = useLeafletMap(places.status === "ready", (container) => initEventMap(container, { events: shownEvents, places: shownPlaces, friendVisits: visits, onOpenEvent, onOpenPlace, onSelect: select, origin: originPoint, route: routePoint, center }), [shownEvents, shownPlaces, visits, onOpenEvent, onOpenPlace, select, originPoint, routePoint, center]);

  if (places.status === "loading") return <AppState>Загружаем карту…</AppState>;
  if (places.status === "error") return <AppState error>Не удалось загрузить места для карты.</AppState>;

  const weatherChange = weather === null ? null : formatMapChange(weather);
  const friendsLine = mapFriendsLine(friendVisits.find((visit) => visit.place.id === selectedPlaceId));
  return (
    <div className="app-map-wrap app-map16">
      <div ref={containerRef} className="app-map" aria-label="Карта событий и мест" />
      <div className="app-map16-top">
        {onBack !== undefined && (
          <button type="button" className="app-map16-back" onClick={onBack}>
            <span className="app-map16-back-caret" aria-hidden="true">
              <ActionIcon name="chevron" size={18} strokeWidth={2} />
            </span>
            Поиск
          </button>
        )}
        <div className="app-map16-top-right">
          {weather !== null && (
            <span className="app-map16-weather">
              <ActionIcon name="weather" size={20} />
              <span className="app-map16-weather-value">{formatMapTemperature(weather)}</span>
              {weatherChange !== null && <span className="app-map16-weather-note">{weatherChange}</span>}
            </span>
          )}
          <button type="button" className="app-map16-round" aria-label="Слои карты" aria-expanded={layersOpen} onClick={() => setLayersOpen((open) => !open)}>
            <ActionIcon name="layers" size={20} />
          </button>
        </div>
      </div>
      {layersOpen && (
        <div className="app-map16-layers" role="group" aria-label="Слои карты">
          {MAP_LAYERS.map((layer) => (
            <AppChip key={layer} pressed={layers[layer]} className="app-map16-layer" onClick={() => setLayers((current) => ({ ...current, [layer]: !current[layer] }))}>
              {layer === "friends" && friendVisits.length > 0 ? `${MAP_LAYER_LABELS[layer]} · ${friendVisits.length}` : MAP_LAYER_LABELS[layer]}
            </AppChip>
          ))}
        </div>
      )}
      {selected !== null && <MapSelectionCard title={selected.title} subtitle={selected.subtitle} category={selectedCategory} friendsLine={friendsLine} travel={travel} rainHint={mapRainHint(weather, travel)} routeOn={routeOn} onRoute={() => setRouteOn((on) => !on)} onDiscuss={onDiscuss} onOpen={() => (selected.eventId !== null ? onOpenEvent(selected.eventId) : selected.placeId !== null ? onOpenPlace(selected.placeId) : undefined)} onClose={() => setSelected(null)} />}
      <form className="app-map16-search" role="search" onSubmit={(event) => event.preventDefault()}>
        <ActionIcon name="search" size={18} />
        <input className="app-map16-search-input" type="search" aria-label="Искать на карте" placeholder={`${city} · искать на карте`} value={query} onChange={(typed) => setQuery(typed.target.value)} />
        <button type="button" className="app-map16-locate" aria-label="Показать, где я" aria-pressed={centered} onClick={() => setCentered((on) => !on)}>
          <ActionIcon name="locate" size={18} />
        </button>
      </form>
    </div>
  );
}
