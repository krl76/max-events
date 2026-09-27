// START_MODULE_CONTRACT
// PURPOSE: Point the city-scoped screens at the profile city when the viewer is outside it.
// SCOPE: One profile read plus browsedCityOrigin. Screens wait for `settled` before the first request.
// DEPENDS: ../api/client.js (apiClient.getProfile), ./viewer-origin.js
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ProfileCityPoint - viewer coordinates, or the profile city's center when the viewer is outside it
// - profileCityPoint - pure: origin + city name + whether the profile request finished
// - useProfileCityPoint - live point; unsettled until getProfile resolves or fails
// END_MODULE_MAP

import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../api/client";
import { browsedCityOrigin, useViewerOrigin, type ViewerOrigin } from "./viewer-origin";

export interface ProfileCityPoint {
  latitude: number;
  longitude: number;
  /** False when the point is the city center because the viewer is outside that city. */
  fromViewer: boolean;
  source: ViewerOrigin["source"];
  state: ViewerOrigin["state"];
  /** Profile city once loaded. Null while the request is in flight or when it failed. */
  city: string | null;
  /** False until the profile request finishes. Callers skip the first fetch so a far GPS fix is not queried. */
  settled: boolean;
  viewerLatitude: number;
  viewerLongitude: number;
}

/** Until the profile is known the raw fix stays. A known city uses the same rule as search and the swipe deck. */
export function profileCityPoint(origin: ViewerOrigin, city: string | null, settled: boolean): ProfileCityPoint {
  const viewer = {
    source: origin.source,
    state: origin.state,
    city,
    settled,
    viewerLatitude: origin.latitude,
    viewerLongitude: origin.longitude,
  };
  if (!settled || city === null) {
    return { ...viewer, latitude: origin.latitude, longitude: origin.longitude, fromViewer: true };
  }
  return { ...viewer, ...browsedCityOrigin(origin, city) };
}

export function useProfileCityPoint(): ProfileCityPoint {
  const origin = useViewerOrigin();
  const [city, setCity] = useState<string | null>(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    let alive = true;
    apiClient.getProfile().then(
      (profile) => {
        if (!alive) return;
        setCity(profile.city);
        setSettled(true);
      },
      () => {
        if (alive) setSettled(true);
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  return useMemo(() => profileCityPoint(origin, city, settled), [origin, city, settled]);
}
