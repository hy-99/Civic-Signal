export type UserRole = "user" | "moderator" | "admin";
export type ReportStatus = "active" | "needs_review" | "verified" | "in_progress" | "resolved" | "hidden" | "false_alarm" | "duplicate";
export type PublicSignalStatus = "unmatched" | "matched" | "ignored" | "needs_review" | "hidden";
export type RiskClusterStatus = "active" | "monitoring" | "urgent" | "in_progress" | "resolved" | "hidden" | "false_alarm";
export type RiskLevel = "low" | "watch" | "serious" | "urgent";
export type ConfidenceLabel = "very_low" | "low" | "medium" | "high" | "very_high";
export type SourceType = "rss" | "city_alert" | "weather" | "traffic" | "news_api" | "manual" | "other";
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

export interface EvidenceReview {
  status: "matches" | "unclear" | "mismatch" | "not_provided";
  match_score: number;
  issue_likelihood: number;
  summary: string;
  flags: string[];
  method: "vision_ai" | "local_heuristic" | "not_available";
  checked_at: string;
}

export interface AnalysisJson {
  score_breakdown: ScoreBreakdown;
  moderation_flags: ModerationFlag[];
  extracted_location_text?: string | null;
  source_confidence?: number;
  matching_summary?: string;
  evidence_review?: EvidenceReview;
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
  description: string;
  category: ReportCategoryKey;
  urgency: RiskLevel;
  status: ReportStatus;
  latitude: number;
  longitude: number;
  address_text: string | null;
  image_url: string | null;
  image_storage_path: string | null;
  risk_score: number;
  confidence_score: number;
  analysis_summary: string | null;
  analysis_json: AnalysisJson;
  cluster_id: string | null;
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
  latitude: number | null;
  longitude: number | null;
  address_text: string | null;
  published_at: string | null;
  risk_score: number;
  confidence_score: number;
  analysis_summary: string | null;
  analysis_json: AnalysisJson;
  cluster_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RiskCluster {
  id: string;
  title: string;
  summary: string | null;
  category: ReportCategoryKey;
  status: RiskClusterStatus;
  latitude: number;
  longitude: number;
  radius_meters: number;
  risk_level: RiskLevel;
  risk_score: number;
  confidence_score: number;
  report_count: number;
  signal_count: number;
  confirmation_count: number;
  dispute_count: number;
  resolved_count: number;
  photo_count: number;
  last_activity_at: string;
  action_plan: string | null;
  analysis_json: AnalysisJson;
  created_at: string;
  updated_at: string;
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
