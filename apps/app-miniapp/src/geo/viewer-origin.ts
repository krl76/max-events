// START_MODULE_CONTRACT
// PURPOSE: Shared viewer origin for nearby/today/people/plans/autoplan/day-route/map: geolocation when the browser allows it, Moscow fallback.
// SCOPE: useViewerOrigin hook; does not persist; no city geocoding. Alongside the coordinates it reports how they were obtained, so a screen can say «показываем центр города» instead of pretending the fallback is the viewer.
// DEPENDS: react, ../catalog/MapScreen.js (MOSCOW_CENTER)
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ViewerOriginState - ждём ответа браузера / координаты получены / отказ или геолокации нет вовсе
// - ViewerOrigin - lat/lng plus whether it came from geolocation and at what stage the request is
// - viewerOriginFrom - pure: coordinates -> origin, null -> the Moscow fallback marked as refused
// - useViewerOrigin - live origin; starts at Moscow, upgrades when getCurrentPosition succeeds
// - browsedCityOrigin - GPS when the viewer is in the city they opened, otherwise that city's center
// END_MODULE_MAP

import { useEffect, useState } from "react";
import { MOSCOW_CENTER } from "../catalog/MapScreen";
import { ONBOARDING_CITIES } from "../onboarding/onboarding";

export type ViewerOriginState = "pending" | "granted" | "denied";

export interface ViewerOrigin {
  latitude: number;
  longitude: number;
  source: "geo" | "fallback";
  /** «denied» покрывает и отказ, и таймаут, и отсутствие API: для экрана это один и тот же ответ — точки нет. */
  state: ViewerOriginState;
}

/**
 * Функция, а не константа: MapScreen импортирует этот модуль, а этот — MOSCOW_CENTER из него, и на
 * верхнем уровне круг даёт undefined. Читать координаты в момент вызова — цена этого круга.
 */
function cityFallback(state: ViewerOriginState): ViewerOrigin {
  return { latitude: MOSCOW_CENTER[0], longitude: MOSCOW_CENTER[1], source: "fallback", state };
}

/**
 * Отказ, таймаут, небезопасный контекст и отсутствие самого API — для экрана один и тот же ответ:
 * координат нет, показываем центр города и говорим об этом. Поэтому решение одно и оно чистое.
 */
export function viewerOriginFrom(coords: { latitude: number; longitude: number } | null): ViewerOrigin {
  if (coords === null || !Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude)) return cityFallback("denied");
  return { latitude: coords.latitude, longitude: coords.longitude, source: "geo", state: "granted" };
}

/** Past this the viewer is not in the city they opened, so a walk from their GPS is not a route inside it. */
const BROWSED_CITY_FAR_KM = 80;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export interface BrowsedCityOrigin {
  latitude: number;
  longitude: number;
  /** False when the point is the city center because the viewer is outside that city. */
  fromViewer: boolean;
}

/**
 * A catalog of one city measured from a GPS fix hundreds of kilometres away is a list of «далеко».
 * Inside the city the fix stays; outside it, distances start at the city center the viewer picked.
 * A city the product does not know keeps the fix — there is no center to substitute.
 */
export function browsedCityOrigin(origin: { latitude: number; longitude: number }, cityName: string): BrowsedCityOrigin {
  const city = ONBOARDING_CITIES.find((item) => item.name === cityName);
  if (city === undefined) return { latitude: origin.latitude, longitude: origin.longitude, fromViewer: true };
  if (haversineKm(origin.latitude, origin.longitude, city.latitude, city.longitude) <= BROWSED_CITY_FAR_KM) {
    return { latitude: origin.latitude, longitude: origin.longitude, fromViewer: true };
  }
  return { latitude: city.latitude, longitude: city.longitude, fromViewer: false };
}

// Не вычислять на импорте: MOSCOW_CENTER приходит из MapScreen, а тот импортирует этот модуль.
let currentOrigin: ViewerOrigin | null = null;
const originListeners = new Set<(origin: ViewerOrigin) => void>();

function readOrigin(): ViewerOrigin {
  currentOrigin ??= cityFallback("pending");
  return currentOrigin;
}

function publishOrigin(next: ViewerOrigin): void {
  currentOrigin = next;
  originListeners.forEach((listener) => listener(next));
}

/**
 * A fresh fix. Called on mount and again from a tap: a cross-origin mini-app often may ask for
 * geolocation only while the click is still the user gesture, and a cached position must not
 * pretend to be today's city.
 */
export function requestViewerOrigin(): Promise<ViewerOrigin> {
  return new Promise((resolve) => {
    const finish = (next: ViewerOrigin) => {
      publishOrigin(next);
      resolve(next);
    };
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      finish(viewerOriginFrom(null));
      return;
    }
    if (readOrigin().state !== "pending") publishOrigin({ ...readOrigin(), state: "pending" });
    const ask = (precise: boolean, retry: boolean) => {
      try {
        navigator.geolocation.getCurrentPosition(
          (pos) => finish(viewerOriginFrom(pos.coords)),
          () => {
            // В webview точный GPS часто молчит по таймауту, а сетевая точка уже есть. Второй запрос
            // без high accuracy забирает её, и город определяется без отдельной кнопки.
            if (retry) ask(false, false);
            else finish(viewerOriginFrom(null));
          },
          { enableHighAccuracy: precise, maximumAge: precise ? 60_000 : 300_000, timeout: 8_000 },
        );
      } catch {
        if (retry) ask(false, false);
        else finish(viewerOriginFrom(null));
      }
    };
    ask(true, true);
  });
}

export function useViewerOrigin(): ViewerOrigin {
  const [origin, setOrigin] = useState<ViewerOrigin>(readOrigin);
  useEffect(() => {
    originListeners.add(setOrigin);
    setOrigin(readOrigin());
    return () => {
      originListeners.delete(setOrigin);
    };
  }, []);
  useEffect(() => {
    // A later screen must not throw away a fix the onboarding tap already earned.
    if (readOrigin().state === "pending") requestViewerOrigin();
  }, []);
  return origin;
}
