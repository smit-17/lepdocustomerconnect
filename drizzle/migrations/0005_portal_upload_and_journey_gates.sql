CREATE OR REPLACE FUNCTION public.customer_owns_active_order(oid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.orders WHERE id=oid AND customer_id=public.my_customer_id() AND status='active') $$;
REVOKE ALL ON FUNCTION public.customer_owns_active_order(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.customer_owns_active_order(uuid) TO authenticated,service_role;
ALTER POLICY customer_proof_upload ON storage.objects WITH CHECK(bucket_id='order-documents' AND owner_id=auth.uid()::text AND split_part(name,'/',2)='customer-proof' AND public.customer_owns_active_order(public.try_uuid(split_part(name,'/',1))));
CREATE OR REPLACE FUNCTION public.record_stage_update(p_stage_id uuid,p_status text,p_note text DEFAULT NULL,p_customer_visible boolean DEFAULT true,p_details jsonb DEFAULT NULL,p_document_id uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE s public.order_stages%rowtype; nid uuid; v_note text:=nullif(trim(coalesce(p_note,'')),'');
BEGIN
 IF NOT public.is_staff() THEN RAISE EXCEPTION 'Only LEPDO team members can update progress'; END IF;
 SELECT * INTO s FROM public.order_stages WHERE id=p_stage_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Stage not found'; END IF;
 IF p_status NOT IN ('upcoming','in_progress','completed','attention','blocked','not_applicable') THEN RAISE EXCEPTION 'Invalid stage status'; END IF;
 IF p_document_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.documents WHERE id=p_document_id AND order_id=s.order_id) THEN RAISE EXCEPTION 'Document does not belong to this order'; END IF;
 IF p_status IN ('in_progress','completed') THEN
 UPDATE public.order_stages SET status='completed' WHERE order_id=s.order_id AND journey_position<s.journey_position AND journey_position>0 AND stage_key NOT IN ('feedback','cad_approval') AND status IN ('upcoming','in_progress') AND NOT is_payment_stage;
 END IF;
 UPDATE public.order_stages SET status=p_status,details=coalesce(p_details,details),customer_note=CASE WHEN p_customer_visible AND v_note IS NOT NULL THEN v_note ELSE customer_note END WHERE id=s.id;
 INSERT INTO public.order_updates(order_id,stage_id,stage_name,status,note,customer_visible,document_id) VALUES(s.order_id,s.id,s.name,p_status,v_note,coalesce(p_customer_visible,true),p_document_id) RETURNING id INTO nid; RETURN nid;
END $$;
CREATE OR REPLACE FUNCTION public.staff_pending_payment_orders() RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT DISTINCT p.order_id FROM public.payments p WHERE p.status='initiated' AND public.staff_can_access_order(p.order_id) $$;
REVOKE ALL ON FUNCTION public.staff_pending_payment_orders() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.staff_pending_payment_orders() TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.enforce_order_approval() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE latest_cad uuid;
BEGIN
 IF NEW.status IN ('in_progress','completed','not_applicable') AND NEW.status IS DISTINCT FROM OLD.status THEN
  IF NEW.stage_key IN ('payment_confirmed','advance_payment','final_payment') AND (EXISTS(SELECT 1 FROM public.payments WHERE order_id=NEW.order_id AND status='initiated') OR NOT EXISTS(SELECT 1 FROM public.payments WHERE order_id=NEW.order_id AND status='confirmed')) THEN RAISE EXCEPTION 'An administrator must verify payment receipt first'; END IF;
  IF NEW.stage_key IN ('diamond_preparation','manufacturing','quality_check','ready_to_ship','shipped','tracking','delivered') AND EXISTS(SELECT 1 FROM public.payments WHERE order_id=NEW.order_id AND status='initiated') THEN RAISE EXCEPTION 'Payment verification is pending'; END IF;
  IF NEW.stage_key IN ('cad_approval','manufacturing') THEN
   SELECT id INTO latest_cad FROM public.documents WHERE order_id=NEW.order_id AND doc_type='cad_design' AND customer_visible ORDER BY created_at DESC,id DESC LIMIT 1;
   IF latest_cad IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.cad_approvals WHERE order_id=NEW.order_id AND document_id=latest_cad) AND (NEW.stage_key='manufacturing' OR NEW.status IN ('completed','not_applicable')) THEN RAISE EXCEPTION 'Customer approval of the latest CAD design is required'; END IF;
  END IF;
 END IF; RETURN NEW;
END $$;