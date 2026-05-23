"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LocateFixed, MapPin, ShieldCheck, Upload } from "lucide-react";
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

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs font-medium text-red-600">{message}</p>;
}

export function ReportForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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

  const { errors } = form.formState;
  const latitudeValue = useWatch({ control: form.control, name: "latitude" });
  const longitudeValue = useWatch({ control: form.control, name: "longitude" });
  const urgencyValue = useWatch({ control: form.control, name: "urgency" });
  const descriptionValue = useWatch({ control: form.control, name: "description" });

  const selectedUrgency = URGENCY_OPTIONS.find((option) => option.value === urgencyValue) || URGENCY_OPTIONS[1];
  const validationMessages = Object.values(errors)
    .map((item) => item?.message)
    .filter((message): message is string => Boolean(message));

  useEffect(() => {
    if (submitRef.current) submitRef.current.dataset.civicClientReady = "true";
  }, []);

  const useCurrentLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        form.setValue("latitude", position.coords.latitude, { shouldDirty: true, shouldValidate: true });
        form.setValue("longitude", position.coords.longitude, { shouldDirty: true, shouldValidate: true });
      },
      () => setServerError("Location permission denied."),
    );
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError("");

    try {
      let uploadResult: { image_url: string; image_storage_path: string; image_analysis?: unknown } | null = null;

      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
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
      const payload = (await response.json()) as { ok: boolean; data?: ReportCardView; error?: string };

      if (!response.ok || !payload.ok || !payload.data) {
        setServerError(payload.error || "Report submit failed.");
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

  return (
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={onSubmit}>
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

          <Field label="Location" labelClassName={labelClassName} helpClassName={helpClassName}>
            <Input
              className={fieldClassName}
              placeholder="Search by intersection, corridor, or place name"
              {...form.register("address_text")}
            />
          </Field>

          <div className="grid gap-3 rounded-xl border border-emerald-100 bg-emerald-50/80 p-3 md:grid-cols-[1fr_auto] md:items-center">
            <div className="flex items-start gap-3">
              <MapPin className="mt-1 h-4 w-4 text-emerald-600" />
              <div>
                <p className="text-sm font-semibold text-slate-950">Location confirmation</p>
                <p className="mt-1 text-sm text-slate-600">
                  {typeof latitudeValue === "number" && typeof longitudeValue === "number"
                    ? `Coordinates captured: ${latitudeValue.toFixed(4)}, ${longitudeValue.toFixed(4)}`
                    : "Add an address above, use your current location, or enter coordinates manually."}
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
              <Field label="Latitude" labelClassName={labelClassName} helpClassName={helpClassName}>
                <Input
                  className={fieldClassName}
                  type="number"
                  step="any"
                  value={latitudeValue ?? ""}
                  onChange={(event) => form.setValue("latitude", event.target.value ? Number(event.target.value) : null, { shouldDirty: true, shouldValidate: true })}
                />
              </Field>
              <Field label="Longitude" labelClassName={labelClassName} helpClassName={helpClassName}>
                <Input
                  className={fieldClassName}
                  type="number"
                  step="any"
                  value={longitudeValue ?? ""}
                  onChange={(event) => form.setValue("longitude", event.target.value ? Number(event.target.value) : null, { shouldDirty: true, shouldValidate: true })}
                />
              </Field>
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
