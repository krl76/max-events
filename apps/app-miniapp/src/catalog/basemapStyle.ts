// START_MODULE_CONTRACT
// PURPOSE: Стиль MapLibre для собственной векторной подложки (схема OpenMapTiles): один источник PMTiles рядом с приложением, слои заливок, дорог, границ и подписей в палитре брендбука, светлый и тёмный вариант с одинаковым набором слоёв.
// SCOPE: Чистая функция от подложки, схемы и origin к объекту стиля; ни сети, ни DOM. Цвета здесь буквальные hex, потому что MapLibre рисует на WebGL и CSS-переменных не читает: светлая палитра построена от brand-white с фиолетовыми оттенками дорог, тёмная — от brand-void; акценты (метро) — brand-blue в светлой и brand-cyan в тёмной, как --app-accent-text в theme.css. Что рисуется и где лежит архив — ./basemaps.ts; кто поднимает слой — ./vectorBasemap.ts.
// DEPENDS: maplibre-gl (только типы), ./basemaps.js (VectorBasemap), ../ui/theme.js (ThemeScheme)
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - OMT_SOURCE - имя единственного векторного источника в стиле
// - OMT_SOURCE_LAYERS - слои схемы OpenMapTiles, из которых стиль берёт геометрию (проверка тестом: другие в архиве не лежат)
// - BASEMAP_FONTS - три начертания Noto Sans, которые лежат в /tiles/fonts (regular для улиц и мест, medium для городов и метро, italic для воды)
// - BasemapPalette - все цвета одного варианта стиля по ролям: бумага, заливки земли, вода, здания, дороги по классам, границы, подписи, акцент
// - basemapPalette - палитра варианта: светлая от brand-white, тёмная от brand-void; один объект на схему
// - buildOwnBasemapStyle - собрать StyleSpecification: источник pmtiles://<origin><tiles>, глифы <origin><glyphs>, стек слоёв от фона до номеров домов
// END_MODULE_MAP

import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from "maplibre-gl";
import type { ThemeScheme } from "../ui/theme";
import type { VectorBasemap } from "./basemaps";

export const OMT_SOURCE = "omt";

export const OMT_SOURCE_LAYERS: readonly string[] = ["landcover", "landuse", "park", "water", "waterway", "aeroway", "boundary", "building", "transportation", "transportation_name", "water_name", "place", "poi", "housenumber"];

export const BASEMAP_FONTS = { regular: "Noto Sans Regular", medium: "Noto Sans Medium", italic: "Noto Sans Italic" } as const;

export interface BasemapPalette {
  background: string;
  grass: string;
  wood: string;
  farmland: string;
  sand: string;
  residential: string;
  commercial: string;
  industrial: string;
  institution: string;
  cemetery: string;
  park: string;
  pitch: string;
  water: string;
  waterLine: string;
  building: string;
  buildingOutline: string;
  aeroway: string;
  motorway: string;
  motorwayCasing: string;
  major: string;
  majorCasing: string;
  secondary: string;
  secondaryCasing: string;
  minor: string;
  minorCasing: string;
  service: string;
  path: string;
  rail: string;
  transit: string;
  tunnel: string;
  boundary: string;
  text: string;
  textHalo: string;
  textWater: string;
  textRoad: string;
  textPoi: string;
  accent: string;
  accentContrast: string;
}

/** Светлая: brand-white как бумага, дороги в фиолетовых оттенках brand-violet, акцент brand-blue. */
const LIGHT: BasemapPalette = {
  background: "#f6f4fa",
  grass: "#e7efe2",
  wood: "#d8e6d1",
  farmland: "#edefe1",
  sand: "#f2eedf",
  residential: "#eeecf4",
  commercial: "#f1ecf3",
  industrial: "#e8e7ee",
  institution: "#ece7f2",
  cemetery: "#dfe8db",
  park: "#d8e8d2",
  pitch: "#d5e8d8",
  water: "#c5d8f5",
  waterLine: "#b2c9ee",
  building: "#e5e1ec",
  buildingOutline: "#d7d1e2",
  aeroway: "#e5e1ec",
  motorway: "#cdbfff",
  motorwayCasing: "#a893f5",
  major: "#e4dcff",
  majorCasing: "#c3b5f2",
  secondary: "#ffffff",
  secondaryCasing: "#d3ccdf",
  minor: "#ffffff",
  minorCasing: "#dcd6e6",
  service: "#ffffff",
  path: "#b8afc9",
  rail: "#c3bbd3",
  transit: "#471aff",
  tunnel: "#f1eef6",
  boundary: "#a58fe0",
  text: "#2b1d45",
  textHalo: "#ffffff",
  textWater: "#4d6fae",
  textRoad: "#5a4d75",
  textPoi: "#6b5d87",
  accent: "#471aff",
  accentContrast: "#ffffff",
};

/** Тёмная: brand-void как бумага, дороги светлеют к фиолетовому, акцент brand-cyan — как --app-accent-text. */
const DARK: BasemapPalette = {
  background: "#0d001a",
  grass: "#111a14",
  wood: "#0f1912",
  farmland: "#12111c",
  sand: "#181422",
  residential: "#150a25",
  commercial: "#170c28",
  industrial: "#120a1e",
  institution: "#160d27",
  cemetery: "#101a14",
  park: "#0f1c16",
  pitch: "#0f1c18",
  water: "#0e1a3d",
  waterLine: "#16295a",
  building: "#1a0f2e",
  buildingOutline: "#24153f",
  aeroway: "#1c1433",
  motorway: "#5b35c9",
  motorwayCasing: "#3b2380",
  major: "#4a3a8f",
  majorCasing: "#2f2460",
  secondary: "#3a2f6b",
  secondaryCasing: "#241c48",
  minor: "#2f2758",
  minorCasing: "#1f1840",
  service: "#261f48",
  path: "#3d3468",
  rail: "#3a3160",
  transit: "#00bfff",
  tunnel: "#1c1433",
  boundary: "#7a55d6",
  text: "#ece6f7",
  textHalo: "#0d001a",
  textWater: "#7fa3e6",
  textRoad: "#cfc6e6",
  textPoi: "#bfb3dc",
  accent: "#00bfff",
  accentContrast: "#0d001a",
};

export function basemapPalette(scheme: ThemeScheme): BasemapPalette {
  return scheme === "dark" ? DARK : LIGHT;
}

/** Имя по-русски, если у объекта есть отдельный тег, иначе основное имя — в Москве оно и так русское. */
const NAME: ExpressionSpecification = ["coalesce", ["get", "name:ru"], ["get", "name"]];

const NOT_TUNNEL: ExpressionSpecification = ["!=", ["get", "brunnel"], "tunnel"];

function classIn(...classes: string[]): ExpressionSpecification {
  return ["in", ["get", "class"], ["literal", classes]];
}

/** Ширина линии, растущая с зумом как у дорог: в полтора раза на каждый шаг. */
function widthByZoom(stops: readonly (readonly [number, number])[]): ExpressionSpecification {
  return ["interpolate", ["exponential", 1.5], ["zoom"], ...stops.flatMap(([zoom, width]) => [zoom, width])];
}

function roadPair(id: string, palette: BasemapPalette, filter: ExpressionSpecification, minzoom: number, casing: string, fill: string, stops: readonly (readonly [number, number])[], casingExtra = 2): LayerSpecification[] {
  const base = { source: OMT_SOURCE, "source-layer": "transportation", minzoom, filter: ["all", filter, NOT_TUNNEL] as ExpressionSpecification, layout: { "line-cap": "round", "line-join": "round" } } as const;
  return [
    { id: `${id}-casing`, type: "line", ...base, paint: { "line-color": casing, "line-width": widthByZoom(stops.map(([zoom, width]) => [zoom, width + casingExtra] as const)) } },
    { id, type: "line", ...base, paint: { "line-color": fill, "line-width": widthByZoom(stops) } },
  ];
}

function layers(palette: BasemapPalette): LayerSpecification[] {
  const fill = (id: string, sourceLayer: string, paint: Record<string, unknown>, extra: Record<string, unknown> = {}): LayerSpecification => ({ id, type: "fill", source: OMT_SOURCE, "source-layer": sourceLayer, ...extra, paint }) as LayerSpecification;
  const labelFont = (font: string) => [font];
  return [
    { id: "background", type: "background", paint: { "background-color": palette.background } },
    fill("landcover", "landcover", {
      "fill-color": ["match", ["get", "class"], "wood", palette.wood, "farmland", palette.farmland, "sand", palette.sand, palette.grass],
      "fill-opacity": ["interpolate", ["linear"], ["zoom"], 6, 0.5, 12, 0.9],
      "fill-antialias": false,
    }),
    fill(
      "landuse",
      "landuse",
      {
        "fill-color": ["match", ["get", "class"], ["commercial", "retail"], palette.commercial, ["industrial", "garages", "railway", "quarry"], palette.industrial, ["school", "university", "college", "hospital", "kindergarten"], palette.institution, "cemetery", palette.cemetery, ["stadium", "pitch", "playground", "track"], palette.pitch, palette.residential],
        "fill-antialias": false,
      },
      { minzoom: 9 },
    ),
    fill("park", "park", { "fill-color": palette.park, "fill-opacity": ["interpolate", ["linear"], ["zoom"], 8, 0.5, 13, 0.9] }, { minzoom: 7 }),
    fill("water", "water", { "fill-color": palette.water }, { filter: NOT_TUNNEL }),
    {
      id: "waterway",
      type: "line",
      source: OMT_SOURCE,
      "source-layer": "waterway",
      minzoom: 9,
      filter: ["all", NOT_TUNNEL, classIn("river", "canal", "stream")],
      layout: { "line-cap": "round" },
      paint: {
        "line-color": palette.waterLine,
        "line-width": widthByZoom([
          [9, 0.5],
          [14, 2],
          [18, 6],
        ]),
      },
    },
    {
      id: "aeroway",
      type: "line",
      source: OMT_SOURCE,
      "source-layer": "aeroway",
      minzoom: 11,
      filter: classIn("runway", "taxiway"),
      // Одна зум-интерполяция на выражение (правило спецификации): класс выбирается внутри её остановок, а не снаружи
      paint: {
        "line-color": palette.aeroway,
        "line-width": ["interpolate", ["exponential", 1.5], ["zoom"], 11, ["match", ["get", "class"], "runway", 3, 1], 16, ["match", ["get", "class"], "runway", 40, 12]],
      },
    },
    fill("building", "building", { "fill-color": palette.building, "fill-outline-color": palette.buildingOutline, "fill-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0.6, 15, 1] }, { minzoom: 13 }),
    {
      id: "road-tunnel",
      type: "line",
      source: OMT_SOURCE,
      "source-layer": "transportation",
      minzoom: 12,
      filter: ["all", ["==", ["get", "brunnel"], "tunnel"], classIn("motorway", "trunk", "primary", "secondary", "tertiary", "minor", "service")],
      layout: { "line-cap": "butt", "line-join": "round" },
      paint: {
        "line-color": palette.tunnel,
        "line-width": widthByZoom([
          [12, 1],
          [14, 2.5],
          [18, 12],
        ]),
        "line-dasharray": [2, 1],
      },
    },
    {
      id: "road-path",
      type: "line",
      source: OMT_SOURCE,
      "source-layer": "transportation",
      minzoom: 14,
      filter: ["all", NOT_TUNNEL, classIn("path", "track")],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": palette.path,
        "line-width": widthByZoom([
          [14, 0.6],
          [18, 2.4],
        ]),
        "line-dasharray": [1, 1.5],
      },
    },
    {
      id: "road-service",
      type: "line",
      source: OMT_SOURCE,
      "source-layer": "transportation",
      minzoom: 14,
      filter: ["all", NOT_TUNNEL, classIn("service")],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": palette.service,
        "line-width": widthByZoom([
          [14, 0.8],
          [18, 6],
        ]),
      },
    },
    ...roadPair("road-minor", palette, classIn("minor"), 12, palette.minorCasing, palette.minor, [
      [12, 0.5],
      [14, 1.6],
      [18, 12],
    ]),
    ...roadPair("road-secondary", palette, classIn("secondary", "tertiary"), 10, palette.secondaryCasing, palette.secondary, [
      [10, 0.6],
      [14, 2.4],
      [18, 16],
    ]),
    ...roadPair("road-major", palette, classIn("trunk", "primary"), 7, palette.majorCasing, palette.major, [
      [7, 0.5],
      [10, 1.2],
      [14, 3.2],
      [18, 20],
    ]),
    ...roadPair("road-motorway", palette, classIn("motorway"), 5, palette.motorwayCasing, palette.motorway, [
      [5, 0.5],
      [10, 1.6],
      [14, 4],
      [18, 24],
    ]),
    {
      id: "rail",
      type: "line",
      source: OMT_SOURCE,
      "source-layer": "transportation",
      minzoom: 11,
      filter: ["all", NOT_TUNNEL, classIn("rail")],
      paint: {
        "line-color": palette.rail,
        "line-width": widthByZoom([
          [11, 0.6],
          [14, 1.2],
          [18, 3],
        ]),
      },
    },
    {
      id: "transit",
      type: "line",
      source: OMT_SOURCE,
      "source-layer": "transportation",
      minzoom: 12,
      filter: ["all", classIn("transit"), ["==", ["get", "subclass"], "subway"]],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": palette.transit,
        "line-width": widthByZoom([
          [12, 1],
          [16, 3],
        ]),
        "line-opacity": 0.3,
        "line-dasharray": [3, 2],
      },
    },
    {
      id: "boundary",
      type: "line",
      source: OMT_SOURCE,
      "source-layer": "boundary",
      filter: ["all", ["<=", ["get", "admin_level"], 4], ["!=", ["get", "maritime"], 1]],
      paint: { "line-color": palette.boundary, "line-width": ["match", ["get", "admin_level"], 2, 1.6, 1], "line-dasharray": [4, 3], "line-opacity": 0.8 },
    },
    {
      id: "road-label",
      type: "symbol",
      source: OMT_SOURCE,
      "source-layer": "transportation_name",
      minzoom: 13,
      filter: classIn("motorway", "trunk", "primary", "secondary", "tertiary"),
      layout: { "symbol-placement": "line", "text-field": NAME, "text-font": labelFont(BASEMAP_FONTS.regular), "text-size": ["interpolate", ["linear"], ["zoom"], 13, 10, 18, 14], "text-letter-spacing": 0.02 },
      paint: { "text-color": palette.textRoad, "text-halo-color": palette.textHalo, "text-halo-width": 1.2 },
    },
    {
      id: "road-label-minor",
      type: "symbol",
      source: OMT_SOURCE,
      "source-layer": "transportation_name",
      minzoom: 15,
      filter: classIn("minor", "service", "path"),
      layout: { "symbol-placement": "line", "text-field": NAME, "text-font": labelFont(BASEMAP_FONTS.regular), "text-size": ["interpolate", ["linear"], ["zoom"], 15, 10, 18, 13] },
      paint: { "text-color": palette.textRoad, "text-halo-color": palette.textHalo, "text-halo-width": 1.2 },
    },
    {
      id: "waterway-label",
      type: "symbol",
      source: OMT_SOURCE,
      "source-layer": "waterway",
      minzoom: 12,
      filter: classIn("river", "canal"),
      layout: { "symbol-placement": "line", "text-field": NAME, "text-font": labelFont(BASEMAP_FONTS.italic), "text-size": 11 },
      paint: { "text-color": palette.textWater, "text-halo-color": palette.textHalo, "text-halo-width": 1 },
    },
    {
      id: "water-label",
      type: "symbol",
      source: OMT_SOURCE,
      "source-layer": "water_name",
      minzoom: 9,
      layout: { "text-field": NAME, "text-font": labelFont(BASEMAP_FONTS.italic), "text-size": 12 },
      paint: { "text-color": palette.textWater, "text-halo-color": palette.textHalo, "text-halo-width": 1 },
    },
    {
      id: "poi-metro",
      type: "circle",
      source: OMT_SOURCE,
      "source-layer": "poi",
      minzoom: 12,
      filter: ["all", classIn("railway"), ["in", ["get", "subclass"], ["literal", ["subway", "station"]]]],
      paint: { "circle-color": palette.accent, "circle-stroke-color": palette.accentContrast, "circle-stroke-width": 1.5, "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 3, 16, 6] },
    },
    {
      id: "poi-metro-label",
      type: "symbol",
      source: OMT_SOURCE,
      "source-layer": "poi",
      minzoom: 13,
      filter: ["all", classIn("railway"), ["in", ["get", "subclass"], ["literal", ["subway", "station"]]]],
      layout: { "text-field": NAME, "text-font": labelFont(BASEMAP_FONTS.medium), "text-size": ["interpolate", ["linear"], ["zoom"], 13, 10, 17, 13], "text-anchor": "top", "text-offset": [0, 0.7], "text-max-width": 8 },
      paint: { "text-color": palette.accent, "text-halo-color": palette.textHalo, "text-halo-width": 1.4 },
    },
    {
      id: "poi-label",
      type: "symbol",
      source: OMT_SOURCE,
      "source-layer": "poi",
      minzoom: 16,
      filter: ["all", ["!", classIn("railway")], ["<=", ["get", "rank"], 8]],
      layout: { "text-field": NAME, "text-font": labelFont(BASEMAP_FONTS.regular), "text-size": 11, "text-anchor": "top", "text-offset": [0, 0.4], "text-max-width": 8 },
      paint: { "text-color": palette.textPoi, "text-halo-color": palette.textHalo, "text-halo-width": 1.2 },
    },
    {
      id: "housenumber",
      type: "symbol",
      source: OMT_SOURCE,
      "source-layer": "housenumber",
      minzoom: 17,
      layout: { "text-field": ["get", "housenumber"], "text-font": labelFont(BASEMAP_FONTS.regular), "text-size": 9 },
      paint: { "text-color": palette.textPoi, "text-halo-color": palette.textHalo, "text-halo-width": 1 },
    },
    {
      id: "place-suburb",
      type: "symbol",
      source: OMT_SOURCE,
      "source-layer": "place",
      minzoom: 11,
      maxzoom: 16,
      filter: classIn("suburb", "quarter", "neighbourhood"),
      layout: { "text-field": NAME, "text-font": labelFont(BASEMAP_FONTS.regular), "text-size": ["interpolate", ["linear"], ["zoom"], 11, 10, 15, 14], "text-transform": "uppercase", "text-letter-spacing": 0.1, "text-max-width": 8 },
      paint: { "text-color": palette.textPoi, "text-halo-color": palette.textHalo, "text-halo-width": 1.2 },
    },
    {
      id: "place-village",
      type: "symbol",
      source: OMT_SOURCE,
      "source-layer": "place",
      minzoom: 10,
      filter: classIn("village", "hamlet"),
      layout: { "text-field": NAME, "text-font": labelFont(BASEMAP_FONTS.regular), "text-size": ["interpolate", ["linear"], ["zoom"], 10, 10, 15, 14], "text-max-width": 8 },
      paint: { "text-color": palette.text, "text-halo-color": palette.textHalo, "text-halo-width": 1.2 },
    },
    {
      id: "place-town",
      type: "symbol",
      source: OMT_SOURCE,
      "source-layer": "place",
      minzoom: 7,
      maxzoom: 15,
      filter: classIn("town"),
      layout: { "text-field": NAME, "text-font": labelFont(BASEMAP_FONTS.medium), "text-size": ["interpolate", ["linear"], ["zoom"], 7, 10, 13, 15], "text-max-width": 8 },
      paint: { "text-color": palette.text, "text-halo-color": palette.textHalo, "text-halo-width": 1.4 },
    },
    {
      id: "place-city",
      type: "symbol",
      source: OMT_SOURCE,
      "source-layer": "place",
      minzoom: 4,
      maxzoom: 14,
      filter: classIn("city"),
      layout: { "text-field": NAME, "text-font": labelFont(BASEMAP_FONTS.medium), "text-size": ["interpolate", ["linear"], ["zoom"], 4, 11, 8, 14, 12, 20], "text-max-width": 8 },
      paint: { "text-color": palette.text, "text-halo-color": palette.textHalo, "text-halo-width": 1.6 },
    },
  ];
}

/**
 * origin — откуда открыто приложение: архив и глифы лежат на том же домене под /tiles (DEPLOY.md), и
 * абсолютный URL нужен только потому, что протокол pmtiles:// сам относительных путей не понимает.
 */
export function buildOwnBasemapStyle(basemap: VectorBasemap, scheme: ThemeScheme, origin: string): StyleSpecification {
  return {
    version: 8,
    name: `max-events-${scheme}`,
    sources: { [OMT_SOURCE]: { type: "vector", url: `pmtiles://${origin}${basemap.tiles}`, attribution: basemap.credit.join(" ") } },
    glyphs: `${origin}${basemap.glyphs}`,
    layers: layers(basemapPalette(scheme)),
  };
}
