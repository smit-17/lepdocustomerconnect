CREATE OR REPLACE FUNCTION public.tg_protect_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  new.updated_at := now();
  SELECT u.email INTO new.email FROM auth.users u WHERE u.id = old.id;
  new.email := coalesce(new.email, old.email);
  IF auth.uid() IS NULL THEN RETURN new; END IF;
  IF (new.role IS DISTINCT FROM old.role OR new.is_active IS DISTINCT FROM old.is_active OR new.customer_id IS DISTINCT FROM old.customer_id) THEN
    IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only an administrator can change roles or account status.' USING ERRCODE='42501'; END IF;
    IF new.id = auth.uid() THEN RAISE EXCEPTION 'You cannot change your own role or deactivate your own account.' USING ERRCODE='42501'; END IF;
    IF new.role <> 'customer' THEN new.customer_id := NULL; END IF;
  END IF;
  RETURN new;
END;
$$;