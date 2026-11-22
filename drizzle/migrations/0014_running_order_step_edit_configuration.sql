ALTER TABLE public.app_settings ADD COLUMN edit_running_order_steps boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.assert_order_steps_editable(p_order_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_status text; v_override boolean;
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only administrators can edit steps' USING ERRCODE='42501'; END IF;
 SELECT status INTO v_status FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR v_status='cancelled' THEN RAISE EXCEPTION 'Order not found or cancelled'; END IF;
 SELECT edit_running_order_steps INTO v_override FROM public.app_settings WHERE id=1 FOR SHARE;
 IF NOT coalesce(v_override,false) AND (v_status='completed' OR EXISTS(SELECT 1 FROM public.order_stages WHERE order_id=p_order_id AND (status NOT IN ('upcoming','not_applicable') OR completed_at IS NOT NULL OR details<>'{}'::jsonb))) THEN
  RAISE EXCEPTION 'Enable Edit steps while order running in Settings Configuration before editing this order' USING ERRCODE='42501';
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.assert_order_steps_editable(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_order_steps_editable(uuid) TO authenticated,service_role;
DO $$
DECLARE f record; definition text; marker text := 'IF NOT FOUND OR v_status=''cancelled'' THEN RAISE EXCEPTION ''Order not found or cancelled''; END IF;'; target text;
BEGIN
 FOR f IN SELECT oid,proname FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('staff_add_stage','staff_reorder_stages','staff_rename_stage','staff_delete_stage') LOOP
  definition:=pg_get_functiondef(f.oid);
  IF position(marker IN definition)=0 THEN RAISE EXCEPTION 'Missing expected order validation in %',f.proname; END IF;
  target:=CASE WHEN f.proname IN ('staff_add_stage','staff_reorder_stages') THEN 'p_order_id' ELSE 's.order_id' END;
  EXECUTE replace(definition,marker,marker||E'\n PERFORM public.assert_order_steps_editable('||target||');');
 END LOOP;
END $$;