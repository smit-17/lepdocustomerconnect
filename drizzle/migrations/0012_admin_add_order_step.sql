CREATE OR REPLACE FUNCTION public.staff_add_stage(p_order_id uuid, p_name text, p_after_stage_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_status text; v_name text := btrim(p_name); v_after integer := 0; v_position integer; v_id uuid := gen_random_uuid();
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only administrators can edit steps' USING ERRCODE='42501'; END IF;
 SELECT status INTO v_status FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR v_status='cancelled' THEN RAISE EXCEPTION 'Order not found or cancelled'; END IF;
 IF v_name IS NULL OR length(v_name)<1 OR length(v_name)>120 THEN RAISE EXCEPTION 'Step name must contain 1 to 120 characters'; END IF;
 IF p_after_stage_id IS NOT NULL THEN
  SELECT journey_position INTO v_after FROM public.order_stages WHERE id=p_after_stage_id AND order_id=p_order_id AND journey_position>0;
  IF NOT FOUND THEN RAISE EXCEPTION 'Insertion step not found in this order'; END IF;
 END IF;
 SELECT coalesce(max(position),0)+1 INTO v_position FROM public.order_stages WHERE order_id=p_order_id;
 UPDATE public.order_stages SET journey_position=journey_position+1 WHERE order_id=p_order_id AND journey_position>v_after;
 INSERT INTO public.order_stages(id,order_id,stage_key,name,position,journey_position,is_payment_stage,status,updated_by)
 VALUES(v_id,p_order_id,'custom_'||replace(v_id::text,'-',''),v_name,v_position,v_after+1,false,'upcoming',auth.uid());
 PERFORM public.recompute_order_progress(p_order_id);
 INSERT INTO public.order_updates(order_id,stage_id,stage_name,note,customer_visible) VALUES(p_order_id,v_id,v_name,'Step added to tracking.',false);
 RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.staff_add_stage(uuid,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_add_stage(uuid,text,uuid) TO authenticated, service_role;