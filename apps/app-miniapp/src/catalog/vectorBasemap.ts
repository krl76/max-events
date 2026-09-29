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
// - webglAvailable - есть ли WebGL2 с теми же атрибутами, что запросит MapLibre: WebGL1 не считается, пробный контекст сразу отпускается
// - VECTOR_CANVAS_ATTRIBUTES - атрибуты холста для WebView: буфер не стирается до композитинга, GPU по умолчанию а не high-performance
// - paintableBasemap - вектор только при живом WebGL2, иначе сразу растровый запасной, без пустого кадра
// - mountVectorBasemap - импортировать MapLibre, зарегистрировать pmtiles://, поставить слой на карту Leaflet; отклоняется без WebGL2 или если импорт не дошёл
// END_MODULE_MAP

import type { Map as LeafletMap } from "leaflet";
import type { ThemeScheme } from "../ui/theme";
import { buildOwnBasemapStyle } from "./basemapStyle";
import type { MapBasemap, VectorBasemap } from "./basemaps";

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

/** Атрибуты, с которыми MapLibre 6 рисует во встроенном WebView. high-performance там часто нет, а без сохранённого буфера холст внутри CSS-transform Leaflet стирается до композитинга и карта пустая при живом WebGL. */
export const VECTOR_CANVAS_ATTRIBUTES: WebGLContextAttributes = {
  antialias: false,
  powerPreference: "default",
  preserveDrawingBuffer: true,
  failIfMajorPerformanceCaveat: false,
  desynchronized: false,
};

function releaseProbe(gl: WebGL2RenderingContext): boolean {
  const lost = gl.isContextLost();
  gl.getExtension("WEBGL_lose_context")?.loseContext();
  return !lost;
}

export function webglAvailable(doc: Pick<Document, "createElement"> | undefined = typeof document === "undefined" ? undefined : document): boolean {
  if (doc === undefined) return false;
  try {
    const canvas = doc.createElement("canvas") as HTMLCanvasElement;
    const gl = canvas.getContext("webgl2", VECTOR_CANVAS_ATTRIBUTES);
    if (gl === null) return false;
    return releaseProbe(gl);
  } catch {
    return false;
  }
}

/** Вектор без живого WebGL2 не открываем: экран сразу берёт растр, а не пустой кадр после неудачного монтажа. */
export function paintableBasemap(preferred: MapBasemap, fallback: MapBasemap, glReady = webglAvailable()): MapBasemap {
  if (preferred.kind === "vector" && !glReady) return fallback;
  return preferred;
}

export async function mountVectorBasemap(map: LeafletMap, basemap: VectorBasemap, scheme: ThemeScheme, options: VectorBasemapOptions = {}): Promise<VectorBasemapLayer> {
  if (!webglAvailable()) throw new Error("WebGL2 недоступен: векторная подложка не поднимется");
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
  const layer = adapter
    .maplibreGL({
      style: buildOwnBasemapStyle(basemap, scheme, origin),
      attributionControl: false,
      canvasContextAttributes: { ...VECTOR_CANVAS_ATTRIBUTES, contextType: "webgl2" },
    })
    .addTo(map);
  const glMap = layer.getMaplibreMap();
  let troubleReported = false;
  const reportTrouble = () => {
    if (troubleReported) return;
    troubleReported = true;
    options.onTrouble?.();
  };
  glMap.on("error", reportTrouble);
  glMap.on("webglcontextlost", (event) => {
    event.originalEvent.preventDefault();
    reportTrouble();
  });
  glMap.on("load", () => glMap.resize());
  return {
    remove: () => layer.remove(),
    setScheme: (next) => glMap.setStyle(buildOwnBasemapStyle(basemap, next, origin)),
  };
}
