import type {
  ClusterVoteType,
  ConfidenceLabel,
  ReportCategoryKey,
  ReportStatus,
  ReportVoteType,
  RiskClusterStatus,
  RiskLevel,
  SourceType,
  UserRole,
} from "@/lib/types";

export const APP_NAME = "CivicSignal";
export const APP_TAGLINE = "A live hazard map built from citizen reports, evidence, and public verification.";
export const APP_DESCRIPTION =
  "CivicSignal lets residents publish place-based hazard reports with a title, location, description, and photo or screenshot evidence, then turns those reports into a live map that helps people avoid unsafe areas and helps civic responders act faster.";

export const APP_ENV_DEFAULT = "development";
export const DEMO_SESSION_COOKIE = "civicsignal_session";
export const SUPABASE_STORAGE_BUCKET = "civicsignal-report-images";
export const DEMO_STATE_PATH = ".demo-storage/demo-state.json";
export const DEMO_IMAGE_DIR = ".demo-storage/report-images";
export const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const DEFAULT_COORDS = {
  lat: 37.7749,
  lng: -122.4194,
  city: "San Francisco Bay Area",
};

export const RISK_LEVELS: RiskLevel[] = ["low", "watch", "serious", "urgent"];
export const REPORT_STATUSES: ReportStatus[] = [
  "active",
  "needs_review",
  "verified",
  "resolved",
  "hidden",
  "false_alarm",
  "duplicate",
];
export const CLUSTER_STATUSES: RiskClusterStatus[] = [
  "active",
  "monitoring",
  "urgent",
  "resolved",
  "hidden",
  "false_alarm",
];
export const REPORT_VOTE_TYPES: ReportVoteType[] = ["confirm", "dispute", "resolved", "duplicate"];
export const CLUSTER_VOTE_TYPES: ClusterVoteType[] = ["confirm", "dispute", "resolved", "monitor"];
export const SOURCE_TYPES: SourceType[] = ["rss", "city_alert", "weather", "traffic", "news_api", "manual", "other"];
export const USER_ROLES: UserRole[] = ["user", "moderator", "admin"];

export const NAV_ITEMS = [
  { href: "/app/map", label: "Live Map" },
  { href: "/app/submit", label: "Submit Report" },
  { href: "/app/board", label: "Priority Board" },
  { href: "/app/analytics", label: "Analytics" },
];

export const ADMIN_NAV_ITEMS = [
  { href: "/app/admin/review", label: "Review Queue", roles: ["moderator", "admin"] as UserRole[] },
  { href: "/app/admin/sources", label: "Source Feeds", roles: ["admin"] as UserRole[] },
  { href: "/app/admin/users", label: "Users", roles: ["admin"] as UserRole[] },
];

export const GUEST_NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/app/map", label: "Live Map" },
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/app/submit", label: "Submit Report" },
];

export const CATEGORY_CONFIG: Record<
  ReportCategoryKey,
  {
    label: string;
    icon: string;
    color: string;
    base_severity: number;
    cluster_radius_meters: number;
    related: ReportCategoryKey[];
    long_window_hours?: number;
  }
> = {
  road_hazard: { label: "Road Hazard", icon: "triangle-alert", color: "var(--watch)", base_severity: 25, cluster_radius_meters: 300, related: ["pothole", "traffic_obstruction"] },
  pothole: { label: "Pothole", icon: "circle-dot", color: "var(--watch)", base_severity: 20, cluster_radius_meters: 300, related: ["road_hazard", "traffic_obstruction"], long_window_hours: 168 },
  traffic_obstruction: { label: "Traffic Obstruction", icon: "cone", color: "var(--serious)", base_severity: 35, cluster_radius_meters: 300, related: ["road_hazard", "pothole", "fallen_tree"] },
  flooding: { label: "Flooding", icon: "waves", color: "var(--serious)", base_severity: 40, cluster_radius_meters: 500, related: ["weather_damage"] },
  fire_smoke: { label: "Fire / Smoke", icon: "flame", color: "var(--urgent)", base_severity: 45, cluster_radius_meters: 500, related: ["weather_damage"] },
  power_outage: { label: "Power Outage", icon: "zap", color: "var(--watch)", base_severity: 25, cluster_radius_meters: 350, related: ["weather_damage"] },
  broken_streetlight: { label: "Broken Streetlight", icon: "lamp", color: "var(--watch)", base_severity: 15, cluster_radius_meters: 250, related: ["unsafe_sidewalk"], long_window_hours: 168 },
  trash_sanitation: { label: "Trash / Sanitation", icon: "trash", color: "var(--watch)", base_severity: 10, cluster_radius_meters: 250, related: ["unsafe_sidewalk"] },
  unsafe_sidewalk: { label: "Unsafe Sidewalk", icon: "footprints", color: "var(--watch)", base_severity: 20, cluster_radius_meters: 250, related: ["fallen_tree", "trash_sanitation", "broken_streetlight"] },
  fallen_tree: { label: "Fallen Tree", icon: "tree-pine", color: "var(--serious)", base_severity: 30, cluster_radius_meters: 350, related: ["traffic_obstruction", "unsafe_sidewalk", "weather_damage"] },
  building_structure_concern: { label: "Building / Structure Concern", icon: "building-2", color: "var(--serious)", base_severity: 35, cluster_radius_meters: 250, related: [] },
  public_event_crowding: { label: "Public Event Crowding", icon: "users", color: "var(--serious)", base_severity: 30, cluster_radius_meters: 350, related: ["crowd_safety"] },
  school_area_concern: { label: "School Area Concern", icon: "school", color: "var(--serious)", base_severity: 25, cluster_radius_meters: 300, related: ["unauthorized_vending", "crowd_safety", "road_hazard", "unsafe_sidewalk"] },
  public_disturbance: { label: "Public Disturbance", icon: "message-alert", color: "var(--serious)", base_severity: 35, cluster_radius_meters: 300, related: ["crowd_safety", "school_area_concern"] },
  unauthorized_vending: { label: "Unauthorized Vending Concern", icon: "store", color: "var(--watch)", base_severity: 20, cluster_radius_meters: 250, related: ["school_area_concern", "crowd_safety"] },
  crowd_safety: { label: "Crowd Safety", icon: "users-round", color: "var(--serious)", base_severity: 30, cluster_radius_meters: 350, related: ["public_event_crowding", "school_area_concern", "public_disturbance", "traffic_obstruction"] },
  weather_damage: { label: "Weather Damage", icon: "cloud-rain-wind", color: "var(--serious)", base_severity: 30, cluster_radius_meters: 500, related: ["flooding", "fallen_tree", "power_outage", "fire_smoke"] },
  other: { label: "Other", icon: "map-pin", color: "var(--hidden)", base_severity: 10, cluster_radius_meters: 250, related: [] },
};

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_CONFIG).map(([value, config]) => ({
  value: value as ReportCategoryKey,
  label: config.label,
}));

export const URGENCY_OPTIONS = [
  { value: "low", label: "Low", description: "Should be fixed eventually." },
  { value: "watch", label: "Watch", description: "Could become a problem." },
  { value: "serious", label: "Serious", description: "Needs attention soon." },
  { value: "urgent", label: "Urgent", description: "Immediate safety concern." },
] as const;

export const RISK_SCORE_THRESHOLDS = {
  low: [0, 24],
  watch: [25, 49],
  serious: [50, 74],
  urgent: [75, 100],
} as const;

export const CONFIDENCE_LABELS: { min: number; label: ConfidenceLabel }[] = [
  { min: 85, label: "very_high" },
  { min: 70, label: "high" },
  { min: 50, label: "medium" },
  { min: 25, label: "low" },
  { min: 0, label: "very_low" },
];

export const REPORT_SCORING = {
  urgency_bonus: { low: 5, watch: 15, serious: 30, urgent: 45 },
  bonuses: {
    image: 8,
    description: 5,
    specific_location: 8,
    nearby_report: 8,
    nearby_report_cap: 24,
    related_signal: 6,
    related_signal_cap: 18,
    official_source: 15,
    weather_signal: 10,
    traffic_signal: 10,
    recent_hour: 12,
    recent_six_hours: 8,
    recent_day: 4,
    confirmation: 4,
    confirmation_cap: 20,
    high_trust: 5,
  },
  penalties: {
    dispute: 6,
    dispute_cap: 24,
    resolved_threshold: 20,
    older_than_week: 20,
    older_than_month: 40,
    vague_location: 10,
    no_detail: 5,
  },
  confidence: {
    specific_location: 20,
    detail: 10,
    image: 15,
    multiple_reports: 20,
    trusted_source: 20,
    recent: 10,
    high_trust: 10,
    confirmed: 15,
    matched_signal: 15,
  },
};

export const CATEGORY_KEYWORDS: Record<ReportCategoryKey, string[]> = {
  fire_smoke: ["smoke", "fire", "flames", "burning", "wildfire", "evacuation", "smell of smoke"],
  flooding: ["flood", "flooding", "water over road", "storm drain", "heavy rain", "flash flood"],
  traffic_obstruction: ["crash", "accident", "road closed", "closure", "blocked", "collision", "lane closed"],
  power_outage: ["outage", "power line", "electricity", "transformer", "blackout"],
  weather_damage: ["storm", "wind", "warning", "advisory", "lightning", "hail", "heat"],
  road_hazard: ["road hazard", "debris", "unsafe road"],
  pothole: ["pothole", "road damage"],
  broken_streetlight: ["streetlight", "lamp out", "dark crosswalk"],
  trash_sanitation: ["trash", "garbage", "waste", "spill", "illegal dumping"],
  unsafe_sidewalk: ["sidewalk", "crosswalk", "walkway", "pedestrian"],
  fallen_tree: ["fallen tree", "tree branch", "branch blocking"],
  building_structure_concern: ["damaged", "broken", "collapse", "cracked", "structure"],
  public_event_crowding: ["crowd", "overcrowded", "blocked exit", "large gathering"],
  school_area_concern: ["school", "pickup zone", "drop-off", "student route", "playground", "campus walkway"],
  public_disturbance: ["fight", "shouting", "disturbance", "unsafe gathering", "public conflict", "altercation"],
  unauthorized_vending: ["vape", "vapes", "selling", "unpermitted vending", "vendor", "near school"],
  crowd_safety: ["crowd", "blocked entrance", "blocked exit", "event overflow", "congestion", "line blocking"],
  other: [],
};

export const DEMO_PERSONAS = [
  { id: "8bdf0d13-6e34-46ab-8601-1f4d5ef90001", label: "Demo Resident", email: "resident@civicsignal.demo", password: "demo-resident", role: "user" as UserRole },
  { id: "8bdf0d13-6e34-46ab-8601-1f4d5ef90002", label: "Demo Moderator", email: "moderator@civicsignal.demo", password: "demo-moderator", role: "moderator" as UserRole },
  { id: "8bdf0d13-6e34-46ab-8601-1f4d5ef90003", label: "Demo Admin", email: "admin@civicsignal.demo", password: "demo-admin", role: "admin" as UserRole },
];
