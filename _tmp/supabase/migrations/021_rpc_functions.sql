-- ============================================================
-- Migration 021: Create / refresh all RPC functions
-- Safe to re-run — uses CREATE OR REPLACE throughout.
--
-- Run this in: Supabase Dashboard → SQL Editor → New query
--
-- Functions created:
--   1. fulfill_stripe_purchase  (service_role only)
--   2. increment_bid_count      (trigger)
--   3. increment_comment_count  (trigger)
--   4. increment_post_like
--   5. post_rfq
--   6. submit_bid
--   7. award_bid
--   8. post_job
--   9. apply_job
--  10. send_message
-- ============================================================

-- ============================================================
-- 1. fulfill_stripe_purchase
-- ============================================================
create or replace function public.fulfill_stripe_purchase(
  p_stripe_session_id text,
  p_user_id           uuid,
  p_credits           int,
  p_amount_cents      int,
  p_bundle_id         text
)
returns boolean
language plpgsql security definer
set search_path = public
as $$
declare
  v_affected    int;
  v_new_balance int;
begin
  update public.purchases
  set status = 'completed'
  where stripe_session_id = p_stripe_session_id
    and status = 'pending';

  get diagnostics v_affected = row_count;

  if v_affected = 0 then
    insert into public.purchases (user_id, stripe_session_id, credits, amount_cents, status)
    values (p_user_id, p_stripe_session_id, p_credits, p_amount_cents, 'completed')
    on conflict (stripe_session_id) do nothing;

    get diagnostics v_affected = row_count;

    if v_affected = 0 then
      return false;
    end if;
  end if;

  update public.users
  set credit_balance = credit_balance + p_credits
  where id = p_user_id
  returning credit_balance into v_new_balance;

  insert into public.credit_ledger (user_id, delta, balance_after, transaction_type, description)
  values (
    p_user_id,
    p_credits,
    v_new_balance,
    'purchase',
    'Purchased ' || p_credits || ' credits (' || p_bundle_id || ' bundle)'
  );

  insert into public.notifications (user_id, type, title, body, entity_type)
  values (
    p_user_id,
    'credits_added',
    'Credits added!',
    p_credits || ' credits have been added to your account.',
    'credit_purchase'
  );

  return true;
end;
$$;

revoke execute on function public.fulfill_stripe_purchase(text, uuid, int, int, text) from public;
revoke execute on function public.fulfill_stripe_purchase(text, uuid, int, int, text) from anon;
revoke execute on function public.fulfill_stripe_purchase(text, uuid, int, int, text) from authenticated;
grant  execute on function public.fulfill_stripe_purchase(text, uuid, int, int, text) to service_role;

-- ============================================================
-- 2. increment_bid_count (trigger function)
-- ============================================================
create or replace function increment_bid_count()
returns trigger language plpgsql security definer as $$
begin
  update public.rfqs set bid_count = bid_count + 1 where id = new.rfq_id;
  return new;
end;
$$;

drop trigger if exists on_bid_inserted on public.bids;
create trigger on_bid_inserted
  after insert on public.bids
  for each row execute function increment_bid_count();

-- ============================================================
-- 3. increment_comment_count (trigger function)
-- ============================================================
create or replace function increment_comment_count()
returns trigger language plpgsql security definer as $$
begin
  update public.posts set comment_count = comment_count + 1 where id = new.post_id;
  return new;
end;
$$;

drop trigger if exists on_comment_inserted on public.comments;
create trigger on_comment_inserted
  after insert on public.comments
  for each row execute function increment_comment_count();

-- ============================================================
-- 4. increment_post_like
-- ============================================================
create or replace function public.increment_post_like(post_id uuid, delta integer)
returns void
language sql
security definer
as $$
  update public.posts
  set like_count = greatest(0, like_count + delta)
  where id = post_id;
$$;

-- ============================================================
-- 5. post_rfq
-- Atomically creates an RFQ, deducts credits for non-contractors,
-- writes credit ledger, and optionally shares to feed.
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
    auth.uid(), p_title, p_trade_needed, p_project_type, p_scope_description,
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
-- 6. submit_bid
-- ============================================================
create or replace function public.submit_bid(
  p_rfq_id         uuid,
  p_amount         numeric,
  p_timeline_weeks integer,
  p_cover_note     text,
  p_document_url   text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bid_id       uuid;
  v_poster_id    uuid;
  v_rfq_title    text;
  v_rfq_status   text;
  v_bidder_name  text;
  v_account_type text;
begin
  select account_type into v_account_type from public.users where id = auth.uid();
  if v_account_type != 'contractor' then
    raise exception 'Only contractors can submit bids';
  end if;

  select poster_id, title, status
  into   v_poster_id, v_rfq_title, v_rfq_status
  from   public.rfqs
  where  id = p_rfq_id;

  if v_poster_id is null then
    raise exception 'RFQ not found';
  end if;

  if v_rfq_status != 'open' then
    raise exception 'RFQ is not open';
  end if;

  if auth.uid() = v_poster_id then
    raise exception 'You cannot bid on your own RFQ';
  end if;

  select display_name into v_bidder_name
  from   public.users
  where  id = auth.uid();

  insert into public.bids
    (rfq_id, bidder_id, amount, timeline_weeks, cover_note, document_url, status)
  values
    (p_rfq_id, auth.uid(), p_amount, p_timeline_weeks, p_cover_note, p_document_url, 'pending')
  returning id into v_bid_id;

  insert into public.notifications (user_id, type, title, body, entity_id, entity_type)
  values (
    v_poster_id,
    'new_bid',
    'New bid received',
    coalesce(v_bidder_name, 'A contractor') || ' submitted a bid of $' ||
      round(p_amount)::text || ' on "' || v_rfq_title || '"',
    p_rfq_id,
    'rfq'
  );

  return v_bid_id;
end;
$$;

revoke execute on function public.submit_bid(uuid, numeric, integer, text, text) from public;
grant  execute on function public.submit_bid(uuid, numeric, integer, text, text) to authenticated;

-- ============================================================
-- 7. award_bid
-- ============================================================
create or replace function public.award_bid(
  p_bid_id uuid,
  p_rfq_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_poster_id  uuid;
  v_rfq_status text;
  v_bid_rfq_id uuid;
  v_bidder_id  uuid;
begin
  select poster_id, status
  into   v_poster_id, v_rfq_status
  from   public.rfqs
  where  id = p_rfq_id;

  if v_poster_id is null then
    raise exception 'RFQ not found';
  end if;

  if auth.uid() != v_poster_id then
    raise exception 'Unauthorized: only the RFQ poster can award a bid';
  end if;

  if v_rfq_status != 'open' then
    raise exception 'RFQ is not open — cannot award a bid';
  end if;

  select rfq_id, bidder_id
  into   v_bid_rfq_id, v_bidder_id
  from   public.bids
  where  id = p_bid_id;

  if v_bid_rfq_id is null or v_bid_rfq_id != p_rfq_id then
    raise exception 'Bid does not belong to this RFQ';
  end if;

  update public.bids set status = 'awarded'     where id = p_bid_id;
  update public.bids set status = 'not_awarded' where rfq_id = p_rfq_id and id != p_bid_id;
  update public.rfqs set status = 'awarded', awarded_to = v_bidder_id where id = p_rfq_id;

  insert into public.notifications (user_id, type, title, body, entity_id, entity_type)
  values (
    v_bidder_id,
    'bid_awarded',
    'Your bid was awarded!',
    'Congratulations — your bid has been selected for this project.',
    p_rfq_id,
    'rfq'
  );
end;
$$;

revoke execute on function public.award_bid(uuid, uuid) from public;
grant  execute on function public.award_bid(uuid, uuid) to authenticated;

-- ============================================================
-- 8. post_job
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
    auth.uid(), p_title, p_description, p_trade_required, p_job_type,
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

-- ============================================================
-- 9. apply_job
-- ============================================================
create or replace function public.apply_job(
  p_listing_id uuid,
  p_cover_note text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app_id       uuid;
  v_account_type text;
  v_poster_id    uuid;
  v_status       text;
begin
  select account_type into v_account_type from public.users where id = auth.uid();
  if v_account_type != 'contractor' then
    raise exception 'Only contractors can apply to jobs';
  end if;

  select poster_id, status into v_poster_id, v_status
  from   public.job_listings
  where  id = p_listing_id;

  if v_poster_id is null then
    raise exception 'Job listing not found';
  end if;

  if v_status != 'open' then
    raise exception 'This job listing is no longer accepting applications';
  end if;

  if auth.uid() = v_poster_id then
    raise exception 'You cannot apply to your own job listing';
  end if;

  insert into public.job_applications (listing_id, applicant_id, cover_note, status)
  values (p_listing_id, auth.uid(), p_cover_note, 'applied')
  returning id into v_app_id;

  return v_app_id;
end;
$$;

revoke execute on function public.apply_job(uuid, text) from public;
grant  execute on function public.apply_job(uuid, text) to authenticated;

-- ============================================================
-- 10. send_message
-- Atomically deducts 3 credits for non-contractor first contact,
-- inserts message, and notifies recipient.
-- ============================================================
create or replace function public.send_message(
  p_recipient_id uuid,
  p_thread_id    text,
  p_body         text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_msg_id              uuid;
  v_sender_acct         text;
  v_recipient_acct      text;
  v_is_first_contact    boolean;
  v_cold_msg_cost       integer := 3;
  v_new_balance         integer;
  v_canonical_thread_id text;
begin
  if p_body is null or trim(p_body) = '' then
    raise exception 'Message body cannot be empty';
  end if;
  if auth.uid() = p_recipient_id then
    raise exception 'Cannot message yourself';
  end if;

  select account_type into v_sender_acct   from public.users where id = auth.uid();
  select account_type into v_recipient_acct from public.users where id = p_recipient_id;
  if v_sender_acct    is null then raise exception 'Sender not found'; end if;
  if v_recipient_acct is null then raise exception 'Recipient not found'; end if;

  v_canonical_thread_id := (
    case
      when auth.uid()::text < p_recipient_id::text
        then auth.uid()::text || '_' || p_recipient_id::text
      else
        p_recipient_id::text || '_' || auth.uid()::text
    end
  );

  if p_thread_id is distinct from v_canonical_thread_id then
    raise exception 'Invalid thread_id: does not match canonical participant pair';
  end if;

  if v_sender_acct != 'contractor' and v_recipient_acct = 'contractor' then
    select not exists(
      select 1 from public.messages
      where (sender_id = auth.uid() and recipient_id = p_recipient_id)
         or (sender_id = p_recipient_id and recipient_id = auth.uid())
    ) into v_is_first_contact;

    if v_is_first_contact then
      update public.users
      set    credit_balance = credit_balance - v_cold_msg_cost
      where  id = auth.uid()
        and  credit_balance >= v_cold_msg_cost
      returning credit_balance into v_new_balance;

      if not found then
        raise exception 'Insufficient credits: need % credits for first contact with a contractor', v_cold_msg_cost;
      end if;

      insert into public.credit_ledger (user_id, delta, balance_after, transaction_type, description)
      values (auth.uid(), -v_cold_msg_cost, v_new_balance, 'spend', 'Cold message to contractor');
    end if;
  end if;

  insert into public.messages (thread_id, sender_id, recipient_id, body)
  values (v_canonical_thread_id, auth.uid(), p_recipient_id, trim(p_body))
  returning id into v_msg_id;

  insert into public.notifications (user_id, type, title, body, entity_id, entity_type)
  values (
    p_recipient_id,
    'message_received',
    'New message',
    left(trim(p_body), 100),
    auth.uid(),
    'thread:' || v_canonical_thread_id
  );

  return v_msg_id;
end;
$$;

revoke execute on function public.send_message(uuid, text, text) from public;
grant  execute on function public.send_message(uuid, text, text) to authenticated;

-- ============================================================
-- Reload PostgREST schema cache so all functions are visible
-- immediately (no restart needed).
-- ============================================================
notify pgrst, 'reload schema';
