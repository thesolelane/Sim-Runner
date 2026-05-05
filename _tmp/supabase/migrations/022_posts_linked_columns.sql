-- Migration 022: Add linked_job_id, linked_rfq_id, tagged_user_id to posts
-- Safe to re-run — uses ADD COLUMN IF NOT EXISTS throughout.

alter table public.posts
  add column if not exists tagged_user_id uuid references public.users(id) on delete set null,
  add column if not exists linked_job_id  uuid references public.job_listings(id) on delete set null,
  add column if not exists linked_rfq_id  uuid references public.rfqs(id) on delete set null;

create index if not exists idx_posts_linked_job on public.posts (linked_job_id) where linked_job_id is not null;
create index if not exists idx_posts_linked_rfq on public.posts (linked_rfq_id) where linked_rfq_id is not null;
