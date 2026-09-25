// START_MODULE_CONTRACT
// PURPOSE: Поднять собственную векторную подложку внутри карты Leaflet: MapLibre GL через адаптер maplibre-gl-leaflet, архив PMTiles по протоколу pmtiles://, стиль из ./basemapStyle.ts под текущую схему.
// SCOPE: Только векторный слой и его жизнь: ленивый импорт MapLibre (≈1 МБ, грузится лишь когда подложку выбрали), URL воркера и регистрация протокола один раз на страницу, проверка WebGL до импорта, смена схемы без пересоздания слоя, первая ошибка загрузки — один вызов наружу. Растровые подложки и всё остальное на карте — ./MapScreen.tsx.
// DEPENDS: maplibre-gl (ленивый импорт + css + воркер через `?worker&url` Vite), pmtiles (ленивый импорт), @maplibre/maplibre-gl-leaflet (ленивый импорт), leaflet (только типы), ./basemapStyle.js (buildOwnBasemapStyle), ./basemaps.js (VectorBasemap), ../ui/theme.js (ThemeScheme)
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - VectorBasemapLayer - живой векторный слой: снять с карты, перекрасить под схему
// - VectorBasemapOptions - origin для абсолютных URL архива и глифов и onTrouble на первую ошибку загрузки
// - webglAvailable - есть ли WebGL у этого браузера: без него MapLibre не поднимется, и вызывающий возвращается к растру
// - mountVectorBasemap - импортировать MapLibre, зарегистрировать pmtiles://, поставить слой на карту Leaflet; отклоняется без WebGL или если импорт не дошёл
// END_MODULE_MAP

import type { Map as LeafletMap } from "leaflet";
import type { ThemeScheme } from "../ui/theme";
import { buildOwnBasemapStyle } from "./basemapStyle";
import type { VectorBasemap } from "./basemaps";

export interface VectorBasemapLayer {
  remove: () => void;
  setScheme: (scheme: ThemeScheme) => void;
}

export interface VectorBasemapOptions {
  /** Откуда открыто приложение; по умолчанию window.location.origin. Архив и глифы лежат под ним (/tiles). */
  origin?: string;
  /** Первая ошибка загрузки стиля, архива или тайла; дальше слой молчит, как растровый tileerror. */
  onTrouble?: () => void;
}

/** Протокол регистрируется на страницу один раз: MapLibre держит его в модульном состоянии, повтор его перезапишет тем же. */
let protocolReady = false;

export function webglAvailable(doc: Pick<Document, "createElement"> | undefined = typeof document === "undefined" ? undefined : document): boolean {
  if (doc === undefined) return false;
  try {
    const canvas = doc.createElement("canvas");
    return canvas.getContext("webgl2") !== null || canvas.getContext("webgl") !== null;
  } catch {
    return false;
  }
}

export async function mountVectorBasemap(map: LeafletMap, basemap: VectorBasemap, scheme: ThemeScheme, options: VectorBasemapOptions = {}): Promise<VectorBasemapLayer> {
  if (!webglAvailable()) throw new Error("WebGL недоступен: векторная подложка не поднимется");
  const origin = options.origin ?? window.location.origin;
  // Воркер MapLibre идёт отдельным файлом; `?worker&url` — рецепт из документации MapLibre для Vite: сборка
  // кладёт его самодостаточным чанком (с общим кодом внутри), а `import.meta.url` внутри библиотеки в графе
  // бандлера до файла не дотягивается и без этого отвечает 404.
  const [maplibre, pmtiles, adapter, worker] = await Promise.all([import("maplibre-gl"), import("pmtiles"), import("@maplibre/maplibre-gl-leaflet"), import("maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url"), import("maplibre-gl/dist/maplibre-gl.css")]);
  if (!protocolReady) {
    maplibre.setWorkerUrl(worker.default);
    maplibre.addProtocol("pmtiles", new pmtiles.Protocol().tile);
    protocolReady = true;
  }
  const layer = adapter.maplibreGL({ style: buildOwnBasemapStyle(basemap, scheme, origin), attributionControl: false }).addTo(map);
  let troubleReported = false;
  layer.getMaplibreMap().on("error", () => {
    if (troubleReported) return;
    troubleReported = true;
    options.onTrouble?.();
  });
  return {
    remove: () => layer.remove(),
    setScheme: (next) => layer.getMaplibreMap().setStyle(buildOwnBasemapStyle(basemap, next, origin)),
  };
}
