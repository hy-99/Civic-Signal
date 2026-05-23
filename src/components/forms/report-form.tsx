"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, LocateFixed, MapPin, ShieldCheck, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { CATEGORY_OPTIONS, URGENCY_OPTIONS } from "@/lib/constants";
import type { ReportCardView } from "@/lib/types";
import { reportCreateSchema } from "@/lib/validation";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/primitives";

type ReportValues = z.input<typeof reportCreateSchema>;

const fieldClassName = "civic-light-input rounded-xl px-4 py-2.5 text-slate-950 placeholder:text-slate-400";
const checkboxPanelClassName = "rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600";
const labelClassName = "text-slate-900";
const helpClassName = "text-slate-500";

export function ReportForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [successReport, setSuccessReport] = useState<ReportCardView | null>(null);
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
      is_anonymous: false,
      agreed_to_accuracy: true,
    },
  });

  const latitudeValue = useWatch({ control: form.control, name: "latitude" });
  const longitudeValue = useWatch({ control: form.control, name: "longitude" });
  const urgencyValue = useWatch({ control: form.control, name: "urgency" });
  const descriptionValue = useWatch({ control: form.control, name: "description" });

  const selectedUrgency = URGENCY_OPTIONS.find((option) => option.value === urgencyValue) || URGENCY_OPTIONS[1];

  useEffect(() => {
    if (submitRef.current) submitRef.current.dataset.civicClientReady = "true";
  }, []);

  const useCurrentLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        form.setValue("latitude", position.coords.latitude);
        form.setValue("longitude", position.coords.longitude);
      },
      () => setError("Location permission denied."),
    );
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setError("");
    let uploadResult: { image_url: string; image_storage_path: string } | null = null;

    if (selectedFile) {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const uploadResponse = await fetch("/api/upload/report-image", {
        method: "POST",
        body: formData,
      });
      const uploadPayload = (await uploadResponse.json()) as {
        ok: boolean;
        data?: { image_url: string; image_storage_path: string };
        error?: string;
      };
      if (!uploadPayload.ok || !uploadPayload.data) {
        setError(uploadPayload.error || "Upload failed.");
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
      }),
    });
    const payload = (await response.json()) as { ok: boolean; data?: ReportCardView; error?: string };
    if (!payload.ok || !payload.data) {
      setError(payload.error || "Report submit failed.");
      return;
    }
    setSuccessReport(payload.data);
    form.reset();
    setSelectedFile(null);
    router.refresh();
  });

  if (successReport) {
    return (
      <div className="grid gap-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-emerald-600 p-2 text-white">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-xl font-black tracking-[-0.03em] text-slate-950">Report submitted</h3>
            <p className="mt-2 text-sm leading-7 text-slate-700">
              CivicSignal scored the report, checked moderation rules, and linked it to nearby civic risk context.
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Risk score</p>
            <p className="mt-1 text-2xl font-black text-slate-950">{successReport.risk_score}</p>
          </div>
          <div className="rounded-xl bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Confidence</p>
            <p className="mt-1 text-2xl font-black text-slate-950">{successReport.confidence_score}</p>
          </div>
          <div className="rounded-xl bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Status</p>
            <p className="mt-1 text-lg font-black capitalize text-slate-950">{successReport.status.replace(/_/g, " ")}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href={`/app/reports/${successReport.id}`}>
            <Button type="button">View Report</Button>
          </Link>
          <Link href="/app/map">
            <Button type="button" variant="secondary">View on Map</Button>
          </Link>
          <Button type="button" variant="ghost" onClick={() => setSuccessReport(null)}>
            Submit Another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form className="grid gap-3" onSubmit={onSubmit}>
      <div className="grid gap-3">
        <Field label="Issue Title" labelClassName={labelClassName} helpClassName={helpClassName}>
          <Input className={fieldClassName} placeholder="Smoke near park entrance" {...form.register("title")} />
        </Field>
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

      <Field label="Location" labelClassName={labelClassName} helpClassName={helpClassName}>
        <Input className={fieldClassName} placeholder="Search by intersection, corridor, or place name" {...form.register("address_text")} />
      </Field>

      <div className="grid gap-3 rounded-xl border border-emerald-100 bg-emerald-50/80 p-3 md:grid-cols-[1fr_auto] md:items-center">
        <div className="flex items-start gap-3">
          <MapPin className="mt-1 h-4 w-4 text-emerald-600" />
          <div>
            <p className="text-sm font-semibold text-slate-950">Location confirmation</p>
            <p className="mt-1 text-sm text-slate-600">
              {typeof latitudeValue === "number" && typeof longitudeValue === "number"
                ? `Coordinates captured: ${latitudeValue.toFixed(4)}, ${longitudeValue.toFixed(4)}`
                : "Add an address, use current location, or enter coordinates manually."}
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

      <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
        <Field
          label="Detailed Description"
          help={`${descriptionValue?.length || 0} characters entered`}
          labelClassName={labelClassName}
          helpClassName={helpClassName}
        >
          <Textarea
            className={`${fieldClassName} min-h-[116px]`}
            placeholder="Describe what you observed, when you saw it, and any immediate safety impacts."
            {...form.register("description")}
          />
        </Field>

        <Field
          label="Photo or Screenshot Evidence"
          help="Images only. Add a clear photo or screenshot of the hazard."
          labelClassName={labelClassName}
          helpClassName={helpClassName}
        >
          <label className="flex min-h-[116px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-center transition hover:border-blue-300 hover:bg-blue-50/40">
            <Upload className="h-6 w-6 text-blue-700" />
            <p className="mt-2 text-sm font-semibold text-slate-950">{selectedFile ? selectedFile.name : "Upload image"}</p>
            <p className="mt-1 text-xs text-slate-500">
              {selectedFile ? "File ready." : "PNG, JPG, WEBP."}
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
          <Field label="Latitude" labelClassName={labelClassName} helpClassName={helpClassName}>
            <Input
              className={fieldClassName}
              type="number"
              step="any"
              value={latitudeValue ?? ""}
              onChange={(event) => form.setValue("latitude", event.target.value ? Number(event.target.value) : null)}
            />
          </Field>
          <Field label="Longitude" labelClassName={labelClassName} helpClassName={helpClassName}>
            <Input
              className={fieldClassName}
              type="number"
              step="any"
              value={longitudeValue ?? ""}
              onChange={(event) => form.setValue("longitude", event.target.value ? Number(event.target.value) : null)}
            />
          </Field>
        </div>
      </details>

      <div className="grid gap-3 lg:grid-cols-2">
        <label className={`flex items-start gap-3 ${checkboxPanelClassName}`}>
          <input type="checkbox" className="mt-1" {...form.register("is_anonymous")} />
          <span>Show my report anonymously while still preserving trust and moderation history internally.</span>
        </label>
        <label className={`flex items-start gap-3 ${checkboxPanelClassName}`}>
          <input type="checkbox" className="mt-1" {...form.register("agreed_to_accuracy")} />
          <span>I understand false or harmful reports may be removed and routed to moderation review.</span>
        </label>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-[#edf5ff] px-3 py-2.5">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
        <p className="text-xs leading-5 text-slate-600">
          CivicSignal validates, scores, checks moderation, and links this place-based report into the live risk map.
        </p>
      </div>

      {error ? <p className="rounded-[1.2rem] bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      <div className="sticky bottom-0 -mx-5 mt-1 flex flex-wrap items-center gap-3 border-t border-slate-200 bg-white/95 px-5 py-3 backdrop-blur">
        <Button ref={submitRef} type="submit" disabled={form.formState.isSubmitting} data-civic-client-ready="false" className="rounded-xl bg-[#2653da] px-6 py-3 text-white hover:bg-[#1f48c4]">
          {form.formState.isSubmitting ? "Submitting..." : "Submit Report"}
        </Button>
        <p className="text-xs leading-5 text-slate-500">Email stays private. Public visibility depends on confidence and moderation status.</p>
      </div>
    </form>
  );
}
