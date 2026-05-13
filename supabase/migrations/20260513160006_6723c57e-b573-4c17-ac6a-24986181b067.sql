CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.grant_daily_free_credits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  granted_count integer;
BEGIN
  WITH updated AS (
    UPDATE public.user_credits
       SET free_credits   = 5,
           last_free_reset = CURRENT_DATE,
           updated_at     = now()
     WHERE last_free_reset < CURRENT_DATE
    RETURNING user_id
  )
  SELECT count(*) INTO granted_count FROM updated;

  INSERT INTO public.credit_transactions (user_id, amount, kind, description)
  SELECT user_id, 5, 'daily_grant', 'Daily free credit refill'
    FROM public.user_credits
   WHERE last_free_reset = CURRENT_DATE
     AND updated_at >= now() - interval '5 seconds';

  RETURN granted_count;
END;
$$;

-- Schedule the daily grant at 00:05 UTC. Unschedule first to keep idempotent.
DO $$
BEGIN
  PERFORM cron.unschedule('grant-daily-free-credits');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'grant-daily-free-credits',
  '5 0 * * *',
  $cron$ SELECT public.grant_daily_free_credits(); $cron$
);