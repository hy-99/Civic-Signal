"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LocateFixed, MapPin, MousePointer2, ShieldCheck, Trash2, Undo2, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { CATEGORY_CONFIG, CATEGORY_OPTIONS, URGENCY_OPTIONS } from "@/lib/constants";
import type { ReportCardView, ReportCategoryKey } from "@/lib/types";
import { reportCreateSchema } from "@/lib/validation";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/primitives";

type ReportValues = z.input<typeof reportCreateSchema>;

const fieldClassName = "civic-light-input rounded-xl px-4 py-2.5 text-slate-950 placeholder:text-slate-400";
const checkboxPanelClassName = "rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600";
const labelClassName = "text-slate-900";
const helpClassName = "text-slate-500";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs font-medium text-red-600">{message}</p>;
}

type ZoneDraftPoint = {
  x: number;
  y: number;
  lat: number;
  lng: number;
};

function ZoneDrawModal({
  latitude,
  longitude,
  initialGeometry,
  onClose,
  onSave,
}: {
  latitude: number;
  longitude: number;
  initialGeometry: ReportValues["user_submitted_zone"];
  onClose: () => void;
  onSave: (geometry: NonNullable<ReportValues["user_submitted_zone"]>) => void;
}) {
  const [points, setPoints] = useState<ZoneDraftPoint[]>(() => {
    if (!initialGeometry || initialGeometry.type !== "Polygon") return [];
    const ring = initialGeometry.coordinates[0] || [];
    const uniqueRing = ring.length > 1 ? ring.slice(0, -1) : ring;
    return uniqueRing.map(([lng, lat]) => coordToDraftPoint(lat, lng, latitude, longitude));
  });
  const canSave = points.length >= 3;
  const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ");
  const closedPoints = canSave ? `${linePoints} ${points[0].x},${points[0].y}` : linePoints;

  const addPoint = (event: MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(380, Math.max(20, ((event.clientX - rect.left) / rect.width) * 400));
    const y = Math.min(240, Math.max(20, ((event.clientY - rect.top) / rect.height) * 260));
    setPoints((current) => [...current, draftPointToCoord(x, y, latitude, longitude)]);
  };

  const save = () => {
    if (!canSave) return;
    const coordinates = points.map((point) => [point.lng, point.lat] as [number, number]);
    coordinates.push([points[0].lng, points[0].lat]);
    onSave({ type: "Polygon", coordinates: [coordinates] });
  };

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/60 px-3 py-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Draw suspected danger area">
      <section className="flex max-h-[calc(100vh-32px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_36px_90px_rgba(15,23,42,0.45)]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Map area drawing</p>
            <h2 className="mt-1 text-xl font-black tracking-[-0.03em] text-slate-950">Draw the suspected danger area</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Click around the threat boundary. CivicSignal stores this as a citizen-suspected GeoJSON polygon, not an official government zone.
            </p>
          </div>
          <button type="button" className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50" onClick={onClose} aria-label="Close drawing map">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 p-4 lg:grid-cols-[1fr_220px]">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[#dceff8] shadow-inner">
            <svg viewBox="0 0 400 260" className="h-[360px] w-full max-h-[54vh] cursor-crosshair" onClick={addPoint}>
              <defs>
                <pattern id="zone-grid" width="22" height="22" patternUnits="userSpaceOnUse">
                  <path d="M22 0H0V22" fill="none" stroke="rgba(71,85,105,0.16)" strokeWidth="1" />
                </pattern>
                <filter id="zone-shadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="7" stdDeviation="6" floodColor="rgba(15,23,42,0.18)" />
                </filter>
              </defs>
              <rect width="400" height="260" fill="#dceff8" />
              <rect width="400" height="260" fill="url(#zone-grid)" opacity="0.75" />
              <path d="M-20 194 C42 160 86 162 134 126 S236 74 430 78" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="20" strokeLinecap="round" />
              <path d="M-20 194 C42 160 86 162 134 126 S236 74 430 78" fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="10 8" opacity="0.55" />
              <path d="M40 -20 C68 54 78 98 112 134 C148 174 196 192 250 282" fill="none" stroke="rgba(255,255,255,0.72)" strokeWidth="14" strokeLinecap="round" />
              <path d="M304 -20 C284 42 288 92 320 134 C350 176 372 202 390 282" fill="none" stroke="rgba(255,255,255,0.62)" strokeWidth="10" strokeLinecap="round" />
              <g opacity="0.9">
                <rect x="34" y="34" width="54" height="34" rx="7" fill="rgba(255,255,255,0.55)" stroke="rgba(148,163,184,0.32)" />
                <rect x="252" y="150" width="72" height="42" rx="9" fill="rgba(255,255,255,0.5)" stroke="rgba(148,163,184,0.3)" />
                <rect x="146" y="38" width="48" height="54" rx="8" fill="rgba(255,255,255,0.46)" stroke="rgba(148,163,184,0.28)" />
              </g>
              <circle cx="200" cy="130" r="8" fill="#10b981" stroke="white" strokeWidth="4" filter="url(#zone-shadow)" />
              <text x="214" y="133" className="fill-slate-700 text-[10px] font-black">selected location</text>

              {canSave ? (
                <polygon points={closedPoints} fill="rgba(37,99,235,0.2)" stroke="#2563eb" strokeWidth="3" strokeLinejoin="round" filter="url(#zone-shadow)" />
              ) : null}
              {points.length > 1 ? (
                <polyline points={linePoints} fill="none" stroke="#2563eb" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
              ) : null}
              {points.map((point, index) => (
                <g key={`${point.x}-${point.y}-${index}`}>
                  <circle cx={point.x} cy={point.y} r="7" fill="#2563eb" stroke="white" strokeWidth="3" />
                  <text x={point.x + 10} y={point.y - 8} className="fill-blue-900 text-[10px] font-black">{index + 1}</text>
                </g>
              ))}
            </svg>
          </div>

          <aside className="grid content-start gap-3">
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
              <div className="flex items-center gap-2">
                <MousePointer2 className="h-4 w-4 text-blue-700" />
                <p className="text-sm font-black text-slate-950">{points.length} boundary points</p>
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Use at least 3 points. The blue line becomes the threat-area polygon attached to the report.
              </p>
            </div>
            <button type="button" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 hover:bg-slate-50" onClick={() => setPoints((current) => current.slice(0, -1))} disabled={!points.length}>
              <Undo2 className="h-4 w-4" />
              Undo point
            </button>
            <button type="button" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 hover:bg-slate-50" onClick={() => setPoints([])} disabled={!points.length}>
              <Trash2 className="h-4 w-4" />
              Clear area
            </button>
            <Button type="button" className="rounded-xl bg-[#2653da] px-4 py-3 text-white hover:bg-[#1f48c4]" onClick={save} disabled={!canSave}>
              Save blue threat area
            </Button>
          </aside>
        </div>
      </section>
    </div>
  );
}

function coordToDraftPoint(lat: number, lng: number, centerLat: number, centerLng: number): ZoneDraftPoint {
  const lngSpan = 0.009;
  const latSpan = 0.006;
  return {
    x: 200 + ((lng - centerLng) / lngSpan) * 360,
    y: 130 - ((lat - centerLat) / latSpan) * 220,
    lat,
    lng,
  };
}

function draftPointToCoord(x: number, y: number, centerLat: number, centerLng: number): ZoneDraftPoint {
  const lngSpan = 0.009;
  const latSpan = 0.006;
  return {
    x,
    y,
    lng: Number((centerLng + ((x - 200) / 360) * lngSpan).toFixed(6)),
    lat: Number((centerLat - ((y - 130) / 220) * latSpan).toFixed(6)),
  };
}

export function ReportForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const [rejection, setRejection] = useState<{
    kind: "not_a_hazard" | "image_title_mismatch";
    message: string;
    details_observed?: string;
    danger_reasoning?: string;
    explanation?: string;
    suggested_title?: string | null;
    suggested_category?: string | null;
  } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [zoneDrawerOpen, setZoneDrawerOpen] = useState(false);
  const [geocodeStatus, setGeocodeStatus] = useState<"idle" | "loading" | "found" | "failed">("idle");
  const [geocodedLabel, setGeocodedLabel] = useState<string | null>(null);
  const submitRef = useRef<HTMLButtonElement | null>(null);
  const form = useForm<ReportValues>({
    resolver: zodResolver(reportCreateSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "road_hazard",
      urgency: "watch",
      address_text: "",
      latitude: null,
      longitude: null,
      image_url: null,
      image_storage_path: null,
      user_submitted_zone: null,
      is_anonymous: false,
      agreed_to_accuracy: true,
    },
  });

  const { errors } = form.formState;
  const latitudeValue = useWatch({ control: form.control, name: "latitude" });
  const longitudeValue = useWatch({ control: form.control, name: "longitude" });
  const userZoneValue = useWatch({ control: form.control, name: "user_submitted_zone" });
  const urgencyValue = useWatch({ control: form.control, name: "urgency" });
  const descriptionValue = useWatch({ control: form.control, name: "description" });

  const selectedUrgency = URGENCY_OPTIONS.find((option) => option.value === urgencyValue) || URGENCY_OPTIONS[1];
  const validationMessages = Object.values(errors)
    .map((item) => item?.message)
    .filter((message): message is string => Boolean(message));

  useEffect(() => {
    if (submitRef.current) submitRef.current.dataset.civicClientReady = "true";
  }, []);

  const geocodeAddressText = async (address: string) => {
    const trimmed = address.trim();
    if (!trimmed) return;
    const hasCoords = typeof form.getValues("latitude") === "number" && typeof form.getValues("longitude") === "number";
    if (hasCoords) return;
    setGeocodeStatus("loading");
    try {
      const res = await fetch(`/api/geocode?query=${encodeURIComponent(trimmed)}`);
      const payload = (await res.json()) as { ok: boolean; data?: { latitude: number; longitude: number; formatted_address?: string }; error?: string };
      if (payload.ok && payload.data && Number.isFinite(payload.data.latitude) && Number.isFinite(payload.data.longitude)) {
        form.setValue("latitude", payload.data.latitude, { shouldDirty: true, shouldValidate: true });
        form.setValue("longitude", payload.data.longitude, { shouldDirty: true, shouldValidate: true });
        setGeocodedLabel(payload.data.formatted_address || trimmed);
        setGeocodeStatus("found");
      } else {
        setGeocodeStatus("failed");
      }
    } catch {
      setGeocodeStatus("failed");
    }
  };

  const useCurrentLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        form.setValue("latitude", position.coords.latitude, { shouldDirty: true, shouldValidate: true });
        form.setValue("longitude", position.coords.longitude, { shouldDirty: true, shouldValidate: true });
        setGeocodeStatus("idle");
        setGeocodedLabel(null);
      },
      () => setServerError("Location permission denied."),
    );
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError("");
    setRejection(null);

    try {
      let uploadResult: { image_url: string; image_storage_path: string; image_analysis?: unknown } | null = null;

      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("title", values.title || "");
        formData.append("description", values.description || "");
        formData.append("category", values.category || "");
        const uploadResponse = await fetch("/api/upload/report-image", {
          method: "POST",
          body: formData,
        });
        const uploadPayload = (await uploadResponse.json()) as {
          ok: boolean;
          data?: { image_url: string; image_storage_path: string; image_analysis?: unknown };
          error?: string;
        };

        if (!uploadResponse.ok || !uploadPayload.ok || !uploadPayload.data) {
          setServerError(uploadPayload.error || "Upload failed.");
          return;
        }

        uploadResult = uploadPayload.data;
      }

      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          image_url: uploadResult?.image_url || null,
          image_storage_path: uploadResult?.image_storage_path || null,
          image_analysis: uploadResult?.image_analysis || null,
        }),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        data?: ReportCardView;
        error?: string;
        code?: string;
        details_observed?: string;
        danger_reasoning?: string;
        explanation?: string;
        suggested_title?: string | null;
        suggested_category?: string | null;
      };

      if (!response.ok || !payload.ok || !payload.data) {
        if (payload.code === "not_a_hazard" || payload.code === "image_title_mismatch") {
          setRejection({
            kind: payload.code,
            message: payload.error || "Report rejected.",
            details_observed: payload.details_observed,
            danger_reasoning: payload.danger_reasoning,
            explanation: payload.explanation,
            suggested_title: payload.suggested_title,
            suggested_category: payload.suggested_category,
          });
          return;
        }
        setServerError(payload.error || "Report submit failed.");
        return;
      }

      if (!payload.data.id) {
        setServerError("Report was accepted but did not return an id. Please refresh.");
        return;
      }

      window.dispatchEvent(
        new CustomEvent("civicsignal:report-published", { detail: { id: payload.data.id } }),
      );
      router.push(`/app/reports/${payload.data.id}`);
    } catch (submitError) {
      setServerError(submitError instanceof Error ? submitError.message : "Report submit failed. Please try again.");
    }
  });

  const dismissRejection = () => {
    setRejection(null);
  };

  const acceptSuggestion = async () => {
    if (!rejection) return;
    const suggestedTitle = (rejection.suggested_title || "").trim();
    const rawCategory = (rejection.suggested_category || "").trim();
    const suggestedCategory =
      rawCategory && rawCategory in CATEGORY_CONFIG ? (rawCategory as ReportCategoryKey) : null;
    if (suggestedTitle) {
      form.setValue("title", suggestedTitle, { shouldDirty: true, shouldValidate: true });
    }
    if (suggestedCategory) {
      form.setValue("category", suggestedCategory, { shouldDirty: true, shouldValidate: true });
    }
    setRejection(null);
    await onSubmit();
  };

  const suggestedCategoryLabel = (() => {
    const key = (rejection?.suggested_category || "").trim();
    if (key && key in CATEGORY_CONFIG) return CATEGORY_CONFIG[key as ReportCategoryKey].label;
    return null;
  })();
  const hasUsableSuggestion = Boolean(
    rejection?.kind === "image_title_mismatch" &&
      (rejection?.suggested_title || rejection?.suggested_category),
  );

  return (
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={onSubmit}>
      {rejection ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="rejection-title"
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 px-4"
          onClick={dismissRejection}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-[0_36px_90px_rgba(15,23,42,0.45)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-amber-500" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600">Report not published</p>
                <h2 id="rejection-title" className="mt-1 text-lg font-black tracking-[-0.02em] text-slate-950">
                  {rejection.kind === "image_title_mismatch"
                    ? "Image doesn’t match your title or description"
                    : "This doesn’t look like a civic hazard"}
                </h2>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-700">{rejection.message}</p>
            {rejection.details_observed ? (
              <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                <span className="font-semibold text-slate-800">What the image shows: </span>
                {rejection.details_observed}
              </p>
            ) : null}
            {hasUsableSuggestion ? (
              <div className="mt-3 rounded-lg border border-blue-100 bg-[#edf5ff] px-3 py-2.5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                  Publish what the image actually shows?
                </p>
                <ul className="mt-2 grid gap-1 text-xs leading-5 text-slate-700">
                  {rejection.suggested_title ? (
                    <li>
                      <span className="font-semibold text-slate-900">Title: </span>
                      {rejection.suggested_title}
                    </li>
                  ) : null}
                  {suggestedCategoryLabel ? (
                    <li>
                      <span className="font-semibold text-slate-900">Category: </span>
                      {suggestedCategoryLabel}
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}
            <p className="mt-3 text-xs leading-5 text-slate-500">
              {rejection.kind === "image_title_mismatch"
                ? hasUsableSuggestion
                  ? "Choose Yes to apply these and publish, or No to keep editing your report."
                  : "Update the title, description, or category to match the photo — or attach a different image that shows the hazard you described — and submit again."
                : "Adjust the title, description, or attach a photo that clearly shows the hazard, then try again. Reports that do not depict a civic hazard are not added to the public map."}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              {hasUsableSuggestion ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    className="rounded-xl"
                    onClick={dismissRejection}
                  >
                    No, edit my report
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    className="rounded-xl bg-[#2653da] px-5 text-white hover:bg-[#1f48c4]"
                    onClick={() => {
                      void acceptSuggestion();
                    }}
                  >
                    Yes, publish
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="primary"
                  className="rounded-xl bg-[#2653da] px-5 text-white hover:bg-[#1f48c4]"
                  onClick={dismissRejection}
                >
                  Got it
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : null}
      {zoneDrawerOpen && typeof latitudeValue === "number" && typeof longitudeValue === "number" ? (
        <ZoneDrawModal
          latitude={latitudeValue}
          longitude={longitudeValue}
          initialGeometry={userZoneValue}
          onClose={() => setZoneDrawerOpen(false)}
          onSave={(geometry) => {
            form.setValue("user_submitted_zone", geometry, { shouldDirty: true, shouldValidate: true });
            setZoneDrawerOpen(false);
            setServerError("");
          }}
        />
      ) : null}
      <div className="civic-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Field label="Issue Title" labelClassName={labelClassName} helpClassName={helpClassName}>
              <Input
                className={fieldClassName}
                placeholder="Smoke near park entrance"
                {...form.register("title")}
              />
            </Field>
            <FieldError message={errors.title?.message} />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Field label="Category" labelClassName={labelClassName} helpClassName={helpClassName}>
              <Select className={fieldClassName} {...form.register("category")}>
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Priority Level"
              help={selectedUrgency.description}
              labelClassName={labelClassName}
              helpClassName={helpClassName}
            >
              <Select className={fieldClassName} {...form.register("urgency")}>
                {URGENCY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid gap-1.5">
            <Field label="Location" labelClassName={labelClassName} helpClassName={helpClassName}>
              <Input
                className={fieldClassName}
                placeholder="Search by intersection, corridor, or place name"
                {...form.register("address_text", {
                  onBlur: (e) => geocodeAddressText(e.target.value),
                })}
              />
            </Field>
            <FieldError message={errors.address_text?.message} />
          </div>

          <div className="grid gap-3 rounded-xl border border-emerald-100 bg-emerald-50/80 p-3 md:grid-cols-[1fr_auto] md:items-center">
            <div className="flex items-start gap-3">
              <MapPin className={`mt-1 h-4 w-4 ${geocodeStatus === "found" || (typeof latitudeValue === "number" && typeof longitudeValue === "number") ? "text-emerald-600" : geocodeStatus === "failed" ? "text-amber-500" : "text-slate-400"}`} />
              <div>
                <p className="text-sm font-semibold text-slate-950">Location confirmation</p>
                <p className="mt-1 text-sm text-slate-600">
                  {geocodeStatus === "loading"
                    ? "Looking up address…"
                    : geocodeStatus === "found" && geocodedLabel
                      ? `Found: ${geocodedLabel}`
                      : geocodeStatus === "failed"
                        ? "Address not found — try a nearby landmark, intersection, or use GPS below."
                        : typeof latitudeValue === "number" && typeof longitudeValue === "number"
                          ? `Coordinates set: ${latitudeValue.toFixed(4)}, ${longitudeValue.toFixed(4)}`
                          : "Tab out of the address field above to auto-locate, or use your GPS."}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="rounded-xl border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
              onClick={useCurrentLocation}
            >
              <LocateFixed className="h-4 w-4" />
              Use Current Location
            </Button>
          </div>

          {typeof latitudeValue === "number" && typeof longitudeValue === "number" ? (
            <div className="grid gap-3 rounded-xl border border-blue-100 bg-white p-3 shadow-sm md:grid-cols-[1.05fr_0.95fr] md:items-center">
              <div>
                <p className="text-sm font-black text-slate-950">Suspected danger range</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Open the map and draw a blue boundary around the area you think is unsafe. Police and government can later compare this with official zones.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" className="rounded-lg bg-blue-50 text-blue-800" onClick={() => setZoneDrawerOpen(true)}>
                    Open map and draw area
                  </Button>
                  {userZoneValue ? (
                    <Button
                      type="button"
                      variant="secondary"
                      className="rounded-lg"
                      onClick={() => form.setValue("user_submitted_zone", null, { shouldDirty: true, shouldValidate: true })}
                    >
                      Clear zone
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="relative min-h-[122px] overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50">
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(148,163,184,0.14)_1px,transparent_1px),linear-gradient(rgba(148,163,184,0.14)_1px,transparent_1px)] bg-[size:18px_18px]" />
                <svg viewBox="0 0 220 120" className="relative h-full w-full">
                  <path d="M28 78 C62 48 84 42 112 61 C140 80 168 43 196 32" fill="none" stroke="#94a3b8" strokeWidth="7" strokeLinecap="round" opacity="0.35" />
                  <path d="M28 78 C62 48 84 42 112 61 C140 80 168 43 196 32" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" opacity="0.65" />
                  {userZoneValue ? (
                    <polygon points="54,76 88,30 164,43 176,92 54,76" fill="rgba(37,99,235,0.18)" stroke="#2563eb" strokeWidth="2.5" strokeLinejoin="round" />
                  ) : (
                    <circle cx="112" cy="61" r="10" fill="#10b981" stroke="white" strokeWidth="3" />
                  )}
                  <text x="12" y="18" className="fill-slate-500 text-[10px] font-bold">
                    {userZoneValue ? "Citizen suspected zone attached" : "Location set · draw zone optional"}
                  </text>
                </svg>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="grid gap-1.5">
              <Field
                label="Detailed Description"
                help={`${descriptionValue?.length || 0} / 2000 characters`}
                labelClassName={labelClassName}
                helpClassName={helpClassName}
              >
                <Textarea
                  className={`${fieldClassName} min-h-[116px]`}
                  placeholder="Describe what you observed, when you saw it, and any immediate safety impacts."
                  {...form.register("description")}
                />
              </Field>
              <FieldError message={errors.description?.message} />
            </div>

            <Field
              label="Photo or Screenshot Evidence"
              help="Images only. AI evidence review compares the image against your title and description."
              labelClassName={labelClassName}
              helpClassName={helpClassName}
            >
              <label className="flex min-h-[116px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-center transition hover:border-blue-300 hover:bg-blue-50/40">
                <Upload className="h-6 w-6 text-blue-700" />
                <p className="mt-2 text-sm font-semibold text-slate-950">{selectedFile ? selectedFile.name : "Upload image"}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {selectedFile ? "File ready for evidence review." : "PNG, JPG, WEBP."}
                </p>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                />
              </label>
            </Field>
          </div>

          <details className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <summary className="cursor-pointer text-sm font-semibold text-slate-700">Manual coordinates</summary>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="grid gap-1.5">
                <Field label="Latitude" labelClassName={labelClassName} helpClassName={helpClassName}>
                  <Input
                    className={fieldClassName}
                    type="number"
                    step="any"
                    value={latitudeValue ?? ""}
                    onChange={(event) => form.setValue("latitude", event.target.value ? Number(event.target.value) : null, { shouldDirty: true, shouldValidate: true })}
                  />
                </Field>
                <FieldError message={errors.latitude?.message} />
              </div>
              <div className="grid gap-1.5">
                <Field label="Longitude" labelClassName={labelClassName} helpClassName={helpClassName}>
                  <Input
                    className={fieldClassName}
                    type="number"
                    step="any"
                    value={longitudeValue ?? ""}
                    onChange={(event) => form.setValue("longitude", event.target.value ? Number(event.target.value) : null, { shouldDirty: true, shouldValidate: true })}
                  />
                </Field>
                <FieldError message={errors.longitude?.message} />
              </div>
            </div>
          </details>

          <div className="grid gap-3 lg:grid-cols-2">
            <label className={`flex items-start gap-3 ${checkboxPanelClassName}`}>
              <input type="checkbox" className="mt-1" {...form.register("is_anonymous")} />
              <span>Show my report anonymously while still preserving trust and moderation history internally.</span>
            </label>
            <div className="grid gap-1">
              <label className={`flex items-start gap-3 ${checkboxPanelClassName}`}>
                <input type="checkbox" className="mt-1" {...form.register("agreed_to_accuracy")} />
                <span>I understand false or harmful reports may be removed and routed to moderation review.</span>
              </label>
              <FieldError message={errors.agreed_to_accuracy ? "You must accept this before submitting." : undefined} />
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-[#edf5ff] px-3 py-2.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
            <p className="text-xs leading-5 text-slate-600">
              CivicSignal validates, scores, checks moderation, runs evidence review when an image is attached, and links this place-based report into the live risk map.
            </p>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-3">
        {validationMessages.length ? (
          <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <p className="font-bold">Fix these before submitting:</p>
            <ul className="mt-1 list-inside list-disc">
              {validationMessages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {serverError ? (
          <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{serverError}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            ref={submitRef}
            type="submit"
            disabled={form.formState.isSubmitting}
            data-civic-client-ready="false"
            className="rounded-xl bg-[#2653da] px-6 py-3 text-white hover:bg-[#1f48c4]"
          >
            {form.formState.isSubmitting ? "Submitting..." : "Submit Report"}
          </Button>
          <p className="text-xs leading-5 text-slate-500">
            Email stays private. Public visibility depends on confidence and moderation status.
          </p>
        </div>
      </div>
    </form>
  );
}
