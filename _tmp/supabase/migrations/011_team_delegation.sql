-- Team Delegation & Ghost Sub-Accounts
-- Migration 011

-- Add delegate columns to users table
alter table public.users
  add column if not exists is_delegate boolean not null default false,
  add column if not exists delegate_principal_id uuid references public.users(id) on delete cascade;

-- account_delegations: tracks invitations and active delegations
create table if not exists public.account_delegations (
  id                        uuid primary key default uuid_generate_v4(),
  principal_id              uuid not null references public.users(id) on delete cascade,
  delegate_id               uuid references public.users(id) on delete set null,
  role                      text not null check (role in ('admin', 'contributor')),
  invite_email              text not null,
  invite_token              text unique,
  invite_expires_at         timestamptz,
  status                    text not null default 'pending' check (status in ('pending', 'active', 'revoked')),
  responsibility_accepted_at timestamptz not null,
  responsibility_terms_version text not null default '1.0',
  created_at                timestamptz not null default now()
);

alter table public.account_delegations enable row level security;

-- Principal can read their own delegations
create policy "Principal can read own delegations" on public.account_delegations
  for select using (auth.uid() = principal_id);

-- Principal can insert delegations (invite)
create policy "Principal can create delegations" on public.account_delegations
  for insert with check (auth.uid() = principal_id);

-- Principal can update (revoke) their delegations
create policy "Principal can update own delegations" on public.account_delegations
  for update using (auth.uid() = principal_id);

-- Service role can do anything (for invite token lookups from server)
-- Anon can read a delegation by token (needed during registration)
create policy "Anon can read pending delegation by token" on public.account_delegations
  for select using (status = 'pending' and invite_expires_at > now());

-- delegate_audit_log: records all actions taken by delegates
create table if not exists public.delegate_audit_log (
  id               uuid primary key default uuid_generate_v4(),
  delegation_id    uuid not null references public.account_delegations(id) on delete cascade,
  actual_user_id   uuid not null references public.users(id) on delete cascade,
  acting_as_user_id uuid not null references public.users(id) on delete cascade,
  action_type      text not null,
  action_detail    jsonb,
  created_at       timestamptz not null default now()
);

alter table public.delegate_audit_log enable row level security;

-- Only the principal can read the audit log for their account
create policy "Principal can read own audit log" on public.delegate_audit_log
  for select using (auth.uid() = acting_as_user_id);

-- Any authenticated user can insert audit log entries
-- (the application controls this; actual enforcement is at app layer)
create policy "Authenticated can insert audit log" on public.delegate_audit_log
  for insert with check (auth.uid() = actual_user_id);

-- Index for performance
create index if not exists idx_account_delegations_principal on public.account_delegations(principal_id);
create index if not exists idx_account_delegations_token on public.account_delegations(invite_token);
create index if not exists idx_account_delegations_delegate on public.account_delegations(delegate_id);
create index if not exists idx_delegate_audit_log_delegation on public.delegate_audit_log(delegation_id);
create index if not exists idx_delegate_audit_log_acting_as on public.delegate_audit_log(acting_as_user_id);
create index if not exists idx_users_is_delegate on public.users(is_delegate) where is_delegate = true;
create index if not exists idx_users_delegate_principal on public.users(delegate_principal_id) where delegate_principal_id is not null;
