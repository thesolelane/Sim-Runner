-- Migration 024: Fix trade_type ENUM cast in post_rfq and post_job
-- The rfqs.trade_needed and job_listings.trade_required columns are ENUM
-- type trade_type, but the functions pass text — add explicit ::trade_type cast.
-- Safe to re-run — uses CREATE OR REPLACE.

-- ============================================================
-- post_rfq — cast p_trade_needed to trade_type
-- ============================================================
create or replace function public.post_rfq(
  p_title             text,
  p_trade_needed      text,
  p_project_type      text,
  p_scope_description text,
  p_budget_min        numeric,
  p_budget_max        numeric,
  p_sq_footage        integer,
  p_start_date        date,
  p_duration_weeks    integer,
  p_bid_deadline      timestamptz,
  p_location_zip      text,
  p_location_city     text,
  p_location_state    text,
  p_requirements      text[],
  p_share_to_feed     boolean
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rfq_id       uuid;
  v_account_type text;
  v_new_balance  integer;
  v_rfq_cost     integer := 10;
begin
  select account_type
  into   v_account_type
  from   public.users
  where  id = auth.uid();

  if v_account_type is null then
    raise exception 'User not found';
  end if;

  insert into public.rfqs (
    poster_id, title, trade_needed, project_type, scope_description,
    budget_min, budget_max, sq_footage, start_date, duration_weeks,
    bid_deadline, location_zip, location_city, location_state, requirements, status
  ) values (
    auth.uid(), p_title, p_trade_needed::trade_type, p_project_type, p_scope_description,
    p_budget_min, p_budget_max, p_sq_footage, p_start_date, p_duration_weeks,
    p_bid_deadline, p_location_zip, p_location_city, p_location_state,
    coalesce(p_requirements, '{}'), 'open'
  ) returning id into v_rfq_id;

  if v_account_type != 'contractor' then
    update public.users
    set    credit_balance = credit_balance - v_rfq_cost
    where  id = auth.uid()
      and  credit_balance >= v_rfq_cost
    returning credit_balance into v_new_balance;

    if not found then
      raise exception 'Insufficient credits: need % credits', v_rfq_cost;
    end if;

    insert into public.credit_ledger (user_id, delta, balance_after, transaction_type, description)
    values (auth.uid(), -v_rfq_cost, v_new_balance, 'spend', 'Posted RFQ: ' || p_title);
  end if;

  if p_share_to_feed then
    insert into public.posts (author_id, post_type, body, linked_rfq_id, hashtags)
    values (
      auth.uid(),
      'bid_post',
      'Seeking ' || p_trade_needed || ' Bids — ' || p_title ||
        E'\n\n' || left(p_scope_description, 280),
      v_rfq_id,
      array[ replace(p_trade_needed, ' ', ''), 'OpenBid', 'RFQ' ]
    );
  end if;

  return v_rfq_id;
end;
$$;

revoke execute on function public.post_rfq(text,text,text,text,numeric,numeric,integer,date,integer,timestamptz,text,text,text,text[],boolean) from public;
grant  execute on function public.post_rfq(text,text,text,text,numeric,numeric,integer,date,integer,timestamptz,text,text,text,text[],boolean) to authenticated;

-- ============================================================
-- post_job — cast p_trade_required to trade_type
-- ============================================================
create or replace function public.post_job(
  p_title          text,
  p_description    text,
  p_trade_required text,
  p_job_type       text,
  p_location_city  text,
  p_location_state text,
  p_pay_min        numeric,
  p_pay_max        numeric,
  p_pay_unit       text,
  p_certs_required text[],
  p_start_date     date,
  p_duration_weeks integer,
  p_is_urgent      boolean,
  p_share_to_feed  boolean
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing_id   uuid;
  v_account_type text;
  v_new_balance  integer;
  v_job_cost     integer := 8;
begin
  select account_type
  into   v_account_type
  from   public.users
  where  id = auth.uid();

  if v_account_type is null then
    raise exception 'User not found';
  end if;

  insert into public.job_listings (
    poster_id, title, description, trade_required, job_type,
    location_city, location_state, pay_min, pay_max, pay_unit,
    certs_required, start_date, duration_weeks, is_urgent, status
  ) values (
    auth.uid(), p_title, p_description, p_trade_required::trade_type, p_job_type,
    p_location_city, p_location_state, p_pay_min, p_pay_max, coalesce(p_pay_unit, 'hourly'),
    coalesce(p_certs_required, '{}'), p_start_date, p_duration_weeks,
    coalesce(p_is_urgent, false), 'open'
  ) returning id into v_listing_id;

  if v_account_type != 'contractor' then
    update public.users
    set    credit_balance = credit_balance - v_job_cost
    where  id = auth.uid()
      and  credit_balance >= v_job_cost
    returning credit_balance into v_new_balance;

    if not found then
      raise exception 'Insufficient credits: need % credits', v_job_cost;
    end if;

    insert into public.credit_ledger (user_id, delta, balance_after, transaction_type, description)
    values (auth.uid(), -v_job_cost, v_new_balance, 'spend', 'Posted Job: ' || p_title);
  end if;

  if p_share_to_feed then
    insert into public.posts (author_id, post_type, body, linked_job_id, hashtags)
    values (
      auth.uid(),
      'job_post',
      'NOW HIRING: ' || p_title || ' — ' || p_location_city || ', ' || p_location_state ||
        E'\n\n' || left(p_description, 280),
      v_listing_id,
      array[ replace(p_trade_required, ' ', ''), 'NowHiring', 'Jobs' ]
    );
  end if;

  return v_listing_id;
end;
$$;

revoke execute on function public.post_job(text,text,text,text,text,text,numeric,numeric,text,text[],date,integer,boolean,boolean) from public;
grant  execute on function public.post_job(text,text,text,text,text,text,numeric,numeric,text,text[],date,integer,boolean,boolean) to authenticated;

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';
