DO $$ DECLARE definition text; BEGIN
 SELECT pg_get_functiondef(oid) INTO definition FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='assert_order_steps_editable';
 definition:=replace(definition,'SELECT status INTO v_status','IF NOT public.staff_can_access_order(p_order_id) THEN RAISE EXCEPTION ''Order access denied'' USING ERRCODE=''42501''; END IF; SELECT status INTO v_status'); EXECUTE definition;
 SELECT pg_get_functiondef(oid) INTO definition FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='review_kyc';
 definition:=replace(definition,'UPDATE public.kyc_records','IF NOT EXISTS(SELECT 1 FROM public.kyc_records k WHERE k.id=p_id AND public.staff_can_access_customer(k.customer_id)) THEN RAISE EXCEPTION ''Customer access denied'' USING ERRCODE=''42501''; END IF; UPDATE public.kyc_records'); EXECUTE definition;
END $$;