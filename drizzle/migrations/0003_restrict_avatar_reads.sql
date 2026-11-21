drop policy if exists "avatars: read" on storage.objects;
create policy "avatars: read" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (
    split_part(name, '/', 1) = auth.uid()::text
    or public.is_staff()
    or exists (
      select 1 from public.customers c
       where c.id = public.my_customer_id()
         and (c.assigned_executive_id::text = split_part(name, '/', 1)
              or exists (select 1 from public.orders o
                          where o.customer_id = c.id
                            and o.executive_override_id::text = split_part(name, '/', 1))))
  ));