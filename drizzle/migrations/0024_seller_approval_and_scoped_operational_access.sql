CREATE TABLE public.user_roles (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 role text NOT NULL CHECK (role IN ('admin','team','customer','seller'))
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
INSERT INTO public.user_roles(user_id,role) SELECT id,role FROM public.profiles;
CREATE POLICY roles_read ON public.user_roles FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.is_admin());

CREATE TABLE public.seller_requests (
 user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 created_at timestamptz NOT NULL DEFAULT now(),
 decided_at timestamptz,
 decided_by uuid REFERENCES public.profiles(id)
);
GRANT SELECT ON public.seller_requests TO authenticated;
GRANT ALL ON public.seller_requests TO service_role;
ALTER TABLE public.seller_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY seller_requests_read ON public.seller_requests FOR SELECT TO authenticated USING(user_id=auth.uid() OR public.is_admin());

COMMENT ON COLUMN public.profiles.role IS 'DEPRECATED as authorization source: legacy UI projection synchronized to public.user_roles. Sellers retain team projection; authoritative role is user_roles.';
CREATE OR REPLACE FUNCTION public.auth_role() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT r.role FROM public.user_roles r JOIN public.profiles p ON p.id=r.user_id
 WHERE r.user_id=auth.uid() AND p.is_active
 AND (r.role<>'seller' OR EXISTS(SELECT 1 FROM public.seller_requests s WHERE s.user_id=r.user_id AND s.status='approved'))
$$;
CREATE OR REPLACE FUNCTION public.is_operator() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT coalesce(public.auth_role() IN ('admin','seller'),false) $$;
CREATE OR REPLACE FUNCTION public.is_staff() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT coalesce(public.auth_role() IN ('admin','team','seller'),false) $$;
REVOKE ALL ON FUNCTION public.is_operator() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.is_operator() TO authenticated,service_role;

CREATE FUNCTION public.sync_profile_role() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  INSERT INTO public.user_roles(user_id,role) VALUES(NEW.id,NEW.role) ON CONFLICT(user_id) DO NOTHING;
 ELSIF NEW.role IS DISTINCT FROM OLD.role THEN
  IF EXISTS(SELECT 1 FROM public.seller_requests WHERE user_id=NEW.id) THEN RAISE EXCEPTION 'Seller roles are managed through seller approval'; END IF;
  UPDATE public.user_roles SET role=NEW.role WHERE user_id=NEW.id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER profile_role_sync AFTER INSERT OR UPDATE OF role ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.sync_profile_role();

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_role text:='customer'; v_cust uuid; v_exec uuid; v_name text;
BEGIN
 v_name:=left(coalesce(NEW.raw_user_meta_data->>'full_name',''),120);
 IF coalesce(NEW.raw_user_meta_data->>'seller_signup','')='true' THEN
  IF length(btrim(v_name))=0 THEN RAISE EXCEPTION 'Full name is required'; END IF;
  INSERT INTO public.profiles(id,email,full_name,role,is_active,phone) VALUES(NEW.id,NEW.email,v_name,'team',false,left(nullif(btrim(NEW.raw_user_meta_data->>'phone'),''),50));
  UPDATE public.user_roles SET role='seller' WHERE user_id=NEW.id;
  INSERT INTO public.seller_requests(user_id) VALUES(NEW.id);
  RETURN NEW;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE role='admin') THEN v_role:='admin'; END IF;
 IF v_role='customer' AND coalesce(NEW.raw_user_meta_data->>'self_signup','')='true' THEN
  SELECT p.id INTO v_exec FROM public.profiles p JOIN public.user_roles r ON r.user_id=p.id WHERE r.role='admin' AND p.is_active ORDER BY p.created_at LIMIT 1;
  INSERT INTO public.customers(name,contact_person,email,country,assigned_executive_id,created_by)
  VALUES(coalesce(nullif(trim(NEW.raw_user_meta_data->>'company_name'),''),nullif(v_name,''),NEW.email),nullif(v_name,''),NEW.email,'',v_exec,NEW.id) RETURNING id INTO v_cust;
 END IF;
 INSERT INTO public.profiles(id,email,full_name,role,customer_id) VALUES(NEW.id,NEW.email,v_name,v_role,v_cust) ON CONFLICT(id) DO NOTHING;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.tg_protect_profile() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 NEW.updated_at:=now();
 SELECT u.email INTO NEW.email FROM auth.users u WHERE u.id=OLD.id;
 NEW.email:=coalesce(NEW.email,OLD.email);
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 IF NOT public.is_admin() AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='seller') THEN RAISE EXCEPTION 'Sellers cannot modify account settings' USING ERRCODE='42501'; END IF;
 IF NEW.role IS DISTINCT FROM OLD.role OR NEW.is_active IS DISTINCT FROM OLD.is_active OR NEW.customer_id IS DISTINCT FROM OLD.customer_id THEN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only an administrator can change roles or account status.' USING ERRCODE='42501'; END IF;
  IF NEW.id=auth.uid() THEN RAISE EXCEPTION 'You cannot change your own role or deactivate your own account.' USING ERRCODE='42501'; END IF;
  IF EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=NEW.id AND role='seller') AND (NEW.role IS DISTINCT FROM OLD.role OR (NEW.is_active AND NOT EXISTS(SELECT 1 FROM public.seller_requests WHERE user_id=NEW.id AND status='approved'))) THEN RAISE EXCEPTION 'Review the seller request before activating the seller' USING ERRCODE='42501'; END IF;
  IF NEW.role<>'customer' THEN NEW.customer_id:=NULL; END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION public.admin_review_seller(p_user_id uuid,p_status text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_status text;
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only administrators can review seller requests' USING ERRCODE='42501'; END IF;
 IF p_status IS NULL OR p_status NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'Invalid seller decision'; END IF;
 SELECT status INTO v_status FROM public.seller_requests WHERE user_id=p_user_id FOR UPDATE;
 IF NOT FOUND OR v_status<>'pending' THEN RAISE EXCEPTION 'This request is not pending'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_user_id AND role='seller') THEN RAISE EXCEPTION 'Seller account not found'; END IF;
 UPDATE public.seller_requests SET status=p_status,decided_at=now(),decided_by=auth.uid() WHERE user_id=p_user_id;
 UPDATE public.profiles SET is_active=(p_status='approved') WHERE id=p_user_id;
END $$;
REVOKE ALL ON FUNCTION public.admin_review_seller(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_review_seller(uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.sync_profile_role() FROM PUBLIC,anon,authenticated;

-- Only enumerated operational functions/policies gain seller access. Identity functions remain administrator-only.
DO $$ DECLARE f record; p record; definition text; condition text; verification text;
BEGIN
 FOR f IN SELECT oid FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('staff_can_access_customer','staff_can_access_order','enforce_admin_receipt','review_kyc','assert_order_steps_editable','staff_add_stage','staff_delete_stage','staff_rename_stage','staff_reorder_stages','admin_get_workflow','admin_save_order_workflow','admin_save_workflow','tg_stage_before') LOOP
  definition:=replace(pg_get_functiondef(f.oid),'public.is_admin()','public.is_operator()');
  EXECUTE definition;
 END LOOP;
 FOR p IN SELECT * FROM pg_policies WHERE schemaname='public' AND tablename IN ('customers','orders','payments','documents','shipments') AND (coalesce(qual,'') LIKE '%is_admin()%' OR coalesce(with_check,'') LIKE '%is_admin()%') LOOP
  condition:=replace(p.qual,'is_admin()','is_operator()'); verification:=replace(p.with_check,'is_admin()','is_operator()');
  EXECUTE format('ALTER POLICY %I ON public.%I%s%s',p.policyname,p.tablename,CASE WHEN condition IS NOT NULL THEN ' USING ('||condition||')' ELSE '' END,CASE WHEN verification IS NOT NULL THEN ' WITH CHECK ('||verification||')' ELSE '' END);
 END LOOP;
 -- Preserve reset-history restriction; allow sellers to delete only individual orders.
 SELECT pg_get_functiondef(oid) INTO definition FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='admin_delete_order_history';
 definition:=replace(definition,'IF NOT public.is_admin() THEN','IF NOT public.is_operator() OR (p_order_id IS NULL AND NOT public.is_admin()) THEN');
 EXECUTE definition;
END $$;
ALTER POLICY app_settings_admin_update ON public.app_settings USING(public.is_operator()) WITH CHECK(public.is_operator());
CREATE FUNCTION public.protect_staff_access_settings() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND NOT public.is_admin() AND NEW.team_sees_all IS DISTINCT FROM OLD.team_sees_all THEN RAISE EXCEPTION 'Only administrators can change staff access permissions' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_staff_access BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.protect_staff_access_settings();
REVOKE ALL ON FUNCTION public.protect_staff_access_settings() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.admin_user_directory() RETURNS TABLE(id uuid,email text,full_name text,role text,is_active boolean,customer_id uuid,customer_name text,job_title text,phone text,whatsapp text,photo_url text,created_at timestamptz,last_sign_in_at timestamptz) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Administrators only.' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT p.id,p.email,p.full_name,r.role,p.is_active,p.customer_id,c.name,p.job_title,p.phone,p.whatsapp,p.photo_url,p.created_at,u.last_sign_in_at FROM public.profiles p JOIN public.user_roles r ON r.user_id=p.id JOIN auth.users u ON u.id=p.id LEFT JOIN public.customers c ON c.id=p.customer_id ORDER BY r.role,p.full_name;
END $$;