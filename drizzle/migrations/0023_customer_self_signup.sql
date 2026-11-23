CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_role text := 'customer'; v_cust uuid; v_exec uuid; v_name text;
begin
  if not exists (select 1 from public.profiles where role = 'admin') then
    v_role := 'admin';
  end if;
  v_name := coalesce(new.raw_user_meta_data ->> 'full_name', '');
  if v_role = 'customer' and coalesce(new.raw_user_meta_data ->> 'self_signup', '') = 'true' then
    select id into v_exec from public.profiles where role = 'admin' and is_active order by created_at limit 1;
    insert into public.customers (name, contact_person, email, country, assigned_executive_id, created_by)
    values (coalesce(nullif(trim(new.raw_user_meta_data ->> 'company_name'), ''), nullif(v_name, ''), new.email),
            nullif(v_name, ''), new.email, '', v_exec, new.id)
    returning id into v_cust;
  end if;
  insert into public.profiles (id, email, full_name, role, customer_id)
  values (new.id, new.email, v_name, v_role, v_cust)
  on conflict (id) do nothing;
  return new;
end $function$;