CREATE TABLE public.order_tracking_links (
 order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
 token text NOT NULL UNIQUE CHECK (token ~ '^[0-9a-f]{64}$')
);
GRANT ALL ON public.order_tracking_links TO service_role;
REVOKE ALL ON public.order_tracking_links FROM anon, authenticated;
ALTER TABLE public.order_tracking_links ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.staff_share_order(p_order_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result text;
BEGIN
 IF NOT (public.is_staff() AND public.staff_can_access_order(p_order_id)) THEN RAISE EXCEPTION 'Not allowed'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id=p_order_id) THEN RAISE EXCEPTION 'Order not found'; END IF;
 INSERT INTO public.order_tracking_links(order_id,token) VALUES(p_order_id,replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','')) ON CONFLICT(order_id) DO NOTHING;
 SELECT token INTO result FROM public.order_tracking_links WHERE order_id=p_order_id;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.staff_share_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_share_order(uuid) TO authenticated;
CREATE FUNCTION public.public_track_order(p_token text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
 IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN RETURN NULL; END IF;
 SELECT jsonb_build_object(
 'reference',o.reference,'status',o.status,'current_stage_name',o.current_stage_name,'progress_pct',o.progress_pct,
 'stages',COALESCE((SELECT jsonb_agg(jsonb_build_object('stage_key',s.stage_key,'name',s.name,'status',s.status) ORDER BY s.journey_position) FROM public.order_stages s WHERE s.order_id=o.id AND s.journey_position>0 AND s.stage_key<>'feedback'),'[]'::jsonb)
 ) INTO result FROM public.order_tracking_links l JOIN public.orders o ON o.id=l.order_id WHERE l.token=p_token;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.public_track_order(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_track_order(text) TO anon, authenticated;