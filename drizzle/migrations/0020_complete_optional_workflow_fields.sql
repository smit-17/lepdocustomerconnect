ALTER TABLE public.shipments DROP CONSTRAINT shipments_courier_check, ADD CONSTRAINT shipments_courier_check CHECK(length(trim(courier))<=80);
DO $fn$
DECLARE d text;
BEGIN
 SELECT pg_get_functiondef('public.original_workflow(text)'::regprocedure) INTO d;
 d:=replace(d,'''fields'',coalesce(fields,''[]''::jsonb)', '''fields'',CASE WHEN p_type=''jewellery'' AND k IN (''bank_details'',''payment_in_progress'',''payment_confirmed'',''tracking'') THEN ''[]''::jsonb WHEN p_type=''diamond'' AND k=''proforma'' THEN ''[{"key":"bank_details_shared","label":"Bank details shared","type":"checkbox"}]''::jsonb ELSE coalesce(fields,''[]''::jsonb) END');
 EXECUTE d;
 SELECT pg_get_functiondef('public.tg_stage_before()'::regprocedure) INTO d;
 d:=replace(d,'new.order_id := old.order_id;', 'IF new.ui_schema IS DISTINCT FROM old.ui_schema AND auth.uid() IS NOT NULL AND NOT public.is_admin() THEN RAISE EXCEPTION ''Administrators only'' USING ERRCODE=''42501''; END IF; new.order_id := old.order_id;');
 EXECUTE d;
END $fn$;
CREATE OR REPLACE FUNCTION public.portal_submit_payment(p_order_id uuid,p_path text,p_name text,p_amount numeric,p_reference text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE o public.orders%rowtype; did uuid; pid uuid; amount numeric:=coalesce(p_amount,0);
BEGIN
 SELECT * INTO o FROM public.orders WHERE id=p_order_id AND customer_id=public.my_customer_id() AND status='active' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order not available'; END IF;
 IF amount<0 OR amount>999999999999 OR length(coalesce(p_name,''))>200 OR length(coalesce(p_reference,''))>120 THEN RAISE EXCEPTION 'Invalid payment amount or reference'; END IF;
 IF nullif(p_path,'') IS NOT NULL THEN
 IF split_part(p_path,'/',1)<>o.id::text OR split_part(p_path,'/',2)<>'customer-proof' OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='order-documents' AND name=p_path AND owner_id=auth.uid()::text) THEN RAISE EXCEPTION 'Invalid payment proof'; END IF;
 IF EXISTS(SELECT 1 FROM public.documents WHERE storage_path=p_path) THEN RAISE EXCEPTION 'Proof already submitted'; END IF;
 INSERT INTO public.documents(order_id,name,doc_type,storage_path,customer_visible,created_by) VALUES(o.id,coalesce(nullif(p_name,''),'Payment proof'),'payment_confirmation',p_path,true,auth.uid()) RETURNING id INTO did;
 END IF;
 INSERT INTO public.payments(order_id,amount,currency,status,payment_type,document_id,reference,created_by) VALUES(o.id,amount,o.currency,'initiated','partial',did,p_reference,auth.uid()) RETURNING id INTO pid;
 INSERT INTO public.order_updates(order_id,stage_name,note,document_id,created_by) VALUES(o.id,'Payment Proof Upload','Payment Submitted — awaiting administrator receipt verification.',did,auth.uid()); RETURN pid;
END $fn$;
DO $fn$
DECLARE d text;
BEGIN
 SELECT pg_get_functiondef('public.portal_submit_feedback(uuid,integer,text)'::regprocedure) INTO d;
 d:=replace(d,'if p_rating is null or p_rating not between 1 and 5 then', 'if p_rating is not null and p_rating not between 1 and 5 then'); EXECUTE d;
END $fn$;