-- LEPDO CONNECT — Core schema
create extension if not exists pgcrypto;

create table public.app_settings (
  id               int primary key default 1 check (id = 1),
  company_name     text not null default 'LEPDO' check (length(trim(company_name)) between 1 and 120),
  tagline          text default 'B2B Diamonds & Jewellery' check (tagline is null or length(tagline) <= 200),
  email            text check (email is null or length(email) <= 200),
  phone            text check (phone is null or length(phone) <= 50),
  whatsapp         text check (whatsapp is null or length(whatsapp) <= 50),
  website          text check (website is null or length(website) <= 200),
  address          text check (address is null or length(address) <= 500),
  default_currency text not null default 'USD' check (default_currency ~ '^[A-Z]{3}$'),
  team_sees_all    boolean not null default false,
  updated_at       timestamptz not null default now(),
  updated_by       uuid
);
insert into public.app_settings (id) values (1);

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text not null default '' check (length(full_name) <= 120),
  role        text not null default 'customer' check (role in ('admin', 'team', 'customer')),
  customer_id uuid,
  job_title   text check (job_title is null or length(job_title) <= 120),
  phone       text check (phone is null or length(phone) <= 50),
  whatsapp    text check (whatsapp is null or length(whatsapp) <= 50),
  photo_url   text check (photo_url is null or photo_url ~* '^https?://'),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint customer_role_link check (role = 'customer' or customer_id is null)
);
create unique index profiles_email_key on public.profiles (lower(email));
create index profiles_customer_idx on public.profiles (customer_id);
create index profiles_role_idx on public.profiles (role);

create table public.customers (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null check (length(trim(name)) between 1 and 200),
  contact_person        text check (contact_person is null or length(contact_person) <= 120),
  email                 text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 200),
  phone                 text check (phone is null or length(phone) <= 50),
  country               text not null check (length(trim(country)) between 1 and 80),
  address               text check (address is null or length(address) <= 500),
  internal_notes        text check (internal_notes is null or length(internal_notes) <= 4000),
  assigned_executive_id uuid not null references public.profiles (id),
  portal_invited_at     timestamptz,
  last_activity_at      timestamptz not null default now(),
  created_by            uuid references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  updated_by            uuid references public.profiles (id) on delete set null
);
create unique index customers_email_key on public.customers (lower(email));
create index customers_exec_idx on public.customers (assigned_executive_id);
create index customers_name_idx on public.customers (lower(name));

alter table public.profiles
  add constraint profiles_customer_fk foreign key (customer_id)
  references public.customers (id) on delete set null;

create table public.orders (
  id                     uuid primary key default gen_random_uuid(),
  reference              text not null unique,
  customer_id            uuid not null references public.customers (id) on delete restrict,
  order_type             text not null check (order_type in ('diamond', 'jewellery')),
  title                  text not null check (length(trim(title)) between 1 and 200),
  customer_po_ref        text check (customer_po_ref is null or length(customer_po_ref) <= 100),
  currency               text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  proforma_amount        numeric(14, 2) check (proforma_amount is null or proforma_amount >= 0),
  final_invoice_amount   numeric(14, 2) check (final_invoice_amount is null or final_invoice_amount >= 0),
  amount_received        numeric(14, 2) not null default 0,
  balance_due            numeric(14, 2) generated always as
                           (coalesce(final_invoice_amount, proforma_amount) - amount_received) stored,
  payment_status         text not null default 'no_amount'
                           check (payment_status in ('no_amount', 'unpaid', 'initiated', 'partial', 'paid')),
  expected_delivery_date date,
  notes                  text check (notes is null or length(notes) <= 4000),
  status                 text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  executive_override_id  uuid references public.profiles (id) on delete set null,
  current_stage_key      text,
  current_stage_name     text,
  current_stage_status   text,
  progress_pct           int not null default 0 check (progress_pct between 0 and 100),
  feedback_rating        int check (feedback_rating is null or feedback_rating between 1 and 5),
  feedback_comment       text check (feedback_comment is null or length(feedback_comment) <= 2000),
  feedback_at            timestamptz,
  completed_at           timestamptz,
  cancelled_at           timestamptz,
  created_by             uuid references public.profiles (id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  updated_by             uuid references public.profiles (id) on delete set null
);
create index orders_customer_idx on public.orders (customer_id);
create index orders_status_idx on public.orders (status, updated_at desc);
create index orders_exec_idx on public.orders (executive_override_id);
create index orders_stage_idx on public.orders (current_stage_key);

create table public.order_stages (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders (id) on delete cascade,
  stage_key        text not null,
  name             text not null,
  position         int not null,
  is_payment_stage boolean not null default false,
  status           text not null default 'upcoming'
                     check (status in ('upcoming', 'in_progress', 'completed', 'attention', 'blocked', 'not_applicable')),
  completed_at     timestamptz,
  customer_note    text check (customer_note is null or length(customer_note) <= 1000),
  details          jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  updated_at       timestamptz not null default now(),
  updated_by       uuid references public.profiles (id) on delete set null,
  unique (order_id, stage_key),
  unique (order_id, position)
);
create index order_stages_order_idx on public.order_stages (order_id, position);

create table public.documents (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders (id) on delete cascade,
  name             text not null check (length(trim(name)) between 1 and 200),
  doc_type         text not null check (doc_type in (
                     'proforma_invoice', 'bank_details', 'payment_confirmation', 'commercial_invoice',
                     'gst_invoice', 'diamond_certificate', 'cad_design', 'qc_image', 'jewellery_photo',
                     'shipping_document', 'other')),
  storage_path     text not null unique,
  mime_type        text,
  size_bytes       bigint check (size_bytes is null or size_bytes >= 0),
  customer_visible boolean not null default false,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  constraint storage_path_in_order_folder check (storage_path like order_id::text || '/%')
);
create index documents_order_idx on public.documents (order_id, created_at desc);

create table public.order_updates (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders (id) on delete cascade,
  stage_id         uuid references public.order_stages (id) on delete set null,
  stage_name       text,
  status           text,
  note             text check (note is null or length(note) <= 2000),
  customer_visible boolean not null default true,
  document_id      uuid references public.documents (id) on delete set null,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now()
);
create index order_updates_order_idx on public.order_updates (order_id, created_at desc);

create table public.payments (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders (id) on delete cascade,
  amount       numeric(14, 2) not null check (amount > 0),
  currency     text not null check (currency ~ '^[A-Z]{3}$'),
  payment_date date not null default current_date,
  method       text not null default 'bank_transfer'
                 check (method in ('bank_transfer', 'local_transfer', 'card', 'cash', 'other')),
  payment_type text not null default 'partial' check (payment_type in ('advance', 'partial', 'final')),
  status       text not null default 'initiated' check (status in ('initiated', 'confirmed', 'failed')),
  reference    text check (reference is null or length(reference) <= 120),
  notes        text check (notes is null or length(notes) <= 2000),
  document_id  uuid references public.documents (id) on delete set null,
  confirmed_at timestamptz,
  confirmed_by uuid references public.profiles (id) on delete set null,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid references public.profiles (id) on delete set null
);
create index payments_order_idx on public.payments (order_id, payment_date);

create table public.shipments (
  id                      uuid primary key default gen_random_uuid(),
  order_id                uuid not null references public.orders (id) on delete cascade,
  courier                 text not null check (length(trim(courier)) between 1 and 80),
  tracking_number         text check (tracking_number is null or length(tracking_number) <= 120),
  tracking_url            text check (tracking_url is null or (tracking_url ~* '^https?://' and length(tracking_url) <= 1000)),
  shipped_date            date,
  estimated_delivery_date date,
  status                  text not null default 'shipped'
                            check (status in ('preparing', 'shipped', 'in_transit', 'delivered')),
  delivered_at            timestamptz,
  document_id             uuid references public.documents (id) on delete set null,
  created_by              uuid references public.profiles (id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  updated_by              uuid references public.profiles (id) on delete set null
);
create index shipments_order_idx on public.shipments (order_id);

create or replace function public.try_uuid(p text) returns uuid
language plpgsql immutable as $$
begin
  return p::uuid;
exception when others then
  return null;
end $$;

create or replace function public.auth_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and is_active
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.auth_role() = 'admin', false)
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.auth_role() in ('admin', 'team'), false)
$$;

create or replace function public.my_customer_id() returns uuid
language sql stable security definer set search_path = public as $$
  select customer_id from public.profiles
  where id = auth.uid() and is_active and role = 'customer'
$$;

create or replace function public.staff_can_access_customer(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when public.is_admin() then true
    when public.is_staff() then exists (
      select 1 from public.customers c
      where c.id = cid
        and (c.assigned_executive_id = auth.uid()
             or c.created_by = auth.uid()
             or (select team_sees_all from public.app_settings where id = 1)))
    else false
  end
$$;

create or replace function public.staff_can_access_order(oid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when public.is_admin() then true
    when public.is_staff() then exists (
      select 1 from public.orders o
      join public.customers c on c.id = o.customer_id
      where o.id = oid
        and (o.executive_override_id = auth.uid()
             or c.assigned_executive_id = auth.uid()
             or o.created_by = auth.uid()
             or c.created_by = auth.uid()
             or (select team_sees_all from public.app_settings where id = 1)))
    else false
  end
$$;

create or replace function public.calc_payment_status(total numeric, received numeric, has_initiated boolean)
returns text language sql immutable as $$
  select case
    when total is null then case when received > 0 then 'partial'
                                 when has_initiated then 'initiated'
                                 else 'no_amount' end
    when received > 0 and received >= total then 'paid'
    when received > 0 then 'partial'
    when has_initiated then 'initiated'
    else 'unpaid'
  end
$$;

create or replace function public.tg_set_created_by() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null then
    new.created_by := auth.uid();
  end if;
  return new;
end $$;

create or replace function public.tg_set_updated() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  if auth.uid() is not null then
    new.updated_by := auth.uid();
  end if;
  return new;
end $$;

create or replace function public.tg_keep_created_by() returns trigger
language plpgsql as $$
begin
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  return new;
end $$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''), 'customer')
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_user_email_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end $$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

create or replace function public.tg_protect_profile() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  new.email := old.email;
  if auth.uid() is null then
    return new;
  end if;
  if (new.role is distinct from old.role
      or new.is_active is distinct from old.is_active
      or new.customer_id is distinct from old.customer_id) then
    if not public.is_admin() then
      raise exception 'Only an administrator can change roles or account status.' using errcode = '42501';
    end if;
    if new.id = auth.uid() then
      raise exception 'You cannot change your own role or deactivate your own account.' using errcode = '42501';
    end if;
    if new.role <> 'customer' then
      new.customer_id := null;
    end if;
  end if;
  return new;
end $$;

create trigger profiles_protect before update on public.profiles
  for each row execute function public.tg_protect_profile();

create or replace function public.promote_to_admin(p_email text) returns text
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  update public.profiles
     set role = 'admin', customer_id = null, is_active = true
   where lower(email) = lower(trim(p_email))
  returning id into v_id;
  if v_id is null then
    raise exception 'No user with email %.', p_email;
  end if;
  return 'OK: ' || p_email || ' is now an administrator.';
end $$;

create trigger customers_created before insert on public.customers
  for each row execute function public.tg_set_created_by();
create trigger customers_updated before update on public.customers
  for each row execute function public.tg_set_updated();
create trigger customers_keep_created before update on public.customers
  for each row execute function public.tg_keep_created_by();

create or replace function public.tg_customer_normalise() returns trigger
language plpgsql as $$
begin
  new.name := trim(new.name);
  new.email := lower(trim(new.email));
  new.country := trim(new.country);
  if not exists (select 1 from public.profiles p
                 where p.id = new.assigned_executive_id and p.role in ('admin', 'team')) then
    raise exception 'Assigned executive must be a LEPDO team member.' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger customers_normalise before insert or update on public.customers
  for each row execute function public.tg_customer_normalise();

create or replace function public.tg_order_reference() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  y text := to_char(now(), 'YYYY');
  n int;
begin
  if auth.uid() is not null or new.reference is null or new.reference = '' then
    perform pg_advisory_xact_lock(hashtext('lepdo_order_ref_' || y));
    select coalesce(max(split_part(reference, '-', 3)::int), 0) + 1 into n
      from public.orders
     where reference ~ ('^LPD-' || y || '-[0-9]+$');
    new.reference := 'LPD-' || y || '-' || lpad(n::text, 4, '0');
  end if;
  return new;
end $$;

create or replace function public.tg_order_before() returns trigger
language plpgsql as $$
declare v_init boolean;
begin
  new.title := trim(new.title);
  new.currency := upper(new.currency);

  if new.executive_override_id is not null and not exists (
       select 1 from public.profiles p where p.id = new.executive_override_id and p.role in ('admin', 'team')) then
    raise exception 'Order executive must be a LEPDO team member.' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' then
    new.reference := old.reference;
    new.order_type := old.order_type;
    if new.currency <> old.currency and exists (select 1 from public.payments where order_id = new.id) then
      raise exception 'Currency cannot be changed after payments have been recorded.' using errcode = '23514';
    end if;
    if new.status <> old.status then
      new.completed_at := case when new.status = 'completed' then coalesce(new.completed_at, now()) else null end;
      new.cancelled_at := case when new.status = 'cancelled' then now() else null end;
    end if;
    if (new.proforma_amount is distinct from old.proforma_amount
        or new.final_invoice_amount is distinct from old.final_invoice_amount
        or new.amount_received is distinct from old.amount_received) then
      select coalesce(bool_or(status = 'initiated'), false) into v_init
        from public.payments where order_id = new.id;
      new.payment_status := public.calc_payment_status(
        coalesce(new.final_invoice_amount, new.proforma_amount), new.amount_received, v_init);
    end if;
  else
    new.status := 'active';
    new.amount_received := 0;
    new.payment_status := public.calc_payment_status(
      coalesce(new.final_invoice_amount, new.proforma_amount), 0, false);
  end if;
  return new;
end $$;

create trigger orders_reference before insert on public.orders
  for each row execute function public.tg_order_reference();
create trigger orders_before before insert or update on public.orders
  for each row execute function public.tg_order_before();
create trigger orders_created before insert on public.orders
  for each row execute function public.tg_set_created_by();
create trigger orders_updated before update on public.orders
  for each row execute function public.tg_set_updated();
create trigger orders_keep_created before update on public.orders
  for each row execute function public.tg_keep_created_by();

create or replace function public.create_default_stages(p_order_id uuid, p_type text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_type = 'diamond' then
    insert into public.order_stages (order_id, stage_key, name, position, is_payment_stage) values
      (p_order_id, 'order_confirmed',      'Order Confirmed',                     1, false),
      (p_order_id, 'proforma',             'Proforma Invoice & Payment Details',  2, true),
      (p_order_id, 'payment_in_progress',  'Payment In Progress',                 3, true),
      (p_order_id, 'payment_confirmed',    'Payment Confirmed',                   4, true),
      (p_order_id, 'diamond_preparation',  'Diamond Preparation',                 5, false),
      (p_order_id, 'quality_check',        'Quality Check',                       6, false),
      (p_order_id, 'ready_to_ship',        'Ready to Ship',                       7, false),
      (p_order_id, 'shipped',              'Shipped',                             8, false),
      (p_order_id, 'delivered',            'Delivered',                           9, false);
  else
    insert into public.order_stages (order_id, stage_key, name, position, is_payment_stage) values
      (p_order_id, 'order_confirmed',      'Order Confirmed',                     1, false),
      (p_order_id, 'advance_payment',      'Advance Payment Confirmed',           2, true),
      (p_order_id, 'cad_approval',         'CAD & Design Approval',               3, false),
      (p_order_id, 'manufacturing',        'Manufacturing',                       4, false),
      (p_order_id, 'quality_check',        'Jewellery Quality Check',             5, false),
      (p_order_id, 'ready_to_ship',        'Ready to Ship',                       6, false),
      (p_order_id, 'final_payment',        'Final Payment Confirmed',             7, true),
      (p_order_id, 'shipped',              'Shipped',                             8, false),
      (p_order_id, 'delivered',            'Delivered',                           9, false);
  end if;
end $$;

create or replace function public.recompute_order_progress(p_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_total int;
  v_done int;
  v_pct int;
  cur public.order_stages%rowtype;
  v_last_done int;
begin
  select count(*) filter (where status <> 'not_applicable'),
         count(*) filter (where status = 'completed')
    into v_total, v_done
    from public.order_stages where order_id = p_order_id;

  v_pct := case when coalesce(v_total, 0) = 0 then 0 else round(100.0 * v_done / v_total) end;

  select * into cur from public.order_stages
   where order_id = p_order_id and status in ('in_progress', 'attention', 'blocked')
   order by position desc limit 1;

  if not found then
    select coalesce(max(position), 0) into v_last_done
      from public.order_stages where order_id = p_order_id and status = 'completed';
    select * into cur from public.order_stages
     where order_id = p_order_id and status = 'upcoming' and position > v_last_done
     order by position limit 1;
  end if;

  if not found then
    select * into cur from public.order_stages
     where order_id = p_order_id and status = 'upcoming'
     order by position limit 1;
  end if;

  if not found then
    select * into cur from public.order_stages
     where order_id = p_order_id and status = 'completed'
     order by position desc limit 1;
  end if;

  update public.orders
     set current_stage_key = cur.stage_key,
         current_stage_name = cur.name,
         current_stage_status = cur.status,
         progress_pct = v_pct,
         updated_at = now()
   where id = p_order_id;
end $$;

create or replace function public.tg_order_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.create_default_stages(new.id, new.order_type);
  perform public.recompute_order_progress(new.id);
  update public.customers set last_activity_at = now() where id = new.customer_id;
  return new;
end $$;

create trigger orders_after_insert after insert on public.orders
  for each row execute function public.tg_order_after_insert();

create or replace function public.tg_order_touch_customer() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.customers set last_activity_at = now() where id = new.customer_id;
  return new;
end $$;
create trigger orders_touch_customer after update on public.orders
  for each row execute function public.tg_order_touch_customer();

create or replace function public.tg_stage_before() returns trigger
language plpgsql as $$
begin
  new.order_id := old.order_id;
  new.stage_key := old.stage_key;
  new.position := old.position;
  new.is_payment_stage := old.is_payment_stage;
  new.name := old.name;
  if new.status = 'completed' and old.status <> 'completed' then
    new.completed_at := coalesce(new.completed_at, now());
  elsif new.status <> 'completed' then
    new.completed_at := null;
  end if;
  new.updated_at := now();
  if auth.uid() is not null then new.updated_by := auth.uid(); end if;
  return new;
end $$;
create trigger order_stages_before before update on public.order_stages
  for each row execute function public.tg_stage_before();

create or replace function public.tg_stage_after() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_status text;
  v_open_shipments int;
begin
  perform public.recompute_order_progress(new.order_id);

  if new.stage_key = 'delivered' and new.status is distinct from old.status then
    select status into v_status from public.orders where id = new.order_id;
    if new.status = 'completed' and v_status = 'active' then
      select count(*) into v_open_shipments
        from public.shipments where order_id = new.order_id and status <> 'delivered';
      if v_open_shipments = 0 then
        update public.orders set status = 'completed' where id = new.order_id;
      end if;
    elsif new.status <> 'completed' and v_status = 'completed' then
      update public.orders set status = 'active' where id = new.order_id;
    end if;
  end if;
  return new;
end $$;
create trigger order_stages_after after update on public.order_stages
  for each row execute function public.tg_stage_after();

create or replace function public.record_stage_update(
  p_stage_id uuid,
  p_status text,
  p_note text default null,
  p_customer_visible boolean default true,
  p_details jsonb default null,
  p_document_id uuid default null
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  s public.order_stages%rowtype;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_id uuid;
begin
  if not public.is_staff() then
    raise exception 'Only LEPDO team members can update progress.' using errcode = '42501';
  end if;
  select * into s from public.order_stages where id = p_stage_id;
  if not found then
    raise exception 'Stage not found or you do not have access to this order.' using errcode = '42501';
  end if;
  if p_status not in ('upcoming', 'in_progress', 'completed', 'attention', 'blocked', 'not_applicable') then
    raise exception 'Invalid stage status.' using errcode = '22023';
  end if;
  if p_document_id is not null and not exists (
       select 1 from public.documents where id = p_document_id and order_id = s.order_id) then
    raise exception 'Document does not belong to this order.' using errcode = '23514';
  end if;

  if p_status in ('in_progress', 'completed') then
    update public.order_stages
       set status = 'completed'
     where order_id = s.order_id
       and position < s.position
       and status in ('upcoming', 'in_progress')
       and not is_payment_stage;
  end if;

  update public.order_stages
     set status = p_status,
         details = coalesce(p_details, details),
         customer_note = case when p_customer_visible and v_note is not null then v_note else customer_note end
   where id = s.id;

  insert into public.order_updates (order_id, stage_id, stage_name, status, note, customer_visible, document_id)
  values (s.order_id, s.id, s.name, p_status, v_note, coalesce(p_customer_visible, true), p_document_id)
  returning id into v_id;

  return v_id;
end $$;

create trigger order_updates_created before insert on public.order_updates
  for each row execute function public.tg_set_created_by();
create trigger documents_created before insert on public.documents
  for each row execute function public.tg_set_created_by();

create or replace function public.tg_update_validate() returns trigger
language plpgsql as $$
begin
  if new.stage_id is not null and not exists (
       select 1 from public.order_stages where id = new.stage_id and order_id = new.order_id) then
    raise exception 'Stage does not belong to this order.' using errcode = '23514';
  end if;
  if new.document_id is not null and not exists (
       select 1 from public.documents where id = new.document_id and order_id = new.order_id) then
    raise exception 'Document does not belong to this order.' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger order_updates_validate before insert on public.order_updates
  for each row execute function public.tg_update_validate();

create or replace function public.tg_touch_order() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_order uuid := coalesce(new.order_id, old.order_id);
begin
  update public.orders set updated_at = now() where id = v_order;
  return coalesce(new, old);
end $$;
create trigger order_updates_touch after insert on public.order_updates
  for each row execute function public.tg_touch_order();
create trigger documents_touch after insert or update or delete on public.documents
  for each row execute function public.tg_touch_order();

create or replace function public.tg_document_before_update() returns trigger
language plpgsql as $$
begin
  new.order_id := old.order_id;
  new.storage_path := old.storage_path;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  return new;
end $$;
create trigger documents_before_update before update on public.documents
  for each row execute function public.tg_document_before_update();

create or replace function public.recompute_order_payments(p_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_received numeric(14, 2);
  v_init boolean;
begin
  select coalesce(sum(amount) filter (where status = 'confirmed'), 0),
         coalesce(bool_or(status = 'initiated'), false)
    into v_received, v_init
    from public.payments where order_id = p_order_id;

  update public.orders o
     set amount_received = v_received,
         payment_status = public.calc_payment_status(
           coalesce(o.final_invoice_amount, o.proforma_amount), v_received, v_init)
   where o.id = p_order_id;
end $$;

create or replace function public.tg_payment_before() returns trigger
language plpgsql as $$
declare v_currency text;
begin
  if tg_op = 'UPDATE' then
    new.order_id := old.order_id;
  end if;
  new.currency := upper(new.currency);
  select currency into v_currency from public.orders where id = new.order_id;
  if v_currency is not null and new.currency <> v_currency then
    raise exception 'Payment currency (%) must match the order currency (%).', new.currency, v_currency
      using errcode = '23514';
  end if;
  if new.document_id is not null and not exists (
       select 1 from public.documents where id = new.document_id and order_id = new.order_id) then
    raise exception 'Document does not belong to this order.' using errcode = '23514';
  end if;
  if new.status = 'confirmed' and (tg_op = 'INSERT' or old.status <> 'confirmed') then
    new.confirmed_at := now();
    new.confirmed_by := coalesce(auth.uid(), new.confirmed_by);
  elsif new.status <> 'confirmed' then
    new.confirmed_at := null;
    new.confirmed_by := null;
  end if;
  return new;
end $$;

create or replace function public.tg_payment_after() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.recompute_order_payments(coalesce(new.order_id, old.order_id));
  return coalesce(new, old);
end $$;

create trigger payments_before before insert or update on public.payments
  for each row execute function public.tg_payment_before();
create trigger payments_created before insert on public.payments
  for each row execute function public.tg_set_created_by();
create trigger payments_updated before update on public.payments
  for each row execute function public.tg_set_updated();
create trigger payments_keep_created before update on public.payments
  for each row execute function public.tg_keep_created_by();
create trigger payments_after after insert or update or delete on public.payments
  for each row execute function public.tg_payment_after();

create or replace function public.tg_shipment_before() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    new.order_id := old.order_id;
  end if;
  new.courier := trim(new.courier);
  new.tracking_number := nullif(trim(coalesce(new.tracking_number, '')), '');
  new.tracking_url := nullif(trim(coalesce(new.tracking_url, '')), '');
  if new.status = 'delivered' then
    new.delivered_at := coalesce(new.delivered_at, now());
  else
    new.delivered_at := null;
  end if;
  if new.status in ('shipped', 'in_transit', 'delivered') and new.shipped_date is null then
    new.shipped_date := current_date;
  end if;
  if new.document_id is not null and not exists (
       select 1 from public.documents where id = new.document_id and order_id = new.order_id) then
    raise exception 'Document does not belong to this order.' using errcode = '23514';
  end if;
  return new;
end $$;

create or replace function public.tg_shipment_after() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_shipped public.order_stages%rowtype;
  v_open int;
  v_label text;
begin
  if tg_op = 'UPDATE' and new.status = old.status
     and new.tracking_number is not distinct from old.tracking_number then
    return new;
  end if;

  if new.status in ('shipped', 'in_transit', 'delivered') then
    select * into v_shipped from public.order_stages
     where order_id = new.order_id and stage_key = 'shipped';
    if found then
      update public.order_stages
         set status = 'completed'
       where order_id = new.order_id and position < v_shipped.position
         and status in ('upcoming', 'in_progress') and not is_payment_stage;
      update public.order_stages
         set status = 'completed',
             details = details || case when new.tracking_number is not null
                                       then jsonb_build_object('tracking_added', now()) else '{}'::jsonb end
       where id = v_shipped.id and status <> 'completed';
    end if;
  end if;

  if new.status = 'delivered' then
    select count(*) into v_open from public.shipments
     where order_id = new.order_id and status <> 'delivered';
    if v_open = 0 then
      update public.order_stages set status = 'completed'
       where order_id = new.order_id and stage_key = 'delivered' and status <> 'completed';
    end if;
  end if;

  v_label := case new.status
               when 'preparing' then 'Shipment being prepared'
               when 'shipped' then 'Shipped'
               when 'in_transit' then 'In transit'
               when 'delivered' then 'Delivered' end;
  insert into public.order_updates (order_id, stage_name, status, note, customer_visible, created_by)
  values (new.order_id, 'Shipping', new.status,
          v_label || ' via ' || new.courier ||
          case when new.tracking_number is not null then ' — tracking ' || new.tracking_number else '' end,
          true, coalesce(auth.uid(), new.updated_by, new.created_by));
  return new;
end $$;

create trigger shipments_before before insert or update on public.shipments
  for each row execute function public.tg_shipment_before();
create trigger shipments_created before insert on public.shipments
  for each row execute function public.tg_set_created_by();
create trigger shipments_updated before update on public.shipments
  for each row execute function public.tg_set_updated();
create trigger shipments_keep_created before update on public.shipments
  for each row execute function public.tg_keep_created_by();
create trigger shipments_after after insert or update on public.shipments
  for each row execute function public.tg_shipment_after();
create trigger shipments_touch after insert or update or delete on public.shipments
  for each row execute function public.tg_touch_order();

create trigger app_settings_updated before update on public.app_settings
  for each row execute function public.tg_set_updated();