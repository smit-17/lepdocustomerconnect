CREATE OR REPLACE FUNCTION public.admin_seller_directory()
RETURNS TABLE(user_id uuid,status text,created_at timestamptz,full_name text,email text,phone text,is_active boolean,email_verified boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Administrators only' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT s.user_id,s.status,s.created_at,p.full_name,p.email,p.phone,p.is_active,u.email_confirmed_at IS NOT NULL FROM public.seller_requests s JOIN public.profiles p ON p.id=s.user_id JOIN public.user_roles r ON r.user_id=s.user_id AND r.role='seller' JOIN auth.users u ON u.id=s.user_id ORDER BY s.created_at DESC;
END $$;
REVOKE ALL ON FUNCTION public.admin_seller_directory() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_seller_directory() TO authenticated;
CREATE OR REPLACE FUNCTION public.admin_manage_seller(p_user_id uuid,p_full_name text,p_phone text,p_status text,p_active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Administrators only' USING ERRCODE='42501'; END IF;
 IF p_status IS NULL OR p_status NOT IN ('pending','approved','rejected') OR p_active IS NULL OR (p_active AND p_status<>'approved') THEN RAISE EXCEPTION 'Only approved sellers can be active'; END IF;
 IF p_full_name IS NULL OR length(btrim(p_full_name)) NOT BETWEEN 1 AND 120 OR length(coalesce(p_phone,''))>50 THEN RAISE EXCEPTION 'Invalid seller details'; END IF;
 PERFORM 1 FROM public.seller_requests s JOIN public.user_roles r ON r.user_id=s.user_id AND r.role='seller' WHERE s.user_id=p_user_id FOR UPDATE OF s;
 IF NOT FOUND THEN RAISE EXCEPTION 'Seller not found'; END IF;
 UPDATE public.seller_requests SET status=p_status,decided_at=CASE WHEN p_status='pending' THEN NULL ELSE now() END,decided_by=CASE WHEN p_status='pending' THEN NULL ELSE auth.uid() END WHERE user_id=p_user_id;
 UPDATE public.profiles SET full_name=btrim(p_full_name),phone=nullif(btrim(p_phone),''),is_active=p_active WHERE id=p_user_id;
END $$;
REVOKE ALL ON FUNCTION public.admin_manage_seller(uuid,text,text,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_manage_seller(uuid,text,text,text,boolean) TO authenticated;