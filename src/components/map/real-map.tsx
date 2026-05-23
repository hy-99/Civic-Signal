"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Map, Marker, StyleSpecification } from "maplibre-gl";

import { CATEGORY_CONFIG, DEFAULT_COORDS } from "@/lib/constants";
import type { RiskClusterView, RiskLevel } from "@/lib/types";
import { CategoryIcon } from "@/components/shared/badges";
import { cn } from "@/lib/utils";

export type MapAudience = "citizen" | "responder";
type MapDisplayMode = "realistic" | "safety";

export type FocusLocation = {
  latitude: number;
  longitude: number;
  zoom?: number;
  /** changes on each pick so consecutive picks of the same place still fly */
  token: number;
};

type RealMapProps = {
  clusters: RiskClusterView[];
  selectedId: string | null;
  audience?: MapAudience;
  focusLocation?: FocusLocation | null;
  onSelect: (id: string) => void;
  onUnavailable?: () => void;
};

type MapLibreModule = typeof import("maplibre-gl");

function markerColor(risk: RiskLevel) {
  if (risk === "urgent") return "#ef4444";
  if (risk === "serious") return "#f97316";
  if (risk === "watch") return "#eab308";
  return "#94a3b8";
}

function createFallbackStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "© OpenStreetMap contributors",
      },
    },
    layers: [
      {
        id: "osm",
        type: "raster",
        source: "osm",
      },
    ],
  };
}

function MapPin({
  cluster,
  selected,
  audience,
}: {
  cluster: RiskClusterView;
  selected: boolean;
  audience: MapAudience;
}) {
  const color = markerColor(cluster.risk_level);
  const chipText = audience === "responder" ? String(cluster.risk_score) : "!";
  return (
    <div
      className={cn(
        "cs-pin",
        selected && "cs-pin--selected",
        cluster.risk_level === "urgent" && "cs-pin--urgent",
      )}
      style={{ "--cs-color": color } as CSSProperties}
    >
      <span className="cs-pin__chip" aria-hidden="true">
        {chipText}
      </span>
      <svg
        className="cs-pin__shape"
        width="40"
        height="50"
        viewBox="0 0 36 46"
        aria-hidden="true"
      >
        <path
          d="M18 1 C8.6 1 1 8.6 1 18 C1 30 18 45 18 45 C18 45 35 30 35 18 C35 8.6 27.4 1 18 1 Z"
          fill={color}
          stroke="white"
          strokeWidth="2"
        />
        <circle cx="18" cy="18" r="10" fill="white" />
      </svg>
      <span className="cs-pin__icon-wrap" aria-hidden="true">
        <CategoryIcon category={cluster.category} className="h-[18px] w-[18px]" />
      </span>
      <span className="cs-pin__label">{cluster.title}</span>
    </div>
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildPopupHtml(cluster: RiskClusterView, audience: MapAudience) {
  const category = CATEGORY_CONFIG[cluster.category].label;
  const reason = cluster.score_breakdown.risk_reason || cluster.summary || "";
  const action = cluster.score_breakdown.recommended_action || "";
  return `
    <div class="cs-popup cs-popup--${cluster.risk_level}">
      <div class="cs-popup__row">
        <span class="cs-popup__tier">${cluster.risk_level.toUpperCase()}</span>
        <span class="cs-popup__cat">${escapeHtml(category)}</span>
      </div>
      <h3 class="cs-popup__title">${escapeHtml(cluster.title)}</h3>
      <div class="cs-popup__stats">
        <div><b>${cluster.risk_score}</b><span>Risk</span></div>
        <div><b>${cluster.confidence_score}</b><span>Confidence</span></div>
        <div><b>${cluster.report_count + cluster.signal_count}</b><span>Evidence</span></div>
      </div>
      <p class="cs-popup__reason">${escapeHtml(reason.slice(0, 160))}</p>
      ${audience === "responder" && action ? `<p class="cs-popup__action"><b>Recommended:</b> ${escapeHtml(action.slice(0, 140))}</p>` : ""}
    </div>
  `;
}

function RasterTileMap({
  clusters,
  selectedId,
  audience,
  onSelect,
}: Omit<RealMapProps, "onUnavailable"> & { audience: MapAudience }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 720, height: 520 });
  const [zoom, setZoom] = useState(12);
  const [displayMode] = useState<MapDisplayMode>("realistic");
  const [isLocating, setIsLocating] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const centerLng = userLocation?.lng ?? (clusters.length ? clusters.reduce((total, cluster) => total + cluster.longitude, 0) / clusters.length : DEFAULT_COORDS.lng);
  const centerLat = userLocation?.lat ?? (clusters.length ? clusters.reduce((total, cluster) => total + cluster.latitude, 0) / clusters.length : DEFAULT_COORDS.lat);
  const center = useMemo(() => worldPoint(centerLng, centerLat, zoom), [centerLat, centerLng, zoom]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: Math.max(320, Math.round(entry.contentRect.width)),
        height: Math.max(300, Math.round(entry.contentRect.height)),
      });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleGeolocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        setZoom(15);
        setIsLocating(false);
      },
      () => {
        alert("Unable to retrieve your location. Please check your permissions.");
        setIsLocating(false);
      },
      { timeout: 5000 },
    );
  };

  const tiles = useMemo(() => {
    const startX = Math.floor((center.x - size.width / 2) / 256);
    const endX = Math.floor((center.x + size.width / 2) / 256);
    const startY = Math.floor((center.y - size.height / 2) / 256);
    const endY = Math.floor((center.y + size.height / 2) / 256);
    const maxY = 2 ** zoom - 1;
    const nextTiles: Array<{ key: string; x: number; y: number; left: number; top: number; src: string }> = [];

    for (let x = startX; x <= endX; x += 1) {
      for (let y = startY; y <= endY; y += 1) {
        if (y < 0 || y > maxY) continue;
        const wrappedX = wrappedTileX(x, zoom);
        nextTiles.push({
          key: `${zoom}-${x}-${y}`,
          x,
          y,
          left: x * 256 - center.x + size.width / 2,
          top: y * 256 - center.y + size.height / 2,
          src: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${y}.png`,
        });
      }
    }

    return nextTiles;
  }, [center.x, center.y, size.height, size.width, zoom]);

  return (
    <div
      ref={containerRef}
      className={cn("cs-real-map relative h-full min-h-[360px] w-full overflow-hidden bg-[#d9eef7]", `cs-real-map--${displayMode}`)}
      data-real-map="osm-raster"
      data-map-mode={displayMode}
    >
      {tiles.map((tile) => (
        // eslint-disable-next-line @next/next/no-img-element -- OSM slippy-map tiles should not be proxied through Next image optimization.
        <img
          key={tile.key}
          alt=""
          aria-hidden="true"
          draggable={false}
          src={tile.src}
          className="absolute h-64 w-64 select-none"
          style={{ left: tile.left, top: tile.top }}
        />
      ))}

      {clusters.map((cluster) => {
        const point = worldPoint(cluster.longitude, cluster.latitude, zoom);
        const left = point.x - center.x + size.width / 2;
        const top = point.y - center.y + size.height / 2;
        const isSelected = cluster.id === selectedId;

        return (
          <button
            key={cluster.id}
            type="button"
            aria-label={`Open ${cluster.title}`}
            className="cs-pin-anchor absolute"
            style={{ left, top }}
            onClick={() => onSelect(cluster.id)}
          >
            <MapPin cluster={cluster} selected={isSelected} audience={audience} />
          </button>
        );
      })}

      <div className="absolute right-3 top-3 grid overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <button 
          type="button" 
          disabled={isLocating}
          className="h-9 w-9 text-sm font-black border-b border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
          onClick={handleGeolocation}
          aria-label="Zoom to your location"
          title="Show my location"
        >
          {isLocating ? "..." : "📍"}
        </button>
        <button type="button" className="h-9 w-9 border-b border-slate-200 text-sm font-black hover:bg-slate-50" onClick={() => setZoom((value) => Math.min(16, value + 1))}>
          +
        </button>
        <button type="button" className="h-9 w-9 text-sm font-black hover:bg-slate-50" onClick={() => setZoom((value) => Math.max(10, value - 1))}>
          -
        </button>
      </div>
      <div className="absolute bottom-3 right-3 rounded-md bg-white/90 px-2 py-1 text-[10px] font-semibold text-slate-500 shadow-sm">
        © OpenStreetMap contributors
      </div>
    </div>
  );
}

function worldPoint(lng: number, lat: number, zoom: number) {
  const scale = 2 ** zoom * 256;
  const x = ((lng + 180) / 360) * scale;
  const latRad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale;
  return { x, y };
}

function wrappedTileX(tileX: number, zoom: number) {
  const limit = 2 ** zoom;
  return ((tileX % limit) + limit) % limit;
}


export function RealMap({ clusters, selectedId, audience = "citizen", focusLocation, onSelect, onUnavailable }: RealMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const rootsRef = useRef<Root[]>([]);
  const onUnavailableRef = useRef(onUnavailable);
  const didSkipInitialFlyRef = useRef(false);
  const initialClustersRef = useRef(clusters);
  const animatedClusterIdsRef = useRef<Set<string>>(new Set());
  const firstMarkerPassRef = useRef(true);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [maplibre, setMaplibre] = useState<MapLibreModule | null>(null);
  const [displayMode] = useState<MapDisplayMode>("realistic");

  const center = useMemo<[number, number]>(() => {
    const selected = clusters.find((cluster) => cluster.id === selectedId) || clusters[0];
    return selected ? [selected.longitude, selected.latitude] : [DEFAULT_COORDS.lng, DEFAULT_COORDS.lat];
  }, [clusters, selectedId]);

  useEffect(() => {
    onUnavailableRef.current = onUnavailable;
  }, [onUnavailable]);

  useEffect(() => {
    let cancelled = false;

    async function loadMap() {
      try {
        const maplibregl = await import("maplibre-gl");
        if (cancelled || !containerRef.current) return;
        setMaplibre(maplibregl);

        const styleUrl = process.env.NEXT_PUBLIC_MAP_STYLE_URL;
        const map = new maplibregl.Map({
          container: containerRef.current,
          style: styleUrl || createFallbackStyle(),
          center: [DEFAULT_COORDS.lng, DEFAULT_COORDS.lat],
          zoom: 13,
          attributionControl: false,
        });

        map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
        map.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: false }, trackUserLocation: false, showUserHeading: false }), "top-right");
        map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
        map.on("load", () => {
          const initialClusters = initialClustersRef.current;
          if (initialClusters.length > 1) {
            const bounds = new maplibregl.LngLatBounds();
            initialClusters.forEach((cluster) => bounds.extend([cluster.longitude, cluster.latitude]));
            map.fitBounds(bounds, { padding: 80, maxZoom: 13, duration: 0 });
          }
          setStatus("ready");
        });
        map.on("error", () => {
          if (styleUrl) {
            setStatus("error");
            onUnavailableRef.current?.();
          }
        });
        mapRef.current = map;
      } catch {
        setStatus("error");
      }
    }

    loadMap();

    return () => {
      cancelled = true;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      rootsRef.current.forEach((root) => {
        queueMicrotask(() => root.unmount());
      });
      rootsRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !maplibre || status === "error") return;

    const previousRoots = rootsRef.current;
    const previousMarkers = markersRef.current;

    const isFirstPass = firstMarkerPassRef.current;
    firstMarkerPassRef.current = false;
    let newcomerIndex = 0;
    const nextRoots: Root[] = [];
    const nextMarkers = clusters.map((cluster, index) => {
      const element = document.createElement("button");
      element.type = "button";
      element.className = "cs-pin-anchor";
      element.setAttribute("aria-label", `Open ${cluster.title}`);
      element.addEventListener("click", (event) => {
        event.stopPropagation();
        onSelect(cluster.id);
      });

      const root = createRoot(element);
      root.render(
        <MapPin
          cluster={cluster}
          selected={cluster.id === selectedId}
          audience={audience}
        />,
      );
      nextRoots.push(root);

      if (!animatedClusterIdsRef.current.has(cluster.id)) {
        animatedClusterIdsRef.current.add(cluster.id);
        const delayMs = (isFirstPass ? index : newcomerIndex) * 80;
        newcomerIndex += 1;
        element.style.animation = `civicsignal-pin-drop 560ms cubic-bezier(0.22, 1, 0.36, 1) ${delayMs}ms backwards`;
      }

      const popup = new maplibre.Popup({ closeButton: false, offset: 28, className: "cs-popup-wrap" }).setHTML(
        buildPopupHtml(cluster, audience),
      );

      return new maplibre.Marker({ element, anchor: "bottom" })
        .setLngLat([cluster.longitude, cluster.latitude])
        .setPopup(popup)
        .addTo(map);
    });

    markersRef.current = nextMarkers;
    rootsRef.current = nextRoots;

    // Remove previous markers, defer root unmounts to avoid React 19 warning about unmounting during render
    previousMarkers.forEach((marker) => marker.remove());
    previousRoots.forEach((root) => {
      queueMicrotask(() => root.unmount());
    });
  }, [audience, clusters, maplibre, onSelect, selectedId, status]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    if (!didSkipInitialFlyRef.current) {
      didSkipInitialFlyRef.current = true;
      return;
    }
    map.flyTo({ center, zoom: 13.6, speed: 0.8, essential: false });
  }, [center, selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusLocation || status !== "ready") return;
    map.flyTo({
      center: [focusLocation.longitude, focusLocation.latitude],
      zoom: focusLocation.zoom ?? 15,
      speed: 1.2,
      curve: 1.6,
      essential: true,
    });
  }, [focusLocation, status]);

  if (status === "error") {
    return <RasterTileMap clusters={clusters} selectedId={selectedId} audience={audience} onSelect={onSelect} />;
  }

  return (
    <div className={cn("cs-real-map relative h-full min-h-[360px] w-full bg-[#d9eef7]", `cs-real-map--${displayMode}`)} data-map-mode={displayMode}>
      <div ref={containerRef} className="h-full w-full" data-real-map="maplibre" />
      {status === "loading" ? (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/95 px-4 py-2 text-xs font-semibold text-slate-600 shadow-md">
          Loading map…
        </div>
      ) : null}
    </div>
  );
}
