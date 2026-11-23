ALTER TABLE public.order_stages ADD COLUMN ui_schema jsonb;
CREATE TABLE public.workflow_templates(order_type text PRIMARY KEY CHECK(order_type IN ('diamond','jewellery')),definition jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.workflow_templates TO authenticated;
GRANT ALL ON public.workflow_templates TO service_role;
ALTER TABLE public.workflow_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY workflow_staff_read ON public.workflow_templates FOR SELECT TO authenticated USING(public.is_staff());
CREATE FUNCTION public.original_workflow(p_type text) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=public AS $fn$
SELECT jsonb_agg(jsonb_build_object('key',k,'name',n,'description','','fields',coalesce(fields,'[]'::jsonb)) ORDER BY pos) FROM (VALUES
('proforma','Proforma Invoice',1,NULL::jsonb),('bank_details','Bank Details Shared',2,'[{"key":"bank_details_shared","label":"Bank details shared","type":"checkbox"}]'::jsonb),('payment_in_progress','Payment Initiated / Proof Submitted',3,'[{"key":"payment_initiated","label":"Payment initiated","type":"checkbox"},{"key":"payment_reflected","label":"Payment reflected","type":"checkbox"},{"key":"payment_documents_submitted","label":"Required payment documents submitted","type":"checkbox"}]'::jsonb),('payment_confirmed','Payment Received / Finance Verification',4,'[{"key":"payment_confirmed_received","label":"Payment confirmed received","type":"checkbox"},{"key":"invoice_uploaded","label":"Applicable invoice uploaded","type":"checkbox"}]'::jsonb),('diamond_preparation',CASE WHEN p_type='diamond' THEN 'Start Preparing Order' ELSE 'Start Preparing' END,5,CASE WHEN p_type='jewellery' THEN '[{"key":"preparation_started","label":"Preparation started","type":"checkbox"}]'::jsonb END),('cad_approval','CAD Creation & Approval',6,'[{"key":"requirements_shared","label":"CAD creation — specs confirmed","type":"checkbox"},{"key":"cad_received","label":"CAD file uploaded","type":"checkbox"},{"key":"internal_qc_passed","label":"Internal CAD QC passed","type":"checkbox"},{"key":"customer_approved","label":"Customer approved CAD","type":"checkbox"},{"key":"cad_approved","label":"CAD approved","type":"checkbox"},{"key":"rework_required","label":"Rework required","type":"checkbox"}]'::jsonb),('manufacturing','Manufacturing & Metal Supply',7,'[{"key":"metal_supply_received","label":"Metal supply received","type":"checkbox"},{"key":"materials_issued","label":"Diamond and metal issued","type":"checkbox"},{"key":"manufacturing_started","label":"Manufacturing started","type":"checkbox"},{"key":"in_making","label":"In making","type":"checkbox"},{"key":"manufacturing_completed","label":"Manufacturing completed","type":"checkbox"}]'::jsonb),('quality_check',CASE WHEN p_type='diamond' THEN 'Diamond Quality Check' ELSE 'Jewellery QC & Photography' END,8,CASE WHEN p_type='diamond' THEN '[{"key":"diamond_qc_completed","label":"Diamond QC completed","type":"checkbox"}]'::jsonb ELSE '[{"key":"qc_completed","label":"QC completed","type":"checkbox"},{"key":"recheck_required","label":"Recheck required","type":"checkbox"},{"key":"photos_uploaded","label":"Jewellery photography completed","type":"checkbox"},{"key":"customer_approved","label":"Customer approved QC","type":"checkbox"}]'::jsonb END),('ready_to_ship','Goods Ready to Parcel',9,'[{"key":"parcel_packed","label":"Parcel packed","type":"checkbox"}]'::jsonb),('final_invoice','Final Invoice Issued',10,'[{"key":"final_invoice_issued","label":"Final invoice issued","type":"checkbox"}]'::jsonb),('shipped','Handed Over to Shipping Company',11,'[{"key":"tracking_added","label":"Tracking details added","type":"checkbox"}]'::jsonb),('tracking','Shipment Tracking',12,'[{"key":"tracking_added","label":"Tracking details added","type":"checkbox"}]'::jsonb),('delivered','Delivered',13,NULL::jsonb),('feedback','Customer Feedback',14,NULL::jsonb)) v(k,n,pos,fields) WHERE p_type='jewellery' OR k NOT IN ('cad_approval','manufacturing') $fn$;
CREATE FUNCTION public.validate_workflow(p_definition jsonb) RETURNS void LANGUAGE plpgsql SET search_path=public AS $fn$
DECLARE s jsonb; f jsonb;
BEGIN
 IF p_definition IS NULL OR jsonb_typeof(p_definition)<>'array' OR jsonb_array_length(p_definition) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'A workflow needs 1 to 100 stages'; END IF;
 IF (SELECT count(*) FROM jsonb_array_elements(p_definition))<>(SELECT count(DISTINCT value->>'key') FROM jsonb_array_elements(p_definition)) THEN RAISE EXCEPTION 'Duplicate stage keys'; END IF;
 FOR s IN SELECT value FROM jsonb_array_elements(p_definition) LOOP
 IF coalesce(s->>'key','') !~ '^[a-zA-Z0-9_]{1,100}$' OR length(coalesce(s->>'name',''))>120 OR length(coalesce(s->>'description',''))>2000 OR jsonb_typeof(s->'fields') IS DISTINCT FROM 'array' OR jsonb_array_length(s->'fields')>100 THEN RAISE EXCEPTION 'Invalid stage definition'; END IF;
 IF (SELECT count(*) FROM jsonb_array_elements(s->'fields'))<>(SELECT count(DISTINCT value->>'key') FROM jsonb_array_elements(s->'fields')) THEN RAISE EXCEPTION 'Duplicate field keys'; END IF;
 FOR f IN SELECT value FROM jsonb_array_elements(s->'fields') LOOP
 IF coalesce(f->>'key','') !~ '^[a-zA-Z0-9_]{1,100}$' OR coalesce(f->>'type','') NOT IN ('checkbox','text','number','date','textarea') OR length(coalesce(f->>'label',''))>200 OR length(coalesce(f->>'description',''))>2000 THEN RAISE EXCEPTION 'Invalid field definition'; END IF;
 END LOOP; END LOOP;
END $fn$;
CREATE FUNCTION public.apply_order_workflow(p_order_id uuid,p_definition jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE s jsonb; v_position int; v_journey int:=0;
BEGIN
 PERFORM public.validate_workflow(p_definition);
 PERFORM 1 FROM public.orders WHERE id=p_order_id FOR UPDATE;
 SELECT coalesce(max(position),0) INTO v_position FROM public.order_stages WHERE order_id=p_order_id;
 UPDATE public.order_stages SET journey_position=0 WHERE order_id=p_order_id AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_definition) j WHERE j->>'key'=stage_key);
 FOR s IN SELECT value FROM jsonb_array_elements(p_definition) LOOP
 v_position:=v_position+1; v_journey:=v_journey+1;
 IF EXISTS(SELECT 1 FROM public.order_stages WHERE order_id=p_order_id AND stage_key=s->>'key') THEN
 UPDATE public.order_stages SET name=coalesce(nullif(trim(s->>'name'),''),'Untitled step'),journey_position=v_journey,ui_schema=jsonb_build_object('description',coalesce(s->>'description',''),'fields',s->'fields') WHERE order_id=p_order_id AND stage_key=s->>'key';
 ELSE
 INSERT INTO public.order_stages(order_id,stage_key,name,position,journey_position,is_payment_stage,ui_schema) VALUES(p_order_id,s->>'key',coalesce(nullif(trim(s->>'name'),''),'Untitled step'),v_position,v_journey,s->>'key' IN ('proforma','payment_in_progress','payment_confirmed','advance_payment','final_payment'),jsonb_build_object('description',coalesce(s->>'description',''),'fields',s->'fields'));
 END IF; END LOOP;
 PERFORM public.recompute_order_progress(p_order_id);
END $fn$;
REVOKE ALL ON FUNCTION public.apply_order_workflow(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_order_workflow(uuid,jsonb) TO service_role;
CREATE FUNCTION public.admin_save_order_workflow(p_order_id uuid,p_definition jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Administrators only' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.orders WHERE id=p_order_id) THEN RAISE EXCEPTION 'Order not found'; END IF;
 PERFORM public.apply_order_workflow(p_order_id,p_definition);
 INSERT INTO public.order_updates(order_id,note,customer_visible) VALUES(p_order_id,'Order workflow customized; progress history retained.',false);
END $fn$;
CREATE FUNCTION public.admin_get_workflow(p_type text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $fn$
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Administrators only' USING ERRCODE='42501'; END IF;
 IF p_type NOT IN ('diamond','jewellery') THEN RAISE EXCEPTION 'Invalid order type'; END IF;
 RETURN coalesce((SELECT definition FROM public.workflow_templates WHERE order_type=p_type),public.original_workflow(p_type));
END $fn$;
CREATE FUNCTION public.admin_save_workflow(p_type text,p_definition jsonb DEFAULT NULL,p_reset boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE d jsonb; oid uuid;
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Administrators only' USING ERRCODE='42501'; END IF;
 IF p_type NOT IN ('diamond','jewellery') THEN RAISE EXCEPTION 'Invalid order type'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('workflow_'||p_type));
 d:=CASE WHEN p_reset THEN public.original_workflow(p_type) ELSE p_definition END;
 PERFORM public.validate_workflow(d);
 INSERT INTO public.workflow_templates(order_type,definition) VALUES(p_type,d) ON CONFLICT(order_type) DO UPDATE SET definition=EXCLUDED.definition,updated_at=now();
 FOR oid IN SELECT id FROM public.orders WHERE order_type=p_type ORDER BY id LOOP
 PERFORM public.apply_order_workflow(oid,d);
 INSERT INTO public.order_updates(order_id,note,customer_visible) VALUES(oid,CASE WHEN p_reset THEN 'Workflow restored to default; progress history retained.' ELSE 'Universal workflow applied; progress history retained.' END,false);
 END LOOP;
END $fn$;
REVOKE ALL ON FUNCTION public.admin_get_workflow(text),public.admin_save_workflow(text,jsonb,boolean),public.admin_save_order_workflow(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_get_workflow(text),public.admin_save_workflow(text,jsonb,boolean),public.admin_save_order_workflow(uuid,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.create_default_stages(p_order_id uuid,p_type text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('workflow_'||p_type));
 PERFORM public.apply_order_workflow(p_order_id,coalesce((SELECT definition FROM public.workflow_templates WHERE order_type=p_type),public.original_workflow(p_type)));
END $fn$;
ALTER TABLE public.customers DROP CONSTRAINT customers_name_check, ADD CONSTRAINT customers_name_check CHECK(length(trim(name))<=200);
ALTER TABLE public.customers DROP CONSTRAINT customers_country_check, ADD CONSTRAINT customers_country_check CHECK(length(trim(country))<=80);
ALTER TABLE public.customers DROP CONSTRAINT customers_email_check, ADD CONSTRAINT customers_email_check CHECK(email='' OR (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' AND length(email)<=200));
ALTER TABLE public.orders DROP CONSTRAINT orders_title_check, ADD CONSTRAINT orders_title_check CHECK(length(trim(title))<=200);
ALTER TABLE public.app_settings DROP CONSTRAINT app_settings_company_name_check, ADD CONSTRAINT app_settings_company_name_check CHECK(length(trim(company_name))<=120);
ALTER TABLE public.payments DROP CONSTRAINT payments_amount_check, ADD CONSTRAINT payments_amount_check CHECK(amount>=0 AND (status<>'confirmed' OR amount>0));
ALTER TABLE public.customers ADD COLUMN is_unassigned boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX one_unassigned_customer_per_executive ON public.customers(assigned_executive_id) WHERE is_unassigned;
CREATE FUNCTION public.staff_unassigned_customer() RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE cid uuid;
BEGIN
 IF NOT public.is_staff() THEN RAISE EXCEPTION 'Team members only' USING ERRCODE='42501'; END IF;
 INSERT INTO public.customers(name,email,country,assigned_executive_id,is_unassigned,created_by) VALUES('Unassigned customer','','',auth.uid(),true,auth.uid()) ON CONFLICT(assigned_executive_id) WHERE is_unassigned DO UPDATE SET is_unassigned=true RETURNING id INTO cid;
 RETURN cid;
END $fn$;
REVOKE ALL ON FUNCTION public.staff_unassigned_customer() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.staff_unassigned_customer() TO authenticated;
DO $fn$
DECLARE d text;
BEGIN
 SELECT pg_get_functiondef('public.portal_order(uuid)'::regprocedure) INTO d;
 d:=replace(d,'''details'', s.details)','''details'', s.details, ''ui_schema'', s.ui_schema)'); EXECUTE d;
 SELECT pg_get_functiondef('public.public_shared_customer(text)'::regprocedure) INTO d;
 d:=replace(d,'''customer_note'',s.customer_note)','''customer_note'',s.customer_note,''ui_schema'',s.ui_schema)'); EXECUTE d;
 SELECT pg_get_functiondef('public.portal_decide_approval(uuid,text,text,text)'::regprocedure) INTO d;
 d:=replace(d,'IF p_decision=''changes_requested'' AND (coalesce(trim(p_reason),'''')='''' OR coalesce(trim(p_notes),'''')='''') THEN RAISE EXCEPTION ''Please give a reason and notes''; END IF;','');
 d:=replace(d,'||p_reason||'' — ''||p_notes','||coalesce(p_reason,'''')||'' — ''||coalesce(p_notes,'''')'); EXECUTE d;
 SELECT pg_get_functiondef('public.review_kyc(uuid,text,text)'::regprocedure) INTO d;
 d:=replace(d,' OR (p_status IN (''Rejected'',''Re-KYC'') AND length(trim(coalesce(p_reason,'''')))=0)',''); EXECUTE d;
END $fn$;