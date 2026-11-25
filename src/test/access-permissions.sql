-- Transactional database regression tests; all fixtures and role changes roll back.
BEGIN;
DO $$
DECLARE
  executive uuid; other_executive uuid; administrator uuid;
  own_customer uuid:=gen_random_uuid(); other_customer uuid:=gen_random_uuid();
  own_order uuid:=gen_random_uuid(); other_order uuid:=gen_random_uuid(); override_order uuid:=gen_random_uuid();
BEGIN
  SELECT user_id INTO executive FROM public.user_roles WHERE role='seller' ORDER BY user_id LIMIT 1;
  SELECT user_id INTO other_executive FROM public.user_roles WHERE role='seller' AND user_id<>executive ORDER BY user_id LIMIT 1;
  SELECT user_id INTO administrator FROM public.user_roles WHERE role='admin' LIMIT 1;
  IF executive IS NULL OR other_executive IS NULL OR administrator IS NULL THEN RAISE EXCEPTION 'Access tests require two existing executives and one administrator'; END IF;
  UPDATE public.app_settings SET team_sees_all=true WHERE id=1;
  INSERT INTO public.customers(id,name,email,country,assigned_executive_id,created_by) VALUES
    (own_customer,'Temporary access test A',own_customer::text||'@example.invalid','',executive,other_executive),
    (other_customer,'Temporary access test B',other_customer::text||'@example.invalid','',other_executive,executive);
  INSERT INTO public.orders(id,customer_id,order_type,title,currency,created_by,executive_override_id) VALUES
    (own_order,own_customer,'diamond','Temporary access A','USD',other_executive,NULL),
    (other_order,other_customer,'diamond','Temporary access B','USD',executive,NULL),
    (override_order,own_customer,'diamond','Temporary override','USD',executive,other_executive);
  PERFORM set_config('request.jwt.claim.sub',executive::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',executive,'role','authenticated')::text,true);
  IF NOT public.staff_can_access_customer(own_customer) THEN RAISE EXCEPTION 'Assigned customer must be visible'; END IF;
  IF public.staff_can_access_customer(other_customer) THEN RAISE EXCEPTION 'Creator must not see another executive customer'; END IF;
  IF NOT public.staff_can_access_order(own_order) THEN RAISE EXCEPTION 'Assigned order must be visible'; END IF;
  IF public.staff_can_access_order(other_order) THEN RAISE EXCEPTION 'Creator must not see another executive order'; END IF;
  IF public.staff_can_access_order(override_order) THEN RAISE EXCEPTION 'Executive override must take precedence'; END IF;
  PERFORM set_config('role','authenticated',true);
  IF EXISTS(SELECT 1 FROM public.customers WHERE id=other_customer) THEN RAISE EXCEPTION 'Customer RLS leaked another executive record'; END IF;
  IF EXISTS(SELECT 1 FROM public.orders WHERE id IN (other_order,override_order)) THEN RAISE EXCEPTION 'Order RLS leaked another executive record'; END IF;
  PERFORM set_config('role','postgres',true);
  PERFORM set_config('request.jwt.claim.sub',administrator::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',administrator,'role','authenticated')::text,true);
  IF NOT public.staff_can_access_customer(other_customer) OR NOT public.staff_can_access_order(other_order) THEN RAISE EXCEPTION 'Admin must retain all records'; END IF;
  IF public.is_super_admin() THEN RAISE EXCEPTION 'Admin must not gain Super Admin access'; END IF;
  BEGIN
    PERFORM public.admin_seller_directory();
    RAISE EXCEPTION 'Admin must not read seller requests';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM set_config('request.jwt.claim.sub','',true);
  PERFORM set_config('request.jwt.claims','{}',true);
  UPDATE public.user_roles SET role='super_admin' WHERE user_id=administrator;
  PERFORM set_config('request.jwt.claim.sub',administrator::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',administrator,'role','authenticated')::text,true);
  IF NOT public.is_super_admin() OR NOT public.is_admin() THEN RAISE EXCEPTION 'Super Admin must retain complete management access'; END IF;
  PERFORM public.admin_seller_directory();
END $$;
ROLLBACK;