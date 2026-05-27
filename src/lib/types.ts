export type UserRole = "user" | "moderator" | "admin";
export type CaseOpsRoleMode = "citizen" | "police" | "government" | "moderator" | "responder";
export type CaseOwnerRole =
  | "moderator"
  | "government"
  | "responder"
  | "police"
  | "fire_ems"
  | "public_works"
  | "sanitation"
  | "campus_safety"
  | "system";
export type HazardType =
  | "fire_smoke"
  | "flooding"
  | "storm_weather"
  | "tsunami"
  | "earthquake_damage"
  | "road_blockage"
  | "infrastructure_damage"
  | "medical_emergency"
  | "violence_threat"
  | "public_disturbance"
  | "crowd_risk"
  | "school_area_concern"
  | "unauthorized_vending"
  | "hazardous_material"
  | "sanitation"
  | "other";
export type ReportStatus =
  | "submitted"
  | "ai_triaged"
  | "held_for_review"
  | "public"
  | "rejected"
  | "attached_to_case"
  | "active"
  | "needs_review"
  | "verified"
  | "in_progress"
  | "resolved"
  | "hidden"
  | "false_alarm"
  | "duplicate";
export type PublicSignalStatus =
  | "new"
  | "scanned"
  | "relevant"
  | "attached_to_cluster"
  | "attached_to_case"
  | "unmatched"
  | "matched"
  | "ignored"
  | "needs_review"
  | "hidden";
export type RiskClusterStatus =
  | "active"
  | "monitoring"
  | "needs_review"
  | "in_progress"
  | "verified"
  | "urgent"
  | "resolved"
  | "hidden"
  | "false_alarm"
  | "merged";
export type IncidentCaseStatus =
  | "intake"
  | "triage"
  | "ai_triaged"
  | "human_review"
  | "assigned"
  | "field_verification"
  | "active_response"
  | "public_alert_pending"
  | "public_alert_active"
  | "monitoring"
  | "resolved"
  | "rejected"
  | "false_alarm"
  | "duplicate"
  | "escalated";
export type DangerZoneType =
  | "user_suspected_zone"
  | "ai_suggested_zone"
  | "official_active_zone"
  | "official_predicted_zone"
  | "safe_zone"
  | "evacuation_route"
  | "road_closure"
  | "shelter_area";
export type CaseEventActorType =
  | "citizen"
  | "ai"
  | "moderator"
  | "government"
  | "responder"
  | "police"
  | "fire_ems"
  | "public_works"
  | "system"
  | "uipath";
export type CaseEventAction =
  | "report_submitted"
  | "ai_triage_completed"
  | "title_suggested"
  | "zone_submitted"
  | "ai_zone_suggested"
  | "moderator_reviewed"
  | "case_created"
  | "report_attached_to_case"
  | "cluster_attached_to_case"
  | "duplicate_merged"
  | "assigned_to_owner"
  | "public_alert_drafted"
  | "public_alert_approved"
  | "danger_zone_changed"
  | "predicted_zone_changed"
  | "responder_accepted"
  | "field_verified"
  | "resolved"
  | "rejected"
  | "false_alarm"
  | "escalated"
  | "uipath_sync_event";
export type RiskLevel = "low" | "watch" | "serious" | "urgent";
export type ConfidenceLabel = "very_low" | "low" | "medium" | "high" | "very_high";
export type SourceType = "rss" | "city_alert" | "weather" | "traffic" | "news_api" | "manual" | "usgs" | "nws" | "open_meteo" | "other";
export type ReportVoteType = "confirm" | "dispute" | "resolved" | "duplicate";
export type ClusterVoteType = "confirm" | "dispute" | "resolved" | "monitor";
export type UpdateType = "comment" | "status_change" | "image_added" | "admin_note" | "system_analysis" | "merged" | "resolved" | "vote" | "public_signal_matched";
export type ModerationFlag = "personal_accusation" | "private_information" | "harassment" | "possible_spam" | "vague_urgent_report" | "unsafe_claim" | "duplicate_suspected" | "image_review_needed";
export type ReportCategoryKey =
  | "road_hazard"
  | "pothole"
  | "traffic_obstruction"
  | "flooding"
  | "fire_smoke"
  | "power_outage"
  | "broken_streetlight"
  | "trash_sanitation"
  | "unsafe_sidewalk"
  | "fallen_tree"
  | "building_structure_concern"
  | "public_event_crowding"
  | "school_area_concern"
  | "public_disturbance"
  | "unauthorized_vending"
  | "crowd_safety"
  | "weather_damage"
  | "other";

export interface ScoreFactor {
  label: string;
  value: number;
  type: "bonus" | "penalty" | "base";
  note?: string;
}

export interface ScoreBreakdown {
  risk_score: number;
  confidence_score: number;
  risk_level: RiskLevel;
  confidence_label: ConfidenceLabel;
  risk_factors: ScoreFactor[];
  confidence_factors: ScoreFactor[];
  risk_reason: string;
  confidence_reason: string;
  recommended_action: string;
}

export interface ImageAnalysisResult {
  confirms_hazard: boolean;
  severity_estimate: RiskLevel;
  danger_score: number;
  danger_reasoning: string;
  danger_factors: string[];
  evidence_score: number;
  score_reasoning: string;
  details_observed: string;
  authenticity_flag: "likely_authentic" | "possibly_edited" | "unclear";
  pii_detected: boolean;
  pii_types: string[];
  recommended_action: string;
  matches_claim?: boolean;
  claim_mismatch_reason?: string;
  suggested_title?: string;
  suggested_category?: ReportCategoryKey;
}

export interface AnalysisJson {
  score_breakdown: ScoreBreakdown;
  moderation_flags: ModerationFlag[];
  extracted_location_text?: string | null;
  source_confidence?: number;
  matching_summary?: string;
  image_analysis?: ImageAnalysisResult | null;
}

export interface VoteSummary {
  confirm: number;
  dispute: number;
  resolved: number;
  duplicate?: number;
  monitor?: number;
}

export interface Profile {
  id: string;
  display_name: string;
  username: string;
  role: UserRole;
  trust_score: number;
  home_city: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  demo_email?: string | null;
  demo_password?: string | null;
}

export interface Report {
  id: string;
  user_id: string | null;
  title: string;
  original_title?: string | null;
  ai_suggested_title?: string | null;
  description: string;
  category: ReportCategoryKey;
  hazard_type?: HazardType | null;
  urgency: RiskLevel;
  status: ReportStatus;
  moderation_status?: ReportStatus | null;
  latitude: number;
  longitude: number;
  address_text: string | null;
  image_url: string | null;
  image_storage_path: string | null;
  user_submitted_zone?: GeoJsonGeometry | null;
  ai_suggested_zone?: GeoJsonGeometry | null;
  severity_score?: number | null;
  urgency_score?: number | null;
  privacy_risk_score?: number | null;
  evidence_match_score?: number | null;
  risk_score: number;
  confidence_score: number;
  embedding?: number[] | null;
  analysis_summary: string | null;
  analysis_json: AnalysisJson;
  cluster_id: string | null;
  linked_case_id?: string | null;
  is_anonymous: boolean;
  is_locked: boolean;
  moderation_flag: ModerationFlag | null;
  created_at: string;
  updated_at: string;
}

export interface PublicSignal {
  id: string;
  source_feed_id: string | null;
  source_name: string;
  source_type: SourceType;
  source_url: string | null;
  external_id: string | null;
  title: string;
  text: string | null;
  category: ReportCategoryKey;
  status: PublicSignalStatus;
  linked_case_id?: string | null;
  latitude: number | null;
  longitude: number | null;
  address_text: string | null;
  published_at: string | null;
  risk_score: number;
  confidence_score: number;
  embedding?: number[] | null;
  analysis_summary: string | null;
  analysis_json: AnalysisJson;
  cluster_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RiskCluster {
  id: string;
  title: string;
  hazard_type?: HazardType | null;
  summary: string | null;
  category: ReportCategoryKey;
  status: RiskClusterStatus;
  latitude: number;
  longitude: number;
  radius_meters: number;
  risk_level: RiskLevel;
  risk_score: number;
  confidence_score: number;
  embedding?: number[] | null;
  report_count: number;
  signal_count: number;
  confirmation_count: number;
  dispute_count: number;
  resolved_count: number;
  photo_count: number;
  last_activity_at: string;
  action_plan: string | null;
  analysis_json: AnalysisJson;
  linked_case_id?: string | null;
  zone_geometry?: GeoJsonGeometry | null;
  created_at: string;
  updated_at: string;
}

export type GeoJsonPosition = number[];
export type GeoJsonGeometry =
  | { type: "Point"; coordinates: GeoJsonPosition }
  | { type: "LineString"; coordinates: GeoJsonPosition[] }
  | { type: "Polygon"; coordinates: GeoJsonPosition[][] }
  | { type: "MultiPolygon"; coordinates: GeoJsonPosition[][][] };

export interface IncidentCase {
  id: string;
  title: string;
  original_title: string | null;
  ai_suggested_title: string | null;
  linked_report_ids: string[];
  linked_cluster_id: string | null;
  hazard_type: HazardType;
  severity: number;
  confidence: number;
  urgency: number;
  privacy_risk: number;
  evidence_match: number;
  duplicate_likelihood: number;
  status: IncidentCaseStatus;
  owner_role: CaseOwnerRole;
  owner_department: CaseOwnerRole | null;
  active_zone: GeoJsonGeometry | null;
  predicted_zones: GeoJsonGeometry[];
  public_summary: string;
  responder_summary: string;
  ai_reasoning_summary: string;
  public_alert_status: "none" | "draft" | "pending_approval" | "active" | "closed";
  uipath_case_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DangerZone {
  id: string;
  case_id: string | null;
  report_id: string | null;
  cluster_id: string | null;
  type: DangerZoneType;
  geometry: GeoJsonGeometry;
  label: string;
  severity: number;
  confidence: number;
  starts_at: string | null;
  expires_at: string | null;
  estimated_arrival_at: string | null;
  instructions: string | null;
  created_by_role: CaseOwnerRole | CaseOpsRoleMode;
  created_at: string;
  updated_at: string;
}

export interface CaseEvent {
  id: string;
  case_id: string;
  actor_type: CaseEventActorType;
  actor_label: string | null;
  action: CaseEventAction;
  summary: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ClusterItem {
  id: string;
  cluster_id: string;
  item_type: "report" | "signal";
  item_id: string;
  created_at: string;
}

export interface ReportVote {
  id: string;
  report_id: string;
  user_id: string;
  vote_type: ReportVoteType;
  comment: string | null;
  created_at: string;
}

export interface ClusterVote {
  id: string;
  cluster_id: string;
  user_id: string;
  vote_type: ClusterVoteType;
  comment: string | null;
  created_at: string;
}

export interface ReportUpdate {
  id: string;
  report_id: string | null;
  cluster_id: string | null;
  user_id: string | null;
  update_type: UpdateType;
  text: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface SourceFeed {
  id: string;
  name: string;
  url: string;
  source_type: SourceType;
  default_city: string | null;
  default_latitude: number | null;
  default_longitude: number | null;
  trust_level: number;
  is_active: boolean;
  keywords: string[];
  last_checked_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface ModerationAction {
  id: string;
  actor_id: string | null;
  target_type: "report" | "cluster" | "signal" | "user" | "source";
  target_id: string;
  action: string;
  reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface GeocodeCacheEntry {
  id: string;
  query: string;
  latitude: number;
  longitude: number;
  formatted_address: string | null;
  provider: string | null;
  raw_json: Record<string, unknown>;
  created_at: string;
}

export interface AiCacheEntry {
  id: string;
  cache_key: string;
  input_hash: string;
  task_type: string;
  output_json: Record<string, unknown>;
  created_at: string;
}

export interface CategoryConfig {
  id: string;
  name: string;
  slug: string;
  base_severity: number;
  icon: string | null;
  color: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CivicState {
  profiles: Profile[];
  reports: Report[];
  public_signals: PublicSignal[];
  risk_clusters: RiskCluster[];
  incident_cases: IncidentCase[];
  danger_zones: DangerZone[];
  case_events: CaseEvent[];
  cluster_items: ClusterItem[];
  report_votes: ReportVote[];
  cluster_votes: ClusterVote[];
  report_updates: ReportUpdate[];
  source_feeds: SourceFeed[];
  moderation_actions: ModerationAction[];
  geocode_cache: GeocodeCacheEntry[];
  ai_cache: AiCacheEntry[];
  categories: CategoryConfig[];
}

export interface ReportCardView extends Report {
  confidence_label: ConfidenceLabel;
  risk_level: RiskLevel;
  vote_summary: VoteSummary;
  evidence_count: number;
  related_signal_count: number;
  related_report_count: number;
  display_name: string;
  cluster?: RiskCluster | null;
}

export interface RiskClusterView extends RiskCluster {
  confidence_label: ConfidenceLabel;
  evidence_count: number;
  score_breakdown: ScoreBreakdown;
  reports: Report[];
  signals: PublicSignal[];
  vote_summary: VoteSummary;
}

export interface PublicSignalView extends PublicSignal {
  confidence_label: ConfidenceLabel;
  risk_level: RiskLevel;
  cluster?: RiskCluster | null;
}

export interface ReviewQueueItem {
  id: string;
  type: "report" | "signal";
  title: string;
  description: string;
  image_url: string | null;
  location: string;
  risk_score: number;
  confidence_score: number;
  reason_for_review: string;
  similar_items: string[];
  user_trust_score: number | null;
  created_at: string;
}

export interface UserAnalytics {
  total_reports: number;
  active_reports: number;
  resolved_reports: number;
  verified_reports: number;
  under_review_reports: number;
}

export interface SystemAnalytics {
  total_reports: number;
  active_reports: number;
  resolved_reports: number;
  false_alarm_rate: number;
  average_resolution_time_hours: number;
  reports_by_category: Record<string, number>;
  risk_clusters_by_level: Record<RiskLevel, number>;
  public_signals_ingested: number;
  moderation_queue_size: number;
  source_feed_health: { healthy: number; failing: number };
  image_storage_estimate_mb: number;
  ai_calls_estimate: number;
  most_active_areas: { label: string; count: number }[];
}

export interface AuthViewer {
  id: string;
  role: UserRole;
  display_name: string;
  username: string;
  home_city: string | null;
  is_demo_mode: boolean;
}

export interface MapFilters {
  category?: ReportCategoryKey | "all";
  risk_level?: RiskLevel | "all";
  confidence?: ConfidenceLabel | "all";
  status?: ReportStatus | PublicSignalStatus | RiskClusterStatus | "all";
  source_type?: SourceType | "all";
  time_range?: "1h" | "6h" | "24h" | "72h" | "7d" | "30d" | "all";
  radius_meters?: number;
  sort?: "urgent" | "recent" | "nearby" | "confirmed" | "confidence";
  lat?: number;
  lng?: number;
  query?: string;
}

export interface ApiResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  meta?: Record<string, unknown>;
}
