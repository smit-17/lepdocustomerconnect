CREATE TABLE public.kyc_records (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid NOT NULL REFERENCES public.customers(id), status text NOT NULL DEFAULT 'Not Submitted' CHECK (status IN ('Not Submitted','Under Review','Approved','Rejected','Re-KYC')), document_url text, submitted_at timestamptz, reviewed_by uuid, rejection_reason text, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.kyc_records TO authenticated;
GRANT ALL ON public.kyc_records TO service_role;
ALTER TABLE public.kyc_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY kyc_read ON public.kyc_records FOR SELECT TO authenticated USING (customer_id=public.my_customer_id() OR public.staff_can_access_customer(customer_id));
CREATE TABLE public.terms_versions (version text PRIMARY KEY, effective_date date NOT NULL, body text NOT NULL CHECK(length(body)>0), published boolean NOT NULL DEFAULT false);
GRANT SELECT ON public.terms_versions TO authenticated;
GRANT ALL ON public.terms_versions TO service_role;
ALTER TABLE public.terms_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY terms_read ON public.terms_versions FOR SELECT TO authenticated USING (published);
CREATE TABLE public.terms_acceptance (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid NOT NULL REFERENCES public.customers(id), version text NOT NULL REFERENCES public.terms_versions(version), accepted_by uuid NOT NULL, accepted_at timestamptz NOT NULL DEFAULT now(), UNIQUE(customer_id,version,accepted_by));
GRANT SELECT ON public.terms_acceptance TO authenticated;
GRANT ALL ON public.terms_acceptance TO service_role;
ALTER TABLE public.terms_acceptance ENABLE ROW LEVEL SECURITY;
CREATE POLICY acceptance_read ON public.terms_acceptance FOR SELECT TO authenticated USING(customer_id=public.my_customer_id() OR public.staff_can_access_customer(customer_id));
CREATE TABLE public.cad_approvals (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES public.orders(id), document_id uuid NOT NULL REFERENCES public.documents(id), approved_by uuid NOT NULL, approved_at timestamptz NOT NULL DEFAULT now(), UNIQUE(order_id,document_id));
GRANT SELECT ON public.cad_approvals TO authenticated;
GRANT ALL ON public.cad_approvals TO service_role;
ALTER TABLE public.cad_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY cad_read ON public.cad_approvals FOR SELECT TO authenticated USING(public.staff_can_access_order(order_id) OR EXISTS(SELECT 1 FROM public.orders o WHERE o.id=order_id AND o.customer_id=public.my_customer_id() AND o.status<>'cancelled'));
ALTER TABLE public.orders ADD COLUMN payment_terms text, ADD COLUMN customer_action_required text, ADD COLUMN current_responsible_dept text;
COMMENT ON COLUMN public.orders.balance_due IS 'Canonical remaining balance; confirmed receipts only. Do not duplicate as remaining_balance.';
GRANT INSERT(payment_terms,customer_action_required,current_responsible_dept), UPDATE(payment_terms,customer_action_required,current_responsible_dept) ON public.orders TO authenticated;
ALTER TABLE public.order_stages ADD COLUMN journey_position integer NOT NULL DEFAULT 0;
UPDATE public.order_stages SET journey_position=position;
CREATE POLICY kyc_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='customer-kyc' AND split_part(name,'/',1)=public.my_customer_id()::text AND owner_id=auth.uid()::text);
CREATE POLICY kyc_files_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='customer-kyc' AND (split_part(name,'/',1)=public.my_customer_id()::text OR public.staff_can_access_customer(public.try_uuid(split_part(name,'/',1)))));
CREATE POLICY customer_proof_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='order-documents' AND owner_id=auth.uid()::text AND split_part(name,'/',2)='customer-proof' AND EXISTS(SELECT 1 FROM public.orders o WHERE o.id=public.try_uuid(split_part(name,'/',1)) AND o.customer_id=public.my_customer_id() AND o.status='active'));
CREATE OR REPLACE FUNCTION public.portal_submit_kyc(p_path text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cid uuid:=public.my_customer_id(); rid uuid;
BEGIN
 IF cid IS NULL OR split_part(p_path,'/',1)<>cid::text OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='customer-kyc' AND name=p_path AND owner_id=auth.uid()::text) THEN RAISE EXCEPTION 'Invalid KYC document'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(cid::text));
 IF EXISTS(SELECT 1 FROM public.kyc_records WHERE customer_id=cid AND status IN ('Approved','Under Review') AND id=(SELECT id FROM public.kyc_records WHERE customer_id=cid ORDER BY created_at DESC LIMIT 1)) THEN RAISE EXCEPTION 'KYC is already approved or under review'; END IF;
 INSERT INTO public.kyc_records(customer_id,status,document_url,submitted_at) VALUES(cid,'Under Review',p_path,now()) RETURNING id INTO rid; RETURN rid;
END $$;
CREATE OR REPLACE FUNCTION public.review_kyc(p_id uuid,p_status text,p_reason text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Administrators only'; END IF;
 IF p_status NOT IN ('Approved','Rejected','Re-KYC') OR (p_status IN ('Rejected','Re-KYC') AND length(trim(coalesce(p_reason,'')))=0) THEN RAISE EXCEPTION 'Select a valid review result and provide a reason'; END IF;
 UPDATE public.kyc_records SET status=p_status,reviewed_by=auth.uid(),rejection_reason=left(p_reason,1000) WHERE id=p_id;
END $$;
CREATE OR REPLACE FUNCTION public.portal_accept_terms(p_version text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cid uuid:=public.my_customer_id();
BEGIN
 IF cid IS NULL OR NOT EXISTS(SELECT 1 FROM public.terms_versions WHERE version=p_version AND published AND effective_date<=CURRENT_DATE) THEN RAISE EXCEPTION 'Terms are not available'; END IF;
 INSERT INTO public.terms_acceptance(customer_id,version,accepted_by) VALUES(cid,p_version,auth.uid()) ON CONFLICT DO NOTHING;
END $$;
CREATE OR REPLACE FUNCTION public.portal_submit_payment(p_order_id uuid,p_path text,p_name text,p_amount numeric,p_reference text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.orders%rowtype; did uuid; pid uuid;
BEGIN
 SELECT * INTO o FROM public.orders WHERE id=p_order_id AND customer_id=public.my_customer_id() AND status='active' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order not available'; END IF;
 IF p_amount IS NULL OR p_amount<=0 OR p_amount>999999999999 OR length(coalesce(p_name,'')) NOT BETWEEN 1 AND 200 OR length(coalesce(p_reference,''))>120 THEN RAISE EXCEPTION 'Invalid payment amount or reference'; END IF;
 IF split_part(p_path,'/',1)<>o.id::text OR split_part(p_path,'/',2)<>'customer-proof' OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='order-documents' AND name=p_path AND owner_id=auth.uid()::text) THEN RAISE EXCEPTION 'Invalid payment proof'; END IF;
 IF EXISTS(SELECT 1 FROM public.documents WHERE storage_path=p_path) THEN RAISE EXCEPTION 'Proof already submitted'; END IF;
 INSERT INTO public.documents(order_id,name,doc_type,storage_path,customer_visible,created_by) VALUES(o.id,p_name,'payment_confirmation',p_path,true,auth.uid()) RETURNING id INTO did;
 INSERT INTO public.payments(order_id,amount,currency,status,payment_type,document_id,reference,created_by) VALUES(o.id,p_amount,o.currency,'initiated','partial',did,p_reference,auth.uid()) RETURNING id INTO pid;
 INSERT INTO public.order_updates(order_id,stage_name,note,document_id,created_by) VALUES(o.id,'Payment Proof Upload','Payment Submitted — awaiting administrator receipt verification.',did,auth.uid()); RETURN pid;
END $$;
CREATE OR REPLACE FUNCTION public.portal_approve_cad(p_order_id uuid,p_document_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE did uuid;
BEGIN
 PERFORM 1 FROM public.orders WHERE id=p_order_id AND customer_id=public.my_customer_id() AND status='active' AND order_type='jewellery' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order not available'; END IF;
 SELECT id INTO did FROM public.documents WHERE order_id=p_order_id AND doc_type='cad_design' AND customer_visible ORDER BY created_at DESC,id DESC LIMIT 1;
 IF did IS NULL OR did<>p_document_id THEN RAISE EXCEPTION 'Please review the latest CAD design'; END IF;
 INSERT INTO public.cad_approvals(order_id,document_id,approved_by) VALUES(p_order_id,did,auth.uid()) ON CONFLICT DO NOTHING;
 UPDATE public.order_stages SET details=details||jsonb_build_object('cad_approved',now()::text),status='completed' WHERE order_id=p_order_id AND stage_key='cad_approval';
 INSERT INTO public.order_updates(order_id,stage_name,note,document_id,created_by) VALUES(p_order_id,'CAD & Design Approval','Customer approved the latest CAD design.',did,auth.uid());
END $$;
CREATE OR REPLACE FUNCTION public.portal_order_extra(p_order_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.orders%rowtype;
BEGIN
 SELECT * INTO o FROM public.orders WHERE id=p_order_id AND customer_id=public.my_customer_id() AND status<>'cancelled'; IF NOT FOUND THEN RAISE EXCEPTION 'Order not available'; END IF;
 RETURN jsonb_build_object('payment_terms',o.payment_terms,'customer_action_required',o.customer_action_required,'current_responsible_dept',o.current_responsible_dept,'stage_positions',(SELECT jsonb_object_agg(id,journey_position) FROM public.order_stages WHERE order_id=o.id),'stage_documents',coalesce((SELECT jsonb_agg(jsonb_build_object('stage_id',u.stage_id,'document_id',u.document_id,'created_at',u.created_at)) FROM public.order_updates u JOIN public.documents d ON d.id=u.document_id WHERE u.order_id=o.id AND u.customer_visible AND d.customer_visible),'[]'::jsonb),'cad_approvals',coalesce((SELECT jsonb_agg(jsonb_build_object('document_id',document_id,'approved_at',approved_at)) FROM public.cad_approvals WHERE order_id=o.id),'[]'::jsonb));
END $$;
CREATE OR REPLACE FUNCTION public.enforce_admin_receipt() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND NOT public.is_admin() AND (NEW.status='confirmed' OR (TG_OP='UPDATE' AND OLD.status='confirmed')) THEN RAISE EXCEPTION 'Only administrators can confirm or change received payments'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER payments_admin_receipt BEFORE INSERT OR UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.enforce_admin_receipt();
CREATE OR REPLACE FUNCTION public.enforce_order_approval() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE latest_cad uuid;
BEGIN
 IF NEW.status IN ('in_progress','completed') AND NEW.status IS DISTINCT FROM OLD.status THEN
  IF NEW.stage_key IN ('payment_confirmed','advance_payment','final_payment') AND (EXISTS(SELECT 1 FROM public.payments WHERE order_id=NEW.order_id AND status='initiated') OR NOT EXISTS(SELECT 1 FROM public.payments WHERE order_id=NEW.order_id AND status='confirmed')) THEN RAISE EXCEPTION 'An administrator must verify payment receipt first'; END IF;
  IF NEW.stage_key IN ('diamond_preparation','manufacturing','quality_check','ready_to_ship','shipped','tracking') AND EXISTS(SELECT 1 FROM public.payments WHERE order_id=NEW.order_id AND status='initiated') THEN RAISE EXCEPTION 'Payment verification is pending'; END IF;
  IF NEW.stage_key IN ('cad_approval','manufacturing') THEN
   SELECT id INTO latest_cad FROM public.documents WHERE order_id=NEW.order_id AND doc_type='cad_design' AND customer_visible ORDER BY created_at DESC,id DESC LIMIT 1;
   IF latest_cad IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.cad_approvals WHERE order_id=NEW.order_id AND document_id=latest_cad) AND (NEW.stage_key='manufacturing' OR NEW.status='completed') THEN RAISE EXCEPTION 'Customer approval of the latest CAD design is required'; END IF;
  END IF;
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER order_approval_gate BEFORE UPDATE ON public.order_stages FOR EACH ROW EXECUTE FUNCTION public.enforce_order_approval();
CREATE OR REPLACE FUNCTION public.create_default_stages(p_order_id uuid,p_type text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF p_type='diamond' THEN
 INSERT INTO public.order_stages(order_id,stage_key,name,position,journey_position,is_payment_stage) VALUES
 (p_order_id,'proforma','Proforma Invoice',1,1,true),(p_order_id,'bank_details','Bank Details',2,2,false),(p_order_id,'payment_in_progress','Payment Proof Upload',3,3,true),(p_order_id,'payment_confirmed','Admin Receipt Verification',4,4,true),(p_order_id,'diamond_preparation','Start Preparing',5,5,false),(p_order_id,'quality_check','QC Photos',6,6,false),(p_order_id,'ready_to_ship','Packing',7,7,false),(p_order_id,'shipped','Handover',8,8,false),(p_order_id,'tracking','Tracking',9,9,false),(p_order_id,'delivered','Delivered',10,10,false),(p_order_id,'feedback','Feedback',11,11,false);
 ELSE
 INSERT INTO public.order_stages(order_id,stage_key,name,position,journey_position,is_payment_stage) VALUES
 (p_order_id,'order_confirmed','Order Confirmed',1,1,false),(p_order_id,'advance_payment','Advance Payment Confirmed',2,2,true),(p_order_id,'cad_approval','CAD & Design Approval',3,3,false),(p_order_id,'manufacturing','Manufacturing & Metal Supply',4,4,false),(p_order_id,'quality_check','Jewellery QC & Photos',5,5,false),(p_order_id,'ready_to_ship','Ready to Ship',6,6,false),(p_order_id,'final_payment','Final Payment Confirmed',7,7,true),(p_order_id,'shipped','Shipped',8,8,false),(p_order_id,'delivered','Delivered',9,9,false);
 END IF;
END $$;
UPDATE public.order_stages s SET journey_position=CASE s.stage_key WHEN 'order_confirmed' THEN 0 WHEN 'proforma' THEN 1 WHEN 'payment_in_progress' THEN 3 WHEN 'payment_confirmed' THEN 4 WHEN 'diamond_preparation' THEN 5 WHEN 'quality_check' THEN 6 WHEN 'ready_to_ship' THEN 7 WHEN 'shipped' THEN 8 WHEN 'delivered' THEN 10 ELSE s.position END FROM public.orders o WHERE o.id=s.order_id AND o.order_type='diamond';
INSERT INTO public.order_stages(order_id,stage_key,name,position,journey_position,status,completed_at) SELECT o.id,v.key,v.name,v.pos,v.jpos,CASE WHEN (v.key='bank_details' AND EXISTS(SELECT 1 FROM public.order_stages s WHERE s.order_id=o.id AND s.stage_key='proforma' AND s.status='completed')) OR (v.key='tracking' AND o.status='completed') THEN 'completed' ELSE 'upcoming' END,CASE WHEN (v.key='bank_details' AND EXISTS(SELECT 1 FROM public.order_stages s WHERE s.order_id=o.id AND s.stage_key='proforma' AND s.status='completed')) OR (v.key='tracking' AND o.status='completed') THEN o.updated_at ELSE NULL END FROM public.orders o CROSS JOIN (VALUES('bank_details','Bank Details',10,2),('tracking','Tracking',11,9),('feedback','Feedback',12,11)) v(key,name,pos,jpos) WHERE o.order_type='diamond' ON CONFLICT(order_id,stage_key) DO NOTHING;
CREATE OR REPLACE FUNCTION public.recompute_order_progress(p_order_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE total integer; done integer; cur public.order_stages%rowtype;
BEGIN
 SELECT count(*) FILTER(WHERE status<>'not_applicable'),count(*) FILTER(WHERE status='completed') INTO total,done FROM public.order_stages WHERE order_id=p_order_id AND journey_position>0 AND stage_key<>'feedback';
 SELECT * INTO cur FROM public.order_stages WHERE order_id=p_order_id AND journey_position>0 AND stage_key<>'feedback' ORDER BY CASE WHEN status IN ('in_progress','attention','blocked') THEN 0 WHEN status='upcoming' THEN 1 ELSE 2 END,CASE WHEN status='completed' THEN -journey_position ELSE journey_position END LIMIT 1;
 UPDATE public.orders SET progress_pct=CASE WHEN total=0 THEN 0 ELSE round(100.0*done/total) END,current_stage_key=cur.stage_key,current_stage_name=cur.name,current_stage_status=cur.status WHERE id=p_order_id;
END $$;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT id FROM public.orders LOOP PERFORM public.recompute_order_progress(r.id); END LOOP; END $$;
REVOKE ALL ON FUNCTION public.portal_submit_kyc(text),public.review_kyc(uuid,text,text),public.portal_accept_terms(text),public.portal_submit_payment(uuid,text,text,numeric,text),public.portal_approve_cad(uuid,uuid),public.portal_order_extra(uuid),public.enforce_admin_receipt(),public.enforce_order_approval() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.portal_submit_kyc(text),public.review_kyc(uuid,text,text),public.portal_accept_terms(text),public.portal_submit_payment(uuid,text,text,numeric,text),public.portal_approve_cad(uuid,uuid),public.portal_order_extra(uuid) TO authenticated,service_role;