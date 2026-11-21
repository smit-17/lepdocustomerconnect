CREATE OR REPLACE FUNCTION public.tg_stage_before() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 new.order_id := old.order_id;
 new.stage_key := old.stage_key;
 new.position := old.position;
 new.is_payment_stage := old.is_payment_stage;
 IF new.name IS DISTINCT FROM old.name THEN
  IF NOT public.is_admin() THEN new.name := old.name;
  ELSE
   new.name := trim(new.name);
   IF new.name IS NULL OR length(new.name)=0 OR length(new.name)>120 THEN RAISE EXCEPTION 'Step name must contain 1 to 120 characters'; END IF;
  END IF;
 END IF;
 IF new.status='completed' AND old.status<>'completed' THEN new.completed_at:=coalesce(new.completed_at,now());
 ELSIF new.status<>'completed' THEN new.completed_at:=null; END IF;
 new.updated_at:=now();
 IF auth.uid() IS NOT NULL THEN new.updated_by:=auth.uid(); END IF;
 RETURN new;
END $$;

CREATE OR REPLACE FUNCTION public.staff_reorder_stages(p_order_id uuid,p_stage_ids uuid[]) RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_status text; v_existing uuid[]; v_requested uuid[];
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only administrators can edit steps' USING ERRCODE='42501'; END IF;
 SELECT status INTO v_status FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR v_status='cancelled' THEN RAISE EXCEPTION 'Order not found or cancelled'; END IF;
 SELECT array_agg(id ORDER BY id) INTO v_existing FROM public.order_stages WHERE order_id=p_order_id AND journey_position>0;
 SELECT array_agg(id ORDER BY id) INTO v_requested FROM unnest(p_stage_ids) AS ids(id);
 IF v_requested IS NULL OR v_requested IS DISTINCT FROM v_existing THEN RAISE EXCEPTION 'Provide every visible step exactly once'; END IF;
 UPDATE public.order_stages s SET journey_position=r.pos::integer FROM unnest(p_stage_ids) WITH ORDINALITY AS r(id,pos) WHERE s.id=r.id AND s.order_id=p_order_id;
 PERFORM public.recompute_order_progress(p_order_id);
 INSERT INTO public.order_updates(order_id,note,customer_visible) VALUES(p_order_id,'Order steps reordered.',false);
END $$;

CREATE OR REPLACE FUNCTION public.staff_rename_stage(p_stage_id uuid,p_name text) RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
DECLARE s public.order_stages%rowtype; v_status text; v_name text:=trim(p_name);
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only administrators can edit steps' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM public.order_stages WHERE id=p_stage_id AND journey_position>0;
 IF NOT FOUND THEN RAISE EXCEPTION 'Step not found'; END IF;
 SELECT status INTO v_status FROM public.orders WHERE id=s.order_id FOR UPDATE;
 IF NOT FOUND OR v_status='cancelled' THEN RAISE EXCEPTION 'Order not found or cancelled'; END IF;
 IF v_name IS NULL OR length(v_name)=0 OR length(v_name)>120 THEN RAISE EXCEPTION 'Step name must contain 1 to 120 characters'; END IF;
 UPDATE public.order_stages SET name=v_name WHERE id=s.id AND journey_position>0;
 PERFORM public.recompute_order_progress(s.order_id);
 INSERT INTO public.order_updates(order_id,stage_id,stage_name,note,customer_visible) VALUES(s.order_id,s.id,v_name,'Step renamed from '||s.name||' to '||v_name||'.',false);
END $$;

CREATE OR REPLACE FUNCTION public.staff_delete_stage(p_stage_id uuid) RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
DECLARE s public.order_stages%rowtype; v_status text;
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only administrators can edit steps' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM public.order_stages WHERE id=p_stage_id AND journey_position>0;
 IF NOT FOUND THEN RAISE EXCEPTION 'Step not found'; END IF;
 SELECT status INTO v_status FROM public.orders WHERE id=s.order_id FOR UPDATE;
 IF NOT FOUND OR v_status='cancelled' THEN RAISE EXCEPTION 'Order not found or cancelled'; END IF;
 IF s.stage_key='final_invoice' THEN RAISE EXCEPTION 'The final invoice step is required before shipping and cannot be removed'; END IF;
 IF (SELECT count(*) FROM public.order_stages WHERE order_id=s.order_id AND journey_position>0)<=1 THEN RAISE EXCEPTION 'An order must retain at least one step'; END IF;
 UPDATE public.order_stages SET journey_position=0 WHERE id=s.id;
 PERFORM public.recompute_order_progress(s.order_id);
 INSERT INTO public.order_updates(order_id,stage_id,stage_name,note,customer_visible) VALUES(s.order_id,s.id,s.name,'Step removed from tracking; history retained.',false);
END $$;

REVOKE ALL ON FUNCTION public.staff_reorder_stages(uuid,uuid[]),public.staff_rename_stage(uuid,text),public.staff_delete_stage(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.staff_reorder_stages(uuid,uuid[]),public.staff_rename_stage(uuid,text),public.staff_delete_stage(uuid) TO authenticated,service_role;