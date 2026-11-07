CREATE TABLE IF NOT EXISTS public.bb_recovery_codes (user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, account_email text NOT NULL UNIQUE, code_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), used_at timestamptz);
ALTER TABLE public.bb_recovery_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.bb_recovery_codes FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.bb_recovery_codes TO service_role;
CREATE OR REPLACE FUNCTION public.bb_consume_recovery_code(p_email text,p_hash text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result_id uuid;
BEGIN
 UPDATE public.bb_recovery_codes SET used_at=now() WHERE account_email=lower(p_email) AND code_hash=p_hash AND used_at IS NULL RETURNING user_id INTO result_id;
 RETURN result_id;
END $$;
REVOKE ALL ON FUNCTION public.bb_consume_recovery_code(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bb_consume_recovery_code(text,text) TO service_role;