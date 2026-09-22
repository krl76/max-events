// START_MODULE_CONTRACT
// PURPOSE: Shared viewer origin for nearby/today/people/plans/autoplan/day-route: geolocation when the browser allows it, Moscow fallback.
// SCOPE: useViewerOrigin hook; does not persist; no city geocoding.
// DEPENDS: react, ../catalog/MapScreen.js (MOSCOW_CENTER)
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ViewerOrigin - lat/lng plus whether it came from geolocation
// - useViewerOrigin - live origin; starts at Moscow, upgrades when getCurrentPosition succeeds
// END_MODULE_MAP

import { useEffect, useState } from "react";
import { MOSCOW_CENTER } from "../catalog/MapScreen";

export interface ViewerOrigin {
  latitude: number;
  longitude: number;
  source: "geo" | "fallback";
}

export function useViewerOrigin(): ViewerOrigin {
  const [origin, setOrigin] = useState<ViewerOrigin>({ latitude: MOSCOW_CENTER[0], longitude: MOSCOW_CENTER[1], source: "fallback" });
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setOrigin({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, source: "geo" }),
      () => {},
      { enableHighAccuracy: false, maximumAge: 120_000, timeout: 8_000 },
    );
  }, []);
  return origin;
}
