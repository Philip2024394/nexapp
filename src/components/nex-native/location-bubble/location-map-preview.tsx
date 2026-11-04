"use client";

// src/components/nex-native/location-bubble/location-map-preview.tsx
//
// NEX Location · shared MapLibre preview. Loads tiles from the chosen
// provider ONLY when mounted. Caller controls when to mount so the
// picker never fires tile requests before the user has chosen their
// precision tier.
//
// Owner directive 2026-11-05 · Area-only MUST NOT mount this component
// at user-GPS coordinates. Either (a) show the AreaChip and no map, or
// (b) pass the bundled area-centroid as center.

import * as React from "react";

// Stadia Maps style URL · free tier · caller must swap for a paid key
// when exceeding 200k loads/month. Attribution is auto-rendered by
// MapLibre + Stadia's style TOS.
//
// This string is intentionally a public constant · Stadia's style URL
// without an API key uses their shared free tier with per-IP rate limits.
// Production should pass a signed URL via NEXT_PUBLIC_STADIA_STYLE_URL.
const DEFAULT_STYLE_URL =
  "https://tiles.stadiamaps.com/styles/alidade_smooth_dark.json";

export interface LocationMapPreviewProps {
  readonly centerLat: number;
  readonly centerLng: number;
  /** Zoom level · higher = more detail · 15 is street-level for Exact,
   *  13 is neighbourhood for Nearby. */
  readonly zoom: number;
  /** When provided, renders a circular overlay (used by Nearby to show
   *  the 250 m privacy radius · also used by Exact to show accuracy). */
  readonly radiusM?: number | null;
  /** When true, draws a pin at (centerLat, centerLng). Set false for
   *  Nearby where the pin would read as deceptively precise. */
  readonly showPin?: boolean;
  /** Preview height · px. */
  readonly height?: number;
  /** Optional style URL override · pass a signed Stadia or Protomaps
   *  URL in production. */
  readonly styleUrl?: string;
}

export function LocationMapPreview(
  props: LocationMapPreviewProps,
): React.JSX.Element {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<unknown>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let cancelled = false;
    let mapInstance: { remove(): void } | null = null;

    (async () => {
      try {
        const mod = await import("maplibre-gl");
        if (cancelled) return;
        const styleUrl =
          props.styleUrl ??
          (typeof process !== "undefined"
            ? process.env.NEXT_PUBLIC_STADIA_STYLE_URL
            : undefined) ??
          DEFAULT_STYLE_URL;
        const map = new mod.Map({
          container: el,
          style: styleUrl,
          center: [props.centerLng, props.centerLat],
          zoom: props.zoom,
          attributionControl: { compact: false },
          interactive: false,
        });
        mapInstance = map;
        mapRef.current = map;

        map.on("load", () => {
          if (cancelled) return;
          if (props.showPin !== false) {
            new mod.Marker({ color: "#C6A15B" })
              .setLngLat([props.centerLng, props.centerLat])
              .addTo(map);
          }
          if (typeof props.radiusM === "number" && props.radiusM > 0) {
            map.addSource("radius", {
              type: "geojson",
              data: makeCircleGeoJson(
                props.centerLat,
                props.centerLng,
                props.radiusM,
              ),
            });
            map.addLayer({
              id: "radius-fill",
              type: "fill",
              source: "radius",
              paint: {
                "fill-color": "#C6A15B",
                "fill-opacity": 0.14,
              },
            });
            map.addLayer({
              id: "radius-stroke",
              type: "line",
              source: "radius",
              paint: {
                "line-color": "#C6A15B",
                "line-width": 1.5,
                "line-opacity": 0.7,
              },
            });
          }
        });
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    })();

    return () => {
      cancelled = true;
      try {
        mapInstance?.remove();
      } catch {
        /* ignore */
      }
      mapRef.current = null;
    };
    // Re-run when center/zoom/radius change.
  }, [
    props.centerLat,
    props.centerLng,
    props.zoom,
    props.radiusM,
    props.showPin,
    props.styleUrl,
  ]);

  return (
    <div
      ref={containerRef}
      data-nex-location-map
      style={{
        width: "100%",
        height: props.height ?? 180,
        borderRadius: 10,
        overflow: "hidden",
        background: "rgba(0,0,0,0.3)",
        position: "relative",
      }}
    >
      {error ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            color: "#B5C3D6",
            padding: 12,
            textAlign: "center",
          }}
        >
          Map unavailable
        </div>
      ) : null}
    </div>
  );
}

/** Builds a GeoJSON Polygon approximating a circle of given radius in
 *  meters around a point. Used for the privacy halo (Nearby) and the
 *  accuracy halo (Exact). */
function makeCircleGeoJson(
  lat: number,
  lng: number,
  radiusM: number,
): GeoJSON.Feature {
  const steps = 64;
  const coords: Array<[number, number]> = [];
  const earthRadius = 6371000;
  const latRad = (lat * Math.PI) / 180;
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * 2 * Math.PI;
    const dLat = (radiusM / earthRadius) * Math.cos(theta);
    const dLng =
      (radiusM / (earthRadius * Math.max(Math.cos(latRad), 1e-6))) *
      Math.sin(theta);
    coords.push([
      lng + (dLng * 180) / Math.PI,
      lat + (dLat * 180) / Math.PI,
    ]);
  }
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [coords],
    },
  };
}
