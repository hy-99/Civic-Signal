"use client";

import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export type LocationOption = {
  name: string;
  kind: "neighborhood" | "school" | "park" | "transit" | "landmark" | "hospital" | "address";
  latitude: number;
  longitude: number;
  zoom?: number;
};

const KIND_ICON: Record<LocationOption["kind"], string> = {
  neighborhood: "🏙",
  school: "🏫",
  park: "🌳",
  transit: "🚇",
  landmark: "📍",
  hospital: "🏥",
  address: "🏠",
};

const SF_LOCATIONS: LocationOption[] = [
  { name: "Embarcadero Ferry Building", kind: "landmark", latitude: 37.7955, longitude: -122.3938, zoom: 15.5 },
  { name: "Castro District", kind: "neighborhood", latitude: 37.7609, longitude: -122.4350, zoom: 14.4 },
  { name: "Mission District", kind: "neighborhood", latitude: 37.7599, longitude: -122.4148, zoom: 14.2 },
  { name: "Dolores Park", kind: "park", latitude: 37.7596, longitude: -122.4269, zoom: 15.4 },
  { name: "Golden Gate Park", kind: "park", latitude: 37.7694, longitude: -122.4862, zoom: 13.5 },
  { name: "Civic Center Plaza", kind: "landmark", latitude: 37.7793, longitude: -122.4192, zoom: 15.4 },
  { name: "Financial District", kind: "neighborhood", latitude: 37.7946, longitude: -122.4000, zoom: 14.4 },
  { name: "Marina District", kind: "neighborhood", latitude: 37.8030, longitude: -122.4378, zoom: 14.2 },
  { name: "North Beach", kind: "neighborhood", latitude: 37.8000, longitude: -122.4100, zoom: 14.4 },
  { name: "Haight-Ashbury", kind: "neighborhood", latitude: 37.7692, longitude: -122.4481, zoom: 14.6 },
  { name: "Twin Peaks", kind: "landmark", latitude: 37.7544, longitude: -122.4477, zoom: 14.4 },
  { name: "Sunset Elementary", kind: "school", latitude: 37.7558, longitude: -122.4736, zoom: 16 },
  { name: "Mission High School", kind: "school", latitude: 37.7625, longitude: -122.4276, zoom: 16 },
  { name: "Lowell High School", kind: "school", latitude: 37.7344, longitude: -122.4720, zoom: 16 },
  { name: "Galileo High School", kind: "school", latitude: 37.8054, longitude: -122.4264, zoom: 16 },
  { name: "Castro Station (MUNI)", kind: "transit", latitude: 37.7627, longitude: -122.4350, zoom: 16 },
  { name: "Powell Station (BART)", kind: "transit", latitude: 37.7843, longitude: -122.4076, zoom: 16 },
  { name: "16th St Mission BART", kind: "transit", latitude: 37.7649, longitude: -122.4197, zoom: 16 },
  { name: "SF General Hospital", kind: "hospital", latitude: 37.7561, longitude: -122.4053, zoom: 15.6 },
  { name: "UCSF Mission Bay", kind: "hospital", latitude: 37.7659, longitude: -122.3915, zoom: 15.6 },
];

type LocationSearchProps = {
  onPick: (location: LocationOption) => void;
};

function fuzzyMatch(query: string, name: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return name.toLowerCase().includes(q);
}

export function LocationSearch({ onPick }: LocationSearchProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [remoteOption, setRemoteOption] = useState<LocationOption | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const localResults = useMemo(() => {
    if (!query.trim()) return SF_LOCATIONS.slice(0, 6);
    return SF_LOCATIONS.filter((opt) => fuzzyMatch(query, opt.name)).slice(0, 8);
  }, [query]);

  const results = useMemo(() => {
    if (!query.trim()) return localResults;
    const unique = new Map<string, LocationOption>();
    if (remoteOption) unique.set(remoteOption.name, remoteOption);
    localResults.forEach((option) => {
      if (!unique.has(option.name)) unique.set(option.name, option);
    });
    return Array.from(unique.values());
  }, [localResults, remoteOption, query]);

  useEffect(() => {
    if (!query.trim() || query.trim().length < 3) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setSearchLoading(true);
      setSearchError("");

      try {
        const response = await fetch(`/api/geocode?query=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Unable to resolve location.");
        }

        const payload = await response.json();
        if (!payload.ok || !payload.data) {
          throw new Error("Unable to resolve location.");
        }

        setRemoteOption({
          name: payload.data.formatted_address || query,
          kind: "address",
          latitude: payload.data.latitude,
          longitude: payload.data.longitude,
          zoom: 15,
        });
      } catch {
        if (!controller.signal.aborted) {
          setRemoteOption(null);
          setSearchError("Unable to find that place. Try another address or landmark.");
        }
      } finally {
        if (!controller.signal.aborted) setSearchLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const pick = (option: LocationOption) => {
    setQuery(option.name);
    setOpen(false);
    onPick(option);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
      setOpen(true);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (open && results[activeIndex]) {
        pick(results[activeIndex]);
      } else if (remoteOption) {
        pick(remoteOption);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="cs-locsearch" ref={containerRef}>
      <Search className="cs-locsearch__icon h-3.5 w-3.5" />
      <input
        type="text"
        className="cs-locsearch__input"
        placeholder="Search any Bay Area address, building, street, or landmark…"
        value={query}
        onChange={(event) => {
          const nextQuery = event.target.value;
          setQuery(nextQuery);
          setActiveIndex(0);
          setOpen(true);

          if (!nextQuery.trim() || nextQuery.trim().length < 3) {
            setRemoteOption(null);
            setSearchError("");
            setSearchLoading(false);
          }
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        aria-label="Search any Bay Area address or place"
      />
      {query ? (
        <button
          type="button"
          className="cs-locsearch__clear"
          onClick={() => {
            setQuery("");
            setOpen(true);
          }}
          aria-label="Clear search"
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}

      {open ? (
        <div className="cs-locsearch__menu" role="listbox">
          {results.length ? (
            results.map((option, index) => (
              <button
                key={`${option.kind}:${option.name}`}
                type="button"
                className="cs-locsearch__option"
                data-active={index === activeIndex ? "true" : "false"}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => pick(option)}
              >
                <span aria-hidden="true">{KIND_ICON[option.kind]}</span>
                <span className="truncate">{option.name}</span>
                <span className="cs-locsearch__option-kind">{option.kind}</span>
              </button>
            ))
          ) : (
            <p className="cs-locsearch__empty">
              {searchLoading ? "Searching…" : searchError || "No matching places."}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
