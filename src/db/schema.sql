create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  username text unique,
  role text not null default 'user' check (role in ('user', 'moderator', 'admin')),
  trust_score integer not null default 50,
  home_city text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists source_feeds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  source_type text not null check (source_type in ('rss', 'city_alert', 'weather', 'traffic', 'news_api', 'manual', 'usgs', 'nws', 'open_meteo', 'other')),
  default_city text,
  default_latitude double precision,
  default_longitude double precision,
  trust_level integer default 50,
  is_active boolean default true,
  keywords text[] default '{}',
  last_checked_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists risk_clusters (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text,
  category text not null,
  status text default 'active' check (status in ('active', 'monitoring', 'urgent', 'in_progress', 'resolved', 'hidden', 'false_alarm')),
  latitude double precision not null,
  longitude double precision not null,
  radius_meters integer default 250,
  risk_level text default 'watch' check (risk_level in ('low', 'watch', 'serious', 'urgent')),
  risk_score integer default 0,
  confidence_score integer default 0,
  report_count integer default 0,
  signal_count integer default 0,
  confirmation_count integer default 0,
  dispute_count integer default 0,
  resolved_count integer default 0,
  photo_count integer default 0,
  last_activity_at timestamptz default now(),
  action_plan text,
  analysis_json jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  title text not null,
  description text not null,
  category text not null,
  urgency text not null check (urgency in ('low', 'watch', 'serious', 'urgent')),
  status text not null default 'active' check (status in ('active', 'needs_review', 'verified', 'in_progress', 'resolved', 'hidden', 'false_alarm', 'duplicate')),
  latitude double precision not null,
  longitude double precision not null,
  address_text text,
  image_url text,
  image_storage_path text,
  risk_score integer default 0,
  confidence_score integer default 0,
  analysis_summary text,
  analysis_json jsonb default '{}'::jsonb,
  cluster_id uuid references risk_clusters(id),
  is_anonymous boolean default false,
  is_locked boolean default false,
  moderation_flag text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public_signals (
  id uuid primary key default gen_random_uuid(),
  source_feed_id uuid references source_feeds(id),
  source_name text,
  source_type text,
  source_url text,
  external_id text,
  title text not null,
  text text,
  category text,
  status text default 'unmatched' check (status in ('unmatched', 'matched', 'ignored', 'needs_review', 'hidden')),
  latitude double precision,
  longitude double precision,
  address_text text,
  published_at timestamptz,
  risk_score integer default 0,
  confidence_score integer default 0,
  analysis_summary text,
  analysis_json jsonb default '{}'::jsonb,
  cluster_id uuid references risk_clusters(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists cluster_items (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid references risk_clusters(id) on delete cascade,
  item_type text not null check (item_type in ('report', 'signal')),
  item_id uuid not null,
  created_at timestamptz default now()
);

create table if not exists report_votes (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references reports(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  vote_type text not null check (vote_type in ('confirm', 'dispute', 'resolved', 'duplicate')),
  comment text,
  created_at timestamptz default now(),
  unique (report_id, user_id, vote_type)
);

create table if not exists cluster_votes (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid references risk_clusters(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  vote_type text not null check (vote_type in ('confirm', 'dispute', 'resolved', 'monitor')),
  comment text,
  created_at timestamptz default now(),
  unique (cluster_id, user_id, vote_type)
);

create table if not exists report_updates (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references reports(id) on delete cascade,
  cluster_id uuid references risk_clusters(id) on delete cascade,
  user_id uuid references profiles(id),
  update_type text not null,
  text text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists moderation_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  target_type text not null check (target_type in ('report', 'cluster', 'signal', 'user', 'source')),
  target_id uuid not null,
  action text not null,
  reason text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists geocode_cache (
  id uuid primary key default gen_random_uuid(),
  query text unique not null,
  latitude double precision not null,
  longitude double precision not null,
  formatted_address text,
  provider text,
  raw_json jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists ai_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text unique not null,
  input_hash text not null,
  task_type text not null,
  output_json jsonb not null,
  created_at timestamptz default now()
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  base_severity integer default 10,
  icon text,
  color text,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists incident_cases (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  original_title text,
  ai_suggested_title text,
  linked_report_ids uuid[] default '{}',
  linked_cluster_id uuid references risk_clusters(id),
  hazard_type text not null default 'other',
  severity integer default 0,
  confidence integer default 0,
  urgency integer default 0,
  privacy_risk integer default 0,
  evidence_match integer default 0,
  duplicate_likelihood integer default 0,
  status text not null default 'intake',
  owner_role text not null default 'moderator',
  owner_department text,
  active_zone jsonb,
  predicted_zones jsonb default '[]'::jsonb,
  public_summary text not null default '',
  responder_summary text not null default '',
  ai_reasoning_summary text not null default '',
  public_alert_status text not null default 'none',
  uipath_case_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists danger_zones (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references incident_cases(id) on delete cascade,
  report_id uuid references reports(id) on delete cascade,
  cluster_id uuid references risk_clusters(id) on delete cascade,
  type text not null,
  geometry jsonb not null,
  label text not null,
  severity integer default 0,
  confidence integer default 0,
  starts_at timestamptz,
  expires_at timestamptz,
  estimated_arrival_at timestamptz,
  instructions text,
  created_by_role text not null default 'system',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references incident_cases(id) on delete cascade,
  actor_type text not null,
  actor_label text,
  action text not null,
  summary text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table reports add column if not exists original_title text;
alter table reports add column if not exists ai_suggested_title text;
alter table reports add column if not exists hazard_type text;
alter table reports add column if not exists moderation_status text;
alter table reports add column if not exists user_submitted_zone jsonb;
alter table reports add column if not exists ai_suggested_zone jsonb;
alter table reports add column if not exists severity_score integer;
alter table reports add column if not exists urgency_score integer;
alter table reports add column if not exists privacy_risk_score integer;
alter table reports add column if not exists evidence_match_score integer;
alter table reports add column if not exists linked_case_id uuid references incident_cases(id);

alter table public_signals add column if not exists linked_case_id uuid references incident_cases(id);

alter table risk_clusters add column if not exists hazard_type text;
alter table risk_clusters add column if not exists linked_case_id uuid references incident_cases(id);
alter table risk_clusters add column if not exists zone_geometry jsonb;

alter table reports drop constraint if exists reports_status_check;
alter table reports add constraint reports_status_check check (
  status in ('submitted', 'ai_triaged', 'held_for_review', 'public', 'active', 'needs_review', 'verified', 'in_progress', 'resolved', 'hidden', 'rejected', 'false_alarm', 'duplicate', 'attached_to_case')
);

alter table public_signals drop constraint if exists public_signals_status_check;
alter table public_signals add constraint public_signals_status_check check (
  status in ('new', 'scanned', 'relevant', 'attached_to_cluster', 'attached_to_case', 'unmatched', 'matched', 'ignored', 'needs_review', 'hidden')
);

alter table reports add column if not exists embedding double precision[];
alter table public_signals add column if not exists embedding double precision[];
alter table risk_clusters add column if not exists embedding double precision[];

alter table source_feeds drop constraint if exists source_feeds_source_type_check;
alter table source_feeds add constraint source_feeds_source_type_check check (
  source_type in ('rss', 'city_alert', 'weather', 'traffic', 'news_api', 'manual', 'usgs', 'nws', 'open_meteo', 'other')
);

create unique index if not exists public_signals_source_external_uniq
  on public_signals (source_feed_id, external_id)
  where external_id is not null;

alter table risk_clusters drop constraint if exists risk_clusters_status_check;
alter table risk_clusters add constraint risk_clusters_status_check check (
  status in ('active', 'monitoring', 'needs_review', 'urgent', 'in_progress', 'verified', 'resolved', 'hidden', 'false_alarm', 'merged')
);
