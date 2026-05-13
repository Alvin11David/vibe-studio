
REVOKE EXECUTE ON FUNCTION public.spend_credit(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_paid_credits(UUID, INT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.spend_credit(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_paid_credits(UUID, INT, TEXT) TO service_role;
