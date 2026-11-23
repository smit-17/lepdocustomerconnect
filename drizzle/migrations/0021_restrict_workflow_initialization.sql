REVOKE ALL ON FUNCTION public.create_default_stages(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_default_stages(uuid,text) TO service_role;