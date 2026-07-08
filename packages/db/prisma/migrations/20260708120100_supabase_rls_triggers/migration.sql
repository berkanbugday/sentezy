-- Supabase-specific layer that Prisma's schema can't express:
-- FKs into auth.users, updated_at + new-user triggers, RLS policies, Realtime.
-- Applied by `prisma migrate deploy` right after the init migration.

-- ── updated_at trigger (fires for ALL writers, incl. the Python worker) ──────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at   before update on public.profiles   for each row execute function public.set_updated_at();
create trigger presenters_set_updated_at before update on public.presenters for each row execute function public.set_updated_at();
create trigger videos_set_updated_at     before update on public.videos     for each row execute function public.set_updated_at();
create trigger jobs_set_updated_at       before update on public.jobs       for each row execute function public.set_updated_at();

-- ── FKs into auth.users (Supabase-managed schema) ───────────────────────────
alter table public.profiles      add constraint profiles_id_fkey        foreign key (id)      references auth.users (id) on delete cascade;
alter table public.presenters    add constraint presenters_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade;
alter table public.voices        add constraint voices_user_id_fkey     foreign key (user_id) references auth.users (id) on delete cascade;
alter table public.videos        add constraint videos_user_id_fkey     foreign key (user_id) references auth.users (id) on delete cascade;
alter table public.credit_ledger add constraint credit_ledger_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade;

-- ── auto-create a profile on signup ─────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Row Level Security (users touch only their own rows; service role bypasses) ─
alter table public.profiles      enable row level security;
alter table public.presenters    enable row level security;
alter table public.voices        enable row level security;
alter table public.videos        enable row level security;
alter table public.jobs          enable row level security;
alter table public.credit_ledger enable row level security;

create policy "profiles_select_own" on public.profiles for select using (id = (select auth.uid()));
create policy "profiles_update_own" on public.profiles for update using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "presenters_select_own" on public.presenters for select using (user_id = (select auth.uid()));
create policy "presenters_insert_own" on public.presenters for insert with check (user_id = (select auth.uid()));
create policy "presenters_update_own" on public.presenters for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "presenters_delete_own" on public.presenters for delete using (user_id = (select auth.uid()));

create policy "voices_select_public_or_own" on public.voices for select using (is_public or user_id = (select auth.uid()));
create policy "voices_insert_own" on public.voices for insert with check (user_id = (select auth.uid()));
create policy "voices_update_own" on public.voices for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "voices_delete_own" on public.voices for delete using (user_id = (select auth.uid()));

create policy "videos_select_own" on public.videos for select using (user_id = (select auth.uid()));
create policy "videos_insert_own" on public.videos for insert with check (user_id = (select auth.uid()));
create policy "videos_update_own" on public.videos for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "videos_delete_own" on public.videos for delete using (user_id = (select auth.uid()));

create policy "jobs_select_own" on public.jobs for select using (
  exists (select 1 from public.videos v where v.id = video_id and v.user_id = (select auth.uid()))
);

create policy "credit_ledger_select_own" on public.credit_ledger for select using (user_id = (select auth.uid()));

-- ── Realtime: web subscribes to reel progress/status ────────────────────────
alter publication supabase_realtime add table public.videos;
