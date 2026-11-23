ALTER TABLE public.order_tracking_links ADD COLUMN customer_id uuid REFERENCES public.customers(id), ADD COLUMN revoked_at timestamptz;
UPDATE public.order_tracking_links l SET customer_id=o.customer_id FROM public.orders o WHERE o.id=l.order_id;
CREATE OR REPLACE FUNCTION public.staff_share_order(p_order_id uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result text; cid uuid;
BEGIN
 IF NOT (public.is_staff() AND public.staff_can_access_order(p_order_id)) THEN RAISE EXCEPTION 'Not allowed'; END IF;
 SELECT customer_id INTO cid FROM public.orders WHERE id=p_order_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
 INSERT INTO public.order_tracking_links(order_id,customer_id,token) VALUES(p_order_id,cid,replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''))
 ON CONFLICT(order_id) DO UPDATE SET token=CASE WHEN order_tracking_links.revoked_at IS NOT NULL OR order_tracking_links.customer_id IS DISTINCT FROM EXCLUDED.customer_id THEN EXCLUDED.token ELSE order_tracking_links.token END, customer_id=EXCLUDED.customer_id,revoked_at=NULL;
 SELECT token INTO result FROM public.order_tracking_links WHERE order_id=p_order_id;
 RETURN result;
END $$;
CREATE FUNCTION public.staff_revoke_order_share(p_order_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT (public.is_staff() AND public.staff_can_access_order(p_order_id)) THEN RAISE EXCEPTION 'Not allowed'; END IF;
 UPDATE public.order_tracking_links SET revoked_at=now() WHERE order_id=p_order_id;
END $$;
REVOKE ALL ON FUNCTION public.staff_revoke_order_share(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.staff_revoke_order_share(uuid) TO authenticated;
CREATE FUNCTION public.public_shared_customer(p_token text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE cid uuid; result jsonb;
BEGIN
 IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN RETURN NULL; END IF;
 SELECT l.customer_id INTO cid FROM public.order_tracking_links l JOIN public.orders o ON o.id=l.order_id AND o.customer_id=l.customer_id WHERE l.token=p_token AND l.revoked_at IS NULL;
 IF cid IS NULL THEN RETURN NULL; END IF;
 SELECT jsonb_build_object('customer',jsonb_build_object('name',c.name,'country',c.country),'orders',COALESCE((SELECT jsonb_agg(jsonb_build_object(
 'id',o.id,'reference',o.reference,'order_type',o.order_type,'title',o.title,'status',o.status,'current_stage_key',o.current_stage_key,'current_stage_name',o.current_stage_name,'current_stage_status',o.current_stage_status,'progress_pct',o.progress_pct,'expected_delivery_date',o.expected_delivery_date,'created_at',o.created_at,'updated_at',o.updated_at,'completed_at',o.completed_at,
 'stages',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',s.id,'stage_key',s.stage_key,'name',s.name,'position',s.journey_position,'status',s.status,'completed_at',s.completed_at) ORDER BY s.journey_position) FROM public.order_stages s WHERE s.order_id=o.id AND s.journey_position>0 AND s.stage_key<>'feedback'),'[]'::jsonb)) ORDER BY o.updated_at DESC) FROM public.orders o WHERE o.customer_id=c.id AND o.status<>'cancelled'),'[]'::jsonb)) INTO result FROM public.customers c WHERE c.id=cid;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.public_shared_customer(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_shared_customer(text) TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.public_track_order(p_token text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN RETURN NULL; END IF;
 SELECT jsonb_build_object('reference',o.reference,'status',o.status,'current_stage_name',o.current_stage_name,'progress_pct',o.progress_pct,'stages',COALESCE((SELECT jsonb_agg(jsonb_build_object('stage_key',s.stage_key,'name',s.name,'status',s.status) ORDER BY s.journey_position) FROM public.order_stages s WHERE s.order_id=o.id AND s.journey_position>0 AND s.stage_key<>'feedback'),'[]'::jsonb)) INTO result FROM public.order_tracking_links l JOIN public.orders o ON o.id=l.order_id AND o.customer_id=l.customer_id WHERE l.token=p_token AND l.revoked_at IS NULL;
 RETURN result;
END $$;