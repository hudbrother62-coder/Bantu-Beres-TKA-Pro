-- GroqCloud is the only active AI provider. Keep existing encrypted credentials
-- untouched; previous-provider settings can be replaced by users in Settings.
alter table tka_private.ai_settings
  alter column model set default 'groq:openai/gpt-oss-20b';

do $$
declare current_definition text;
begin
 current_definition := pg_get_functiondef('tka_private.action(text,jsonb)'::regprocedure);
 if position('gemini-2.5-flash' in current_definition)>0 then
   execute replace(current_definition, 'gemini-2.5-flash', 'groq:openai/gpt-oss-20b');
 end if;
end $$;
