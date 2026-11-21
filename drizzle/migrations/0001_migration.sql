revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, public;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, public;

grant usage on schema public to authenticated;

grant select on public.app_settings to authenticated;
grant update (company_name, tagline, email, phone, whatsapp, website, address, default_currency, team_sees_all)
  on public.app_settings to authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, job_title, phone, whatsapp, photo_url, role, is_active) on public.profiles to authenticated;
grant select on public.customers to authenticated;
grant insert (name, contact_person, email, phone, country, address, internal_notes, assigned_executive_id)
  on public.customers to authenticated;
grant update (name, contact_person, email, phone, country, address, internal_notes, assigned_executive_id)
  on public.customers to authenticated;
grant delete on public.customers to authenticated;
grant select on public.orders to authenticated;
grant insert (customer_id, order_type, title, customer_po_ref, currency, proforma_amount, final_invoice_amount,
              expected_delivery_date, notes, executive_override_id)
  on public.orders to authenticated;
grant update (customer_id, title, customer_po_ref, currency, proforma_amount, final_invoice_amount,
              expected_delivery_date, notes, executive_override_id, status)
  on public.orders to authenticated;
grant delete on public.orders to authenticated;
grant select on public.order_stages to authenticated;
grant update (status, customer_note, details) on public.order_stages to authenticated;
grant select on public.order_updates to authenticated;
grant insert (order_id, stage_id, stage_name, status, note, customer_visible, document_id)
  on public.order_updates to authenticated;
grant select on public.payments to authenticated;
grant insert (order_id, amount, currency, payment_date, method, payment_type, status, reference, notes, document_id)
  on public.payments to authenticated;
grant update (amount, currency, payment_date, method, payment_type, status, reference, notes, document_id)
  on public.payments to authenticated;
grant delete on public.payments to authenticated;
grant select on public.documents to authenticated;
grant insert (order_id, name, doc_type, storage_path, mime_type, size_bytes, customer_visible)
  on public.documents to authenticated;
grant update (name, doc_type, customer_visible) on public.documents to authenticated;
grant delete on public.documents to authenticated;
grant select on public.shipments to authenticated;
grant insert (order_id, courier, tracking_number, tracking_url, shipped_date, estimated_delivery_date, status, document_id)
  on public.shipments to authenticated;
grant update (courier, tracking_number, tracking_url, shipped_date, estimated_delivery_date, status, document_id)
  on public.shipments to authenticated;
grant delete on public.shipments to authenticated;

grant execute on function public.try_uuid(text) to authenticated;
grant execute on function public.auth_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.my_customer_id() to authenticated;
grant execute on function public.staff_can_access_customer(uuid) to authenticated;
grant execute on function public.staff_can_access_order(uuid) to authenticated;
grant execute on function public.calc_payment_status(numeric, numeric, boolean) to authenticated;
grant execute on function public.record_stage_update(uuid, text, text, boolean, jsonb, uuid) to authenticated;
revoke execute on function public.promote_to_admin(text) from authenticated;
revoke execute on function public.recompute_order_progress(uuid) from authenticated;
revoke execute on function public.recompute_order_payments(uuid) from authenticated;
revoke execute on function public.create_default_stages(uuid, text) from authenticated;

alter table public.app_settings  enable row level security;
alter table public.profiles      enable row level security;
alter table public.customers     enable row level security;
alter table public.orders        enable row level security;
alter table public.order_stages  enable row level security;
alter table public.order_updates enable row level security;
alter table public.payments      enable row level security;
alter table public.documents     enable row level security;
alter table public.shipments     enable row level security;

create policy app_settings_read on public.app_settings for select to authenticated using (true);
create policy app_settings_admin_update on public.app_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create or replace function public.team_sees_all() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select team_sees_all from public.app_settings where id = 1), false)
$$;
grant execute on function public.team_sees_all() to authenticated;

create policy customers_read on public.customers for select to authenticated
  using (public.is_admin()
         or (public.is_staff() and (assigned_executive_id = auth.uid()
                                    or created_by = auth.uid()
                                    or public.team_sees_all())));
create policy customers_insert on public.customers for insert to authenticated
  with check (public.is_staff());
create policy customers_update on public.customers for update to authenticated
  using (public.is_admin()
         or (public.is_staff() and (assigned_executive_id = auth.uid()
                                    or created_by = auth.uid()
                                    or public.team_sees_all())))
  with check (public.is_staff());
create policy customers_delete on public.customers for delete to authenticated
  using (public.is_admin());

create policy orders_read on public.orders for select to authenticated
  using (public.is_admin()
         or (public.is_staff() and (executive_override_id = auth.uid()
                                    or created_by = auth.uid()
                                    or public.staff_can_access_customer(customer_id))));
create policy orders_insert on public.orders for insert to authenticated
  with check (public.is_staff() and public.staff_can_access_customer(customer_id));
create policy orders_update on public.orders for update to authenticated
  using (public.is_admin()
         or (public.is_staff() and (executive_override_id = auth.uid()
                                    or created_by = auth.uid()
                                    or public.staff_can_access_customer(customer_id))))
  with check (public.is_staff() and (public.staff_can_access_customer(customer_id) or public.staff_can_access_order(id)));
create policy orders_delete on public.orders for delete to authenticated
  using (public.is_admin());

create policy order_stages_read on public.order_stages for select to authenticated
  using (public.staff_can_access_order(order_id));
create policy order_stages_update on public.order_stages for update to authenticated
  using (public.staff_can_access_order(order_id))
  with check (public.staff_can_access_order(order_id));

create policy order_updates_read on public.order_updates for select to authenticated
  using (public.staff_can_access_order(order_id));
create policy order_updates_insert on public.order_updates for insert to authenticated
  with check (public.staff_can_access_order(order_id));

create policy payments_read on public.payments for select to authenticated
  using (public.staff_can_access_order(order_id));
create policy payments_insert on public.payments for insert to authenticated
  with check (public.staff_can_access_order(order_id));
create policy payments_update on public.payments for update to authenticated
  using (public.staff_can_access_order(order_id))
  with check (public.staff_can_access_order(order_id));
create policy payments_delete on public.payments for delete to authenticated
  using (public.is_admin());

create policy documents_read on public.documents for select to authenticated
  using (public.staff_can_access_order(order_id));
create policy documents_insert on public.documents for insert to authenticated
  with check (public.staff_can_access_order(order_id));
create policy documents_update on public.documents for update to authenticated
  using (public.staff_can_access_order(order_id))
  with check (public.staff_can_access_order(order_id));
create policy documents_delete on public.documents for delete to authenticated
  using (public.is_admin() or (public.staff_can_access_order(order_id) and created_by = auth.uid()));

create policy shipments_read on public.shipments for select to authenticated
  using (public.staff_can_access_order(order_id));
create policy shipments_insert on public.shipments for insert to authenticated
  with check (public.staff_can_access_order(order_id));
create policy shipments_update on public.shipments for update to authenticated
  using (public.staff_can_access_order(order_id))
  with check (public.staff_can_access_order(order_id));
create policy shipments_delete on public.shipments for delete to authenticated
  using (public.is_admin());

create or replace function public.customer_portal_status(cid uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when not public.staff_can_access_customer(cid) then null
    else coalesce((
      select case when not p.is_active then 'disabled'
                  when u.last_sign_in_at is not null then 'active'
                  else 'invited' end
        from public.profiles p
        join auth.users u on u.id = p.id
       where p.customer_id = cid and p.role = 'customer'
       order by u.last_sign_in_at desc nulls last
       limit 1), 'not_invited')
  end
$$;
grant execute on function public.customer_portal_status(uuid) to authenticated;

create or replace view public.customer_list with (security_invoker = true) as
select
  c.*,
  ex.full_name as executive_name,
  (select count(*) from public.orders o where o.customer_id = c.id and o.status = 'active')::int as active_orders,
  (select count(*) from public.orders o where o.customer_id = c.id and o.status = 'completed')::int as completed_orders,
  greatest(c.last_activity_at, (select max(o.updated_at) from public.orders o where o.customer_id = c.id)) as last_activity,
  public.customer_portal_status(c.id) as portal_status
from public.customers c
left join public.profiles ex on ex.id = c.assigned_executive_id;

create or replace view public.order_list with (security_invoker = true) as
select
  o.*,
  c.name as customer_name,
  c.country as customer_country,
  coalesce(o.executive_override_id, c.assigned_executive_id) as executive_id,
  ex.full_name as executive_name,
  coalesce(o.final_invoice_amount, o.proforma_amount) as total_amount,
  case
    when o.status <> 'active' then null
    when exists (select 1 from public.order_stages s where s.order_id = o.id and s.status = 'blocked')
      then 'Resolve blocked stage'
    when exists (select 1 from public.order_stages s where s.order_id = o.id and s.status = 'attention')
      then 'Approval / recheck required'
    when exists (select 1 from public.payments p where p.order_id = o.id and p.status = 'initiated')
      then 'Verify initiated payment'
    when exists (select 1 from public.shipments sh where sh.order_id = o.id
                  and sh.tracking_number is null and sh.status <> 'delivered')
      then 'Add shipment tracking'
    when o.current_stage_key = 'ready_to_ship'
      then 'Dispatch & add tracking'
    when o.current_stage_key in ('shipped', 'delivered')
         and not exists (select 1 from public.shipments sh where sh.order_id = o.id)
      then 'Add shipment tracking'
    when o.current_stage_key = 'order_confirmed'
      then 'Confirm order & share proforma'
    when o.current_stage_key in ('proforma', 'payment_in_progress', 'payment_confirmed', 'advance_payment', 'final_payment')
      then case when coalesce(o.final_invoice_amount, o.proforma_amount) is null
                then 'Add order amount' else 'Follow up payment' end
    when o.current_stage_key = 'cad_approval'
      then 'CAD approval pending'
    when o.current_stage_key in ('diamond_preparation', 'manufacturing') and o.current_stage_status = 'upcoming'
      then 'Start preparation'
    when o.balance_due > 0 and exists (
           select 1 from public.order_stages s
            where s.order_id = o.id and s.is_payment_stage and s.status in ('upcoming', 'in_progress')
              and s.position < (select s2.position from public.order_stages s2
                                 where s2.order_id = o.id and s2.stage_key = o.current_stage_key))
      then 'Payment pending'
    else null
  end as next_action
from public.orders o
join public.customers c on c.id = o.customer_id
left join public.profiles ex on ex.id = coalesce(o.executive_override_id, c.assigned_executive_id);

grant select on public.customer_list to authenticated;
grant select on public.order_list to authenticated;

create or replace function public.can_read_document_object(p_path text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when public.is_staff() then public.staff_can_access_order(public.try_uuid(split_part(p_path, '/', 1)))
    else exists (
      select 1
        from public.documents d
        join public.orders o on o.id = d.order_id
       where d.storage_path = p_path
         and d.customer_visible
         and o.status <> 'cancelled'
         and o.customer_id = public.my_customer_id())
  end
$$;
grant execute on function public.can_read_document_object(text) to authenticated;

create policy "order documents: read" on storage.objects for select to authenticated
  using (bucket_id = 'order-documents' and public.can_read_document_object(name));
create policy "order documents: upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'order-documents' and public.is_staff()
              and public.staff_can_access_order(public.try_uuid(split_part(name, '/', 1))));
create policy "order documents: delete" on storage.objects for delete to authenticated
  using (bucket_id = 'order-documents' and public.is_staff()
         and public.staff_can_access_order(public.try_uuid(split_part(name, '/', 1))));

create policy "avatars: staff upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and public.is_staff()
              and (split_part(name, '/', 1) = auth.uid()::text or public.is_admin()));
create policy "avatars: staff update own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and public.is_staff()
         and (split_part(name, '/', 1) = auth.uid()::text or public.is_admin()));
create policy "avatars: staff delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and public.is_staff()
         and (split_part(name, '/', 1) = auth.uid()::text or public.is_admin()));
create policy "avatars: read" on storage.objects for select to authenticated
  using (bucket_id = 'avatars');

-- Portal
grant all on all tables in schema public to service_role;
grant all on all functions in schema public to service_role;

create or replace function public.portal_executive_json(p_exec uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', p.id, 'full_name', p.full_name, 'job_title', p.job_title, 'email', p.email,
    'phone', p.phone, 'whatsapp', p.whatsapp, 'photo_url', p.photo_url)
  from public.profiles p where p.id = p_exec
$$;
revoke execute on function public.portal_executive_json(uuid) from authenticated, anon, public;

create or replace function public.portal_home() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_cid uuid := public.my_customer_id();
  v_result jsonb;
begin
  if v_cid is null then
    raise exception 'Customer portal access is not set up for this account.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'customer', jsonb_build_object(
        'id', c.id, 'name', c.name, 'contact_person', c.contact_person, 'email', c.email,
        'phone', c.phone, 'country', c.country, 'address', c.address),
    'me', (select jsonb_build_object('full_name', p.full_name, 'email', p.email, 'phone', p.phone)
             from public.profiles p where p.id = auth.uid()),
    'executive', public.portal_executive_json(c.assigned_executive_id),
    'company', (select jsonb_build_object('company_name', s.company_name, 'tagline', s.tagline,
                  'email', s.email, 'phone', s.phone, 'whatsapp', s.whatsapp, 'website', s.website)
                  from public.app_settings s where s.id = 1),
    'orders', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', o.id, 'reference', o.reference, 'order_type', o.order_type, 'title', o.title,
          'customer_po_ref', o.customer_po_ref, 'status', o.status,
          'current_stage_name', o.current_stage_name, 'current_stage_status', o.current_stage_status,
          'progress_pct', o.progress_pct, 'currency', o.currency,
          'total_amount', coalesce(o.final_invoice_amount, o.proforma_amount),
          'expected_delivery_date', o.expected_delivery_date, 'updated_at', o.updated_at,
          'created_at', o.created_at, 'completed_at', o.completed_at,
          'latest_update', (select jsonb_build_object('note', u.note, 'stage_name', u.stage_name, 'created_at', u.created_at)
                              from public.order_updates u
                             where u.order_id = o.id and u.customer_visible
                             order by u.created_at desc limit 1)
        ) order by o.updated_at desc)
        from public.orders o
       where o.customer_id = c.id and o.status <> 'cancelled'), '[]'::jsonb)
  ) into v_result
  from public.customers c where c.id = v_cid;

  return v_result;
end $$;

create or replace function public.portal_order(p_order_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_cid uuid := public.my_customer_id();
  o public.orders%rowtype;
  v_exec uuid;
begin
  if v_cid is null then
    raise exception 'Customer portal access is not set up for this account.' using errcode = '42501';
  end if;
  select * into o from public.orders
   where id = p_order_id and customer_id = v_cid and status <> 'cancelled';
  if not found then
    raise exception 'Order not found.' using errcode = 'P0002';
  end if;
  select coalesce(o.executive_override_id, c.assigned_executive_id) into v_exec
    from public.customers c where c.id = o.customer_id;

  return jsonb_build_object(
    'order', jsonb_build_object(
      'id', o.id, 'reference', o.reference, 'order_type', o.order_type, 'title', o.title,
      'customer_po_ref', o.customer_po_ref, 'status', o.status,
      'current_stage_key', o.current_stage_key, 'current_stage_name', o.current_stage_name,
      'current_stage_status', o.current_stage_status, 'progress_pct', o.progress_pct,
      'expected_delivery_date', o.expected_delivery_date, 'created_at', o.created_at,
      'updated_at', o.updated_at, 'completed_at', o.completed_at,
      'feedback_rating', o.feedback_rating, 'feedback_comment', o.feedback_comment),
    'payment', jsonb_build_object(
      'currency', o.currency, 'proforma_amount', o.proforma_amount,
      'final_invoice_amount', o.final_invoice_amount, 'amount_received', o.amount_received,
      'balance_due', o.balance_due, 'payment_status', o.payment_status,
      'payments', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', p.id, 'amount', p.amount, 'currency', p.currency, 'payment_date', p.payment_date,
          'payment_type', p.payment_type, 'status', p.status, 'reference', p.reference)
          order by p.payment_date, p.created_at)
        from public.payments p where p.order_id = o.id and p.status <> 'failed'), '[]'::jsonb)),
    'executive', public.portal_executive_json(v_exec),
    'stages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'stage_key', s.stage_key, 'name', s.name, 'position', s.position,
        'status', s.status, 'completed_at', s.completed_at, 'customer_note', s.customer_note,
        'details', s.details) order by s.position)
      from public.order_stages s where s.order_id = o.id), '[]'::jsonb),
    'updates', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', u.id, 'stage_name', u.stage_name, 'status', u.status, 'note', u.note,
        'created_at', u.created_at) order by u.created_at desc)
      from (select * from public.order_updates
             where order_id = o.id and customer_visible
             order by created_at desc limit 30) u), '[]'::jsonb),
    'documents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'name', d.name, 'doc_type', d.doc_type, 'storage_path', d.storage_path,
        'mime_type', d.mime_type, 'size_bytes', d.size_bytes, 'created_at', d.created_at)
        order by d.created_at desc)
      from public.documents d where d.order_id = o.id and d.customer_visible), '[]'::jsonb),
    'shipments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', sh.id, 'courier', sh.courier, 'tracking_number', sh.tracking_number,
        'tracking_url', sh.tracking_url, 'shipped_date', sh.shipped_date,
        'estimated_delivery_date', sh.estimated_delivery_date, 'status', sh.status,
        'delivered_at', sh.delivered_at) order by sh.created_at)
      from public.shipments sh where sh.order_id = o.id), '[]'::jsonb)
  );
end $$;

create or replace function public.portal_submit_feedback(p_order_id uuid, p_rating int, p_comment text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare v_cid uuid := public.my_customer_id();
begin
  if v_cid is null then
    raise exception 'Customer portal access is not set up for this account.' using errcode = '42501';
  end if;
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'Rating must be between 1 and 5.' using errcode = '22023';
  end if;
  update public.orders
     set feedback_rating = p_rating,
         feedback_comment = nullif(left(trim(coalesce(p_comment, '')), 2000), ''),
         feedback_at = now()
   where id = p_order_id and customer_id = v_cid and status = 'completed';
  if not found then
    raise exception 'Feedback can be shared once the order has been delivered.' using errcode = '22023';
  end if;
end $$;

create or replace function public.portal_update_profile(p_full_name text, p_phone text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.my_customer_id() is null then
    raise exception 'Customer portal access is not set up for this account.' using errcode = '42501';
  end if;
  update public.profiles
     set full_name = left(trim(coalesce(p_full_name, '')), 120),
         phone = nullif(left(trim(coalesce(p_phone, '')), 50), '')
   where id = auth.uid();
end $$;

grant execute on function public.portal_home() to authenticated;
grant execute on function public.portal_order(uuid) to authenticated;
grant execute on function public.portal_submit_feedback(uuid, int, text) to authenticated;
grant execute on function public.portal_update_profile(text, text) to authenticated;

create or replace function public.admin_user_directory()
returns table (
  id uuid, email text, full_name text, role text, is_active boolean, customer_id uuid, customer_name text,
  job_title text, phone text, whatsapp text, photo_url text, created_at timestamptz, last_sign_in_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Administrators only.' using errcode = '42501';
  end if;
  return query
    select p.id, p.email, p.full_name, p.role, p.is_active, p.customer_id, c.name,
           p.job_title, p.phone, p.whatsapp, p.photo_url, p.created_at, u.last_sign_in_at
      from public.profiles p
      join auth.users u on u.id = p.id
      left join public.customers c on c.id = p.customer_id
     order by p.role, p.full_name;
end $$;
grant execute on function public.admin_user_directory() to authenticated;