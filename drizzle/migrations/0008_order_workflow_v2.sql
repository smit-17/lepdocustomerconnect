CREATE TABLE public.order_approvals(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
 stage_key text NOT NULL,
 approval_type text NOT NULL DEFAULT 'custom' CHECK (approval_type IN ('cad','diamond_qc','jewellery_qc','custom')),
 version integer NOT NULL DEFAULT 1,
 document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
 file_path text NOT NULL,
 file_name text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','changes_requested','superseded')),
 customer_approval_required boolean NOT NULL DEFAULT true,
 rejection_reason text,
 rejection_notes text,
 internal_qc_status text NOT NULL DEFAULT 'pending' CHECK (internal_qc_status IN ('pending','passed','rework_required')),
 requested_by uuid REFERENCES public.profiles(id),
 decided_by uuid REFERENCES public.profiles(id),
 decided_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_approvals_order_stage_idx ON public.order_approvals(order_id, stage_key, version);
GRANT SELECT, UPDATE ON public.order_approvals TO authenticated;
GRANT ALL ON public.order_approvals TO service_role;
ALTER TABLE public.order_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY order_approvals_read ON public.order_approvals FOR SELECT TO authenticated USING (public.is_staff() AND public.staff_can_access_order(order_id));
CREATE POLICY order_approvals_update ON public.order_approvals FOR UPDATE TO authenticated USING (public.is_staff() AND public.staff_can_access_order(order_id)) WITH CHECK (public.is_staff() AND public.staff_can_access_order(order_id));

CREATE TABLE public.metal_supplies(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
 metal_type text NOT NULL DEFAULT 'Gold',
 metal_purity text,
 metal_weight numeric,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','preparing','done')),
 supplied_date date,
 notes text,
 updated_by uuid REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.metal_supplies TO authenticated;
GRANT ALL ON public.metal_supplies TO service_role;
ALTER TABLE public.metal_supplies ENABLE ROW LEVEL SECURITY;
CREATE POLICY metal_supplies_staff ON public.metal_supplies FOR ALL TO authenticated USING (public.is_staff() AND public.staff_can_access_order(order_id)) WITH CHECK (public.is_staff() AND public.staff_can_access_order(order_id));

CREATE TABLE public.photography_tasks(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed')),
 assigned_to text,
 photo_urls text[] NOT NULL DEFAULT '{}',
 completed_at timestamptz,
 notes text,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.photography_tasks TO authenticated;
GRANT ALL ON public.photography_tasks TO service_role;
ALTER TABLE public.photography_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY photography_tasks_staff ON public.photography_tasks FOR ALL TO authenticated USING (public.is_staff() AND public.staff_can_access_order(order_id)) WITH CHECK (public.is_staff() AND public.staff_can_access_order(order_id));

CREATE OR REPLACE FUNCTION public.staff_request_approval(p_order_id uuid,p_stage_key text,p_approval_type text,p_file_path text,p_file_name text,p_document_id uuid DEFAULT NULL,p_customer_required boolean DEFAULT true) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v integer; aid uuid; sname text;
BEGIN
 IF NOT (public.is_staff() AND public.staff_can_access_order(p_order_id)) THEN RAISE EXCEPTION 'Not allowed'; END IF;
 SELECT name INTO sname FROM public.order_stages WHERE order_id=p_order_id AND stage_key=p_stage_key;
 IF sname IS NULL THEN RAISE EXCEPTION 'Unknown step for this order'; END IF;
 UPDATE public.order_approvals SET status='superseded' WHERE order_id=p_order_id AND stage_key=p_stage_key AND status='pending';
 SELECT coalesce(max(version),0)+1 INTO v FROM public.order_approvals WHERE order_id=p_order_id AND stage_key=p_stage_key;
 INSERT INTO public.order_approvals(order_id,stage_key,approval_type,version,document_id,file_path,file_name,customer_approval_required,requested_by)
 VALUES(p_order_id,p_stage_key,p_approval_type,v,p_document_id,p_file_path,p_file_name,p_customer_required,auth.uid()) RETURNING id INTO aid;
 IF p_customer_required THEN
  UPDATE public.order_stages SET status='attention' WHERE order_id=p_order_id AND stage_key=p_stage_key AND status<>'completed';
 END IF;
 INSERT INTO public.order_updates(order_id,stage_name,note,customer_visible,document_id,created_by)
 VALUES(p_order_id,sname,CASE WHEN p_customer_required THEN 'Version '||v||' shared for your approval.' ELSE 'Version '||v||' uploaded.' END,true,p_document_id,auth.uid());
 RETURN aid;
END $$;

CREATE OR REPLACE FUNCTION public.portal_decide_approval(p_approval_id uuid,p_decision text,p_reason text DEFAULT NULL,p_notes text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.order_approvals%rowtype; sname text;
BEGIN
 SELECT * INTO a FROM public.order_approvals WHERE id=p_approval_id FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.orders WHERE id=a.order_id AND customer_id=public.my_customer_id() AND status='active') THEN RAISE EXCEPTION 'Approval not available'; END IF;
 IF a.status<>'pending' OR NOT a.customer_approval_required THEN RAISE EXCEPTION 'This version is no longer awaiting your decision'; END IF;
 IF p_decision NOT IN ('approved','changes_requested') THEN RAISE EXCEPTION 'Invalid decision'; END IF;
 IF p_decision='changes_requested' AND (coalesce(trim(p_reason),'')='' OR coalesce(trim(p_notes),'')='') THEN RAISE EXCEPTION 'Please give a reason and notes'; END IF;
 UPDATE public.order_approvals SET status=p_decision,rejection_reason=CASE WHEN p_decision='changes_requested' THEN left(p_reason,200) END,rejection_notes=CASE WHEN p_decision='changes_requested' THEN left(p_notes,2000) END,decided_by=auth.uid(),decided_at=now() WHERE id=a.id;
 SELECT name INTO sname FROM public.order_stages WHERE order_id=a.order_id AND stage_key=a.stage_key;
 IF p_decision='approved' THEN
  IF a.approval_type='cad' AND a.document_id IS NOT NULL THEN
   INSERT INTO public.cad_approvals(order_id,document_id,approved_by) VALUES(a.order_id,a.document_id,auth.uid()) ON CONFLICT DO NOTHING;
  END IF;
  UPDATE public.order_stages SET status='completed',details=details||jsonb_build_object('customer_approved',now()::text) WHERE order_id=a.order_id AND stage_key=a.stage_key;
 ELSE
  UPDATE public.order_stages SET status='attention',details=details||jsonb_build_object('rework_required',now()::text) WHERE order_id=a.order_id AND stage_key=a.stage_key;
 END IF;
 INSERT INTO public.order_updates(order_id,stage_name,note,customer_visible,document_id,created_by)
 VALUES(a.order_id,sname,CASE WHEN p_decision='approved' THEN 'Customer approved version '||a.version||'.' ELSE 'Customer requested changes on version '||a.version||': '||p_reason||' — '||p_notes END,true,a.document_id,auth.uid());
END $$;

CREATE OR REPLACE FUNCTION public.enforce_workflow_v2() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status IS DISTINCT FROM OLD.status THEN
  IF NEW.status='completed' AND EXISTS(SELECT 1 FROM public.order_approvals WHERE order_id=NEW.order_id AND stage_key=NEW.stage_key AND status='pending' AND customer_approval_required) THEN
   RAISE EXCEPTION 'Customer approval is still pending for this step';
  END IF;
  IF NEW.stage_key='shipped' AND NEW.status IN ('in_progress','completed') AND EXISTS(SELECT 1 FROM public.order_stages WHERE order_id=NEW.order_id AND stage_key='final_invoice' AND status NOT IN ('completed','not_applicable')) THEN
   RAISE EXCEPTION 'Issue the final invoice before handing over to shipping';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER order_workflow_v2_gate BEFORE UPDATE ON public.order_stages FOR EACH ROW EXECUTE FUNCTION public.enforce_workflow_v2();

CREATE OR REPLACE FUNCTION public.create_default_stages(p_order_id uuid,p_type text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF p_type='diamond' THEN
 INSERT INTO public.order_stages(order_id,stage_key,name,position,journey_position,is_payment_stage) VALUES
 (p_order_id,'proforma','Proforma Invoice',1,1,true),(p_order_id,'bank_details','Bank Details Shared',2,2,false),(p_order_id,'payment_in_progress','Payment Initiated / Proof Submitted',3,3,true),(p_order_id,'payment_confirmed','Payment Received / Finance Verification',4,4,true),(p_order_id,'diamond_preparation','Start Preparing Order',5,5,false),(p_order_id,'quality_check','Diamond Quality Check',6,6,false),(p_order_id,'ready_to_ship','Goods Ready to Parcel',7,7,false),(p_order_id,'final_invoice','Final Invoice Issued',8,8,false),(p_order_id,'shipped','Handed Over to Shipping Company',9,9,false),(p_order_id,'tracking','Shipment Tracking',10,10,false),(p_order_id,'delivered','Delivered',11,11,false),(p_order_id,'feedback','Customer Feedback',12,12,false);
 ELSE
 INSERT INTO public.order_stages(order_id,stage_key,name,position,journey_position,is_payment_stage) VALUES
 (p_order_id,'proforma','Proforma Invoice',1,1,true),(p_order_id,'bank_details','Bank Details Shared',2,2,false),(p_order_id,'payment_in_progress','Payment Initiated / Proof Submitted',3,3,true),(p_order_id,'payment_confirmed','Payment Received / Finance Verification',4,4,true),(p_order_id,'diamond_preparation','Start Preparing',5,5,false),(p_order_id,'cad_approval','CAD Creation & Approval',6,6,false),(p_order_id,'manufacturing','Manufacturing & Metal Supply',7,7,false),(p_order_id,'quality_check','Jewellery QC & Photography',8,8,false),(p_order_id,'ready_to_ship','Goods Ready to Parcel',9,9,false),(p_order_id,'final_invoice','Final Invoice Issued',10,10,false),(p_order_id,'shipped','Handed Over to Shipping Company',11,11,false),(p_order_id,'tracking','Shipment Tracking',12,12,false),(p_order_id,'delivered','Delivered',13,13,false),(p_order_id,'feedback','Customer Feedback',14,14,false);
 END IF;
END $$;

UPDATE public.order_stages s SET journey_position=s.journey_position+1 FROM public.orders o WHERE o.id=s.order_id AND o.order_type='diamond' AND s.journey_position>=8 AND NOT EXISTS(SELECT 1 FROM public.order_stages f WHERE f.order_id=o.id AND f.stage_key='final_invoice');
INSERT INTO public.order_stages(order_id,stage_key,name,position,journey_position,status,completed_at)
SELECT o.id,'final_invoice','Final Invoice Issued',13,8,CASE WHEN o.status='completed' OR EXISTS(SELECT 1 FROM public.order_stages s WHERE s.order_id=o.id AND s.stage_key='shipped' AND s.status IN ('in_progress','completed')) THEN 'completed' ELSE 'upcoming' END,CASE WHEN o.status='completed' THEN o.updated_at END
FROM public.orders o WHERE o.order_type='diamond' ON CONFLICT(order_id,stage_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.portal_order_extra(p_order_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.orders%rowtype;
BEGIN
 SELECT * INTO o FROM public.orders WHERE id=p_order_id AND customer_id=public.my_customer_id() AND status<>'cancelled'; IF NOT FOUND THEN RAISE EXCEPTION 'Order not available'; END IF;
 RETURN jsonb_build_object('payment_terms',o.payment_terms,'customer_action_required',o.customer_action_required,'current_responsible_dept',o.current_responsible_dept,
  'stage_positions',(SELECT jsonb_object_agg(id,journey_position) FROM public.order_stages WHERE order_id=o.id),
  'stage_documents',coalesce((SELECT jsonb_agg(jsonb_build_object('stage_id',u.stage_id,'document_id',u.document_id,'created_at',u.created_at)) FROM public.order_updates u JOIN public.documents d ON d.id=u.document_id WHERE u.order_id=o.id AND u.customer_visible AND d.customer_visible),'[]'::jsonb),
  'cad_approvals',coalesce((SELECT jsonb_agg(jsonb_build_object('document_id',document_id,'approved_at',approved_at)) FROM public.cad_approvals WHERE order_id=o.id),'[]'::jsonb),
  'approvals',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'stage_key',a.stage_key,'approval_type',a.approval_type,'version',a.version,'file_path',a.file_path,'file_name',a.file_name,'status',a.status,'customer_approval_required',a.customer_approval_required,'rejection_reason',a.rejection_reason,'rejection_notes',a.rejection_notes,'decided_at',a.decided_at,'created_at',a.created_at) ORDER BY a.version DESC) FROM public.order_approvals a JOIN public.documents d ON d.id=a.document_id AND d.customer_visible WHERE a.order_id=o.id),'[]'::jsonb),
  'metal_supplies',coalesce((SELECT jsonb_agg(jsonb_build_object('metal_type',m.metal_type,'metal_purity',m.metal_purity,'metal_weight',m.metal_weight,'status',m.status,'supplied_date',m.supplied_date) ORDER BY m.created_at) FROM public.metal_supplies m WHERE m.order_id=o.id),'[]'::jsonb),
  'photography',(SELECT jsonb_build_object('status',p.status,'completed_at',p.completed_at) FROM public.photography_tasks p WHERE p.order_id=o.id));
END $$;

REVOKE ALL ON FUNCTION public.staff_request_approval(uuid,text,text,text,text,uuid,boolean),public.portal_decide_approval(uuid,text,text,text),public.enforce_workflow_v2() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.staff_request_approval(uuid,text,text,text,text,uuid,boolean),public.portal_decide_approval(uuid,text,text,text) TO authenticated,service_role;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT id FROM public.orders LOOP PERFORM public.recompute_order_progress(r.id); END LOOP; END $$;