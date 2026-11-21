-- Bootstrap: the very first account created (via Cloud > Users > Add user) becomes an administrator,
-- so the workspace can be set up without SQL access. Every later account starts as an unlinked customer.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_role text := 'customer';
begin
  if not exists (select 1 from public.profiles where role = 'admin') then
    v_role := 'admin';
  end if;
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''), v_role)
  on conflict (id) do nothing;
  return new;
end $$;