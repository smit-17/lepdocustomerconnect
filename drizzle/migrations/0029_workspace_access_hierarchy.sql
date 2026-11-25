ALTER TABLE public.user_roles DROP CONSTRAINT user_roles_role_check;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_role_check CHECK (role IN ('super_admin','admin','team','customer','seller'));
CREATE OR REPLACE FUNCTION public.is_super_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT coalesce(public.auth_role()='super_admin',false) $$;
REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT coalesce(public.auth_role() IN ('super_admin','admin'),false) $$;
CREATE OR REPLACE FUNCTION public.is_operator() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT coalesce(public.auth_role() IN ('super_admin','admin','seller'),false) $$;
CREATE OR REPLACE FUNCTION public.is_staff() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT coalesce(public.auth_role() IN ('super_admin','admin','team','seller'),false) $$;
CREATE OR REPLACE FUNCTION public.staff_can_access_customer(cid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.is_admin() OR (public.is_staff() AND EXISTS(SELECT 1 FROM public.customers c WHERE c.id=cid AND c.assigned_executive_id=auth.uid())) $$;
CREATE OR REPLACE FUNCTION public.staff_can_access_order(oid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.is_admin() OR (public.is_staff() AND EXISTS(SELECT 1 FROM public.orders o JOIN public.customers c ON c.id=o.customer_id WHERE o.id=oid AND coalesce(o.executive_override_id,c.assigned_executive_id)=auth.uid())) $$;
ALTER POLICY customers_read ON public.customers USING (staff_can_access_customer(id));
ALTER POLICY customers_update ON public.customers USING (staff_can_access_customer(id)) WITH CHECK (staff_can_access_customer(id));
ALTER POLICY customers_insert ON public.customers WITH CHECK (is_staff() AND (is_admin() OR assigned_executive_id=auth.uid()));
ALTER POLICY customers_delete ON public.customers USING (is_operator() AND staff_can_access_customer(id));
ALTER POLICY orders_read ON public.orders USING (staff_can_access_order(id));
ALTER POLICY orders_update ON public.orders USING (staff_can_access_order(id)) WITH CHECK (staff_can_access_order(id));
ALTER POLICY orders_insert ON public.orders WITH CHECK (is_staff() AND (is_admin() OR (staff_can_access_customer(customer_id) AND coalesce(executive_override_id,auth.uid())=auth.uid())));
ALTER POLICY orders_delete ON public.orders USING (is_operator() AND staff_can_access_order(id));
ALTER POLICY documents_delete ON public.documents USING (staff_can_access_order(order_id) AND (is_operator() OR created_by=auth.uid()));
ALTER POLICY payments_delete ON public.payments USING (is_operator() AND staff_can_access_order(order_id));
ALTER POLICY shipments_delete ON public.shipments USING (is_operator() AND staff_can_access_order(order_id));
ALTER POLICY seller_requests_read ON public.seller_requests USING (user_id=auth.uid() OR is_super_admin());
ALTER POLICY profiles_read ON public.profiles USING (id=auth.uid() OR (is_staff() AND (is_super_admin() OR NOT EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=profiles.id AND r.role='super_admin'))));
ALTER POLICY profiles_update ON public.profiles USING (id=auth.uid() OR (is_admin() AND (is_super_admin() OR NOT EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=profiles.id AND r.role='super_admin')))) WITH CHECK (id=auth.uid() OR (is_admin() AND (is_super_admin() OR NOT EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=profiles.id AND r.role='super_admin'))));
ALTER POLICY roles_read ON public.user_roles USING (user_id=auth.uid() OR is_super_admin() OR (is_admin() AND role<>'super_admin'));
DO $$ DECLARE f record; definition text; BEGIN
 FOR f IN SELECT oid FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('admin_manage_seller','admin_delete_seller','admin_review_seller','admin_seller_directory') LOOP
 definition:=replace(pg_get_functiondef(f.oid),'public.is_admin()','public.is_super_admin()'); EXECUTE definition;
 END LOOP;
 SELECT pg_get_functiondef(oid) INTO definition FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='admin_user_directory';
 definition:=replace(definition,'ORDER BY r.role,p.full_name','WHERE (public.is_super_admin() OR r.role<>''super_admin'') ORDER BY r.role,p.full_name'); EXECUTE definition;
 SELECT pg_get_functiondef(oid) INTO definition FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='admin_delete_order_history';
 definition:=replace(definition,'IF p_order_id IS NULL AND p_confirmation', 'IF p_order_id IS NOT NULL AND NOT public.staff_can_access_order(p_order_id) THEN RAISE EXCEPTION ''Order access denied'' USING ERRCODE=''42501''; END IF; IF p_order_id IS NULL AND p_confirmation'); EXECUTE definition;
 SELECT pg_get_functiondef(oid) INTO definition FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='admin_save_order_workflow';
 definition:=replace(definition,'PERFORM public.apply_order_workflow','IF NOT public.staff_can_access_order(p_order_id) THEN RAISE EXCEPTION ''Order access denied'' USING ERRCODE=''42501''; END IF; PERFORM public.apply_order_workflow'); EXECUTE definition;
 SELECT pg_get_functiondef(oid) INTO definition FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='admin_save_workflow';
 definition:=replace(definition,'public.is_operator()','public.is_admin()'); EXECUTE definition;
END $$;
CREATE OR REPLACE FUNCTION public.guard_profile_hierarchy() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 IF OLD.id<>auth.uid() AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=OLD.id AND role='super_admin') THEN RAISE EXCEPTION 'Super Admin account settings are private' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=OLD.id AND role='seller') AND (NEW.role IS DISTINCT FROM OLD.role OR NEW.is_active IS DISTINCT FROM OLD.is_active) AND NOT public.is_super_admin() THEN RAISE EXCEPTION 'Only Super Admin manages seller approval and access' USING ERRCODE='42501'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER profile_hierarchy_guard BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_profile_hierarchy();
CREATE OR REPLACE FUNCTION public.guard_executive_assignment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF auth.uid() IS NULL OR public.is_admin() THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='customers' AND NEW.assigned_executive_id<>auth.uid() THEN RAISE EXCEPTION 'Executives may manage only their assigned customers' USING ERRCODE='42501'; END IF;
 IF TG_TABLE_NAME='orders' THEN
  IF NEW.customer_id IS DISTINCT FROM OLD.customer_id AND NOT public.staff_can_access_customer(NEW.customer_id) THEN RAISE EXCEPTION 'Customer access denied' USING ERRCODE='42501'; END IF;
  IF NEW.executive_override_id IS DISTINCT FROM OLD.executive_override_id AND coalesce(NEW.executive_override_id,(SELECT assigned_executive_id FROM public.customers WHERE id=NEW.customer_id))<>auth.uid() THEN RAISE EXCEPTION 'Executives cannot reassign orders to another executive' USING ERRCODE='42501'; END IF;
 END IF;
 RETURN NEW; END $$;
CREATE TRIGGER executive_customer_assignment BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.guard_executive_assignment();
CREATE TRIGGER executive_order_assignment BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.guard_executive_assignment();
REVOKE ALL ON FUNCTION public.guard_profile_hierarchy(),public.guard_executive_assignment() FROM PUBLIC,anon,authenticated;
