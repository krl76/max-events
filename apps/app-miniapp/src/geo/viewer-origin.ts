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
// END_MODULE_MAP

import { useEffect, useState } from "react";
import { MOSCOW_CENTER } from "../catalog/MapScreen";

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

export function useViewerOrigin(): ViewerOrigin {
  const [origin, setOrigin] = useState<ViewerOrigin>(() => cityFallback("pending"));
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setOrigin(viewerOriginFrom(null));
      return;
    }
    let alive = true;
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (alive) setOrigin(viewerOriginFrom(pos.coords));
        },
        () => {
          if (alive) setOrigin(viewerOriginFrom(null));
        },
        { enableHighAccuracy: false, maximumAge: 120_000, timeout: 8_000 },
      );
    } catch {
      // Часть webview бросает синхронно вместо вызова колбэка ошибки; для экрана это тот же отказ.
      setOrigin(viewerOriginFrom(null));
    }
    return () => {
      alive = false;
    };
  }, []);
  return origin;
}
