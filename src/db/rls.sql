alter table profiles enable row level security;
alter table reports enable row level security;
alter table public_signals enable row level security;
alter table risk_clusters enable row level security;
alter table report_votes enable row level security;
alter table cluster_votes enable row level security;
alter table source_feeds enable row level security;
alter table moderation_actions enable row level security;

create policy "profiles_public_read" on profiles
for select using (true);

create policy "profiles_self_update" on profiles
for update using (auth.uid() = id)
with check (auth.uid() = id);

create policy "reports_public_read" on reports
for select using (status in ('active', 'verified', 'in_progress', 'resolved'));

create policy "reports_owner_read" on reports
for select using (auth.uid() = user_id);

create policy "reports_insert_authenticated" on reports
for insert with check (auth.uid() is not null);

create policy "reports_owner_update_unlocked" on reports
for update using (auth.uid() = user_id and is_locked = false)
with check (auth.uid() = user_id and is_locked = false);

create policy "signals_public_read" on public_signals
for select using (status in ('matched'));

create policy "clusters_public_read" on risk_clusters
for select using (status in ('active', 'monitoring', 'urgent', 'in_progress', 'resolved'));

create policy "report_votes_insert" on report_votes
for insert with check (auth.uid() = user_id);

create policy "cluster_votes_insert" on cluster_votes
for insert with check (auth.uid() = user_id);

create policy "source_feeds_admin_only" on source_feeds
for all using (
  exists (
    select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);

create policy "moderation_actions_staff_only" on moderation_actions
for all using (
  exists (
    select 1 from profiles where profiles.id = auth.uid() and profiles.role in ('moderator', 'admin')
  )
)
with check (
  exists (
    select 1 from profiles where profiles.id = auth.uid() and profiles.role in ('moderator', 'admin')
  )
);
