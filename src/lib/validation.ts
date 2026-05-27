import { z } from "zod";

import { CATEGORY_OPTIONS, CLUSTER_VOTE_TYPES, REPORT_STATUSES, REPORT_VOTE_TYPES, SOURCE_TYPES, URGENCY_OPTIONS } from "@/lib/constants";
import { EVENT_NAMES } from "@/lib/events/types";

const geoJsonPositionSchema = z.array(z.number()).min(2).max(3);
const geoJsonGeometrySchema = z.union([
  z.object({ type: z.literal("Point"), coordinates: geoJsonPositionSchema }),
  z.object({ type: z.literal("LineString"), coordinates: z.array(geoJsonPositionSchema).min(2) }),
  z.object({ type: z.literal("Polygon"), coordinates: z.array(z.array(geoJsonPositionSchema).min(4)).min(1) }),
  z.object({ type: z.literal("MultiPolygon"), coordinates: z.array(z.array(z.array(geoJsonPositionSchema).min(4)).min(1)).min(1) }),
]);

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  demo_profile_id: z.string().uuid().optional(),
});

export const signupSchema = z.object({
  display_name: z.string().min(2).max(60),
  email: z.string().email(),
  password: z.string().min(8),
  home_city: z.string().max(80).optional().or(z.literal("")),
  agreed_to_safety: z.literal(true),
});

export const reportCreateSchema = z
  .object({
    title: z.string().min(4).max(120),
    description: z.string().min(12).max(2000),
    category: z.enum(CATEGORY_OPTIONS.map((item) => item.value) as [string, ...string[]]),
    urgency: z.enum(URGENCY_OPTIONS.map((item) => item.value) as [string, ...string[]]),
    address_text: z.string().max(160).optional().nullable(),
    latitude: z.number().min(-90).max(90).optional().nullable(),
    longitude: z.number().min(-180).max(180).optional().nullable(),
    image_url: z.string().optional().nullable(),
    image_storage_path: z.string().optional().nullable(),
    user_submitted_zone: geoJsonGeometrySchema.optional().nullable(),
    is_anonymous: z.boolean().default(false),
    agreed_to_accuracy: z.literal(true),
    image_analysis: z.object({}).passthrough().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const hasLat = typeof data.latitude === "number";
    const hasLng = typeof data.longitude === "number";
    const hasAddress = typeof data.address_text === "string" && data.address_text.trim().length > 0;

    if (hasLat && !hasLng) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Longitude is required when latitude is set.", path: ["longitude"] });
    }
    if (hasLng && !hasLat) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Latitude is required when longitude is set.", path: ["latitude"] });
    }
    if (!hasAddress && !(hasLat && hasLng)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter an address or use your current location.", path: ["address_text"] });
    }
  });

export const reportPatchSchema = z.object({
  status: z.enum(REPORT_STATUSES).optional(),
  title: z.string().min(4).max(120).optional(),
  description: z.string().min(12).max(2000).optional(),
  category: z.enum(CATEGORY_OPTIONS.map((item) => item.value) as [string, ...string[]]).optional(),
  urgency: z.enum(URGENCY_OPTIONS.map((item) => item.value) as [string, ...string[]]).optional(),
  is_locked: z.boolean().optional(),
});

export const reportVoteSchema = z.object({
  vote_type: z.enum(REPORT_VOTE_TYPES),
  comment: z.string().max(300).optional().nullable(),
});

export const clusterVoteSchema = z.object({
  vote_type: z.enum(CLUSTER_VOTE_TYPES),
  comment: z.string().max(300).optional().nullable(),
});

export const reportUpdateSchema = z.object({
  text: z.string().min(3).max(600),
  update_type: z.enum(["comment", "admin_note", "resolved"]),
});

export const sourceFeedSchema = z.object({
  name: z.string().min(2).max(80),
  url: z.string().url(),
  source_type: z.enum(SOURCE_TYPES),
  default_city: z.string().max(80).optional().nullable(),
  default_latitude: z.number().min(-90).max(90).optional().nullable(),
  default_longitude: z.number().min(-180).max(180).optional().nullable(),
  trust_level: z.number().int().min(0).max(100).default(50),
  keywords: z.array(z.string()).default([]),
  is_active: z.boolean().default(true),
});

export const manualSignalSchema = z.object({
  title: z.string().min(4).max(160),
  text: z.string().max(2000).optional().nullable(),
  source_name: z.string().min(2).max(80),
  source_type: z.enum(SOURCE_TYPES),
  source_url: z.string().url().optional().nullable(),
  category: z.enum(CATEGORY_OPTIONS.map((item) => item.value) as [string, ...string[]]),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  address_text: z.string().max(160).optional().nullable(),
  published_at: z.string().datetime().optional().nullable(),
});

const csvParamSchema = z
  .string()
  .optional()
  .transform((value) =>
    value
      ? value
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean)
      : [],
  );

export const eventStreamQuerySchema = z.object({
  types: csvParamSchema.pipe(z.array(z.enum(EVENT_NAMES))).default([]),
  categories: csvParamSchema.pipe(z.array(z.string().min(1))).default([]),
  roles: csvParamSchema.pipe(z.array(z.string().min(1))).default([]),
});
