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
  source_type text not null check (source_type in ('rss', 'city_alert', 'weather', 'traffic', 'news_api', 'manual', 'other')),
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
  status text default 'active' check (status in ('active', 'monitoring', 'urgent', 'resolved', 'hidden', 'false_alarm')),
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
  status text not null default 'active' check (status in ('active', 'needs_review', 'verified', 'resolved', 'hidden', 'false_alarm', 'duplicate')),
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
