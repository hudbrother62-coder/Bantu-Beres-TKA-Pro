-- The browser only gets ciphertext; decryption remains in the Vercel server.
-- An authenticated user may select their own configuration or a project
-- explicitly shared by its teacher; untrusted IDs must never grant access.
create or replace function public.tka_ai_context(payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 account_id uuid:=auth.uid();
 account public.tka_profiles;
 project_id uuid;
 workspace tka_private.classes;
 target_owner uuid;
 config_row tka_private.ai_settings;
 used int;
begin
 if account_id is null then raise exception 'Silakan masuk terlebih dahulu.'; end if;
 select p.* into account from public.tka_profiles p where p.id=account_id;
 if account.id is null then raise exception 'Profil pengguna belum tersedia.'; end if;
 target_owner:=account_id;
 project_id:=nullif(payload->>'class_id','')::uuid;
 if project_id is not null then
  select c.* into workspace from tka_private.classes c
  where c.id=project_id and
   (c.owner_id=account_id or exists(select 1 from tka_private.members m
       where m.class_id=c.id and m.student_id=account_id));
  if workspace.id is null or not workspace.ai_enabled
   then raise exception 'AI project belum diaktifkan guru atau akses belum diberikan.'; end if;
  target_owner:=workspace.owner_id;
  if account_id<>target_owner and exists(
    select 1 from tka_private.attempts a join tka_private.packages p on p.id=a.package_id
    where a.student_id=account_id and p.class_id=project_id and a.submitted_at is null
     and now()<a.started_at+make_interval(mins=>p.duration)
  ) then raise exception 'AI project ditutup selama tryout berlangsung.'; end if;
 end if;
 select a.* into config_row from tka_private.ai_settings a where a.owner_id=target_owner;
 if config_row.owner_id is null
  then raise exception 'Pasang API key Gemini terlebih dahulu melalui Pengaturan AI.'; end if;
 insert into tka_private.ai_usage(owner_id,user_id,count) values(target_owner,account_id,1)
 on conflict(owner_id,user_id,day) do update set count=tka_private.ai_usage.count+1
 returning count into used;
 if used>(case when project_id is not null and account_id<>target_owner
   then workspace.ai_daily_limit else 100 end)
  then raise exception 'Kuota AI harian tercapai.'; end if;
 return to_jsonb(config_row)||jsonb_build_object(
   'role',account.role,'grade',account.grade,'subject',account.subject);
end $$;
revoke all on function public.tka_ai_context(jsonb) from public,anon;
grant execute on function public.tka_ai_context(jsonb) to authenticated;
