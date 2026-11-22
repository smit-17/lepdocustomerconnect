CREATE OR REPLACE FUNCTION public.admin_delete_order_history(p_order_id uuid DEFAULT NULL, p_confirmation text DEFAULT '')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paths jsonb;
  v_count integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can delete order history.' USING ERRCODE = '42501';
  END IF;
  IF p_order_id IS NULL AND p_confirmation <> 'RESET HISTORY' THEN
    RAISE EXCEPTION 'Type RESET HISTORY to confirm.';
  END IF;
  LOCK TABLE public.orders IN SHARE ROW EXCLUSIVE MODE;
  IF p_order_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.orders WHERE id = p_order_id) THEN
    RAISE EXCEPTION 'Order not found.';
  END IF;
  SELECT coalesce(jsonb_agg(DISTINCT path), '[]'::jsonb) INTO v_paths FROM (
    SELECT storage_path AS path FROM public.documents WHERE p_order_id IS NULL OR order_id = p_order_id
    UNION
    SELECT file_path AS path FROM public.order_approvals WHERE p_order_id IS NULL OR order_id = p_order_id
  ) files WHERE path IS NOT NULL AND path <> '';
  DELETE FROM public.cad_approvals WHERE p_order_id IS NULL OR order_id = p_order_id;
  DELETE FROM public.orders WHERE p_order_id IS NULL OR id = p_order_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('deleted_count', v_count, 'paths', v_paths);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_delete_order_history(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_order_history(uuid, text) TO authenticated;
