-- Apply to a NEW dedicated Supabase project. All exam keys and credentials remain in a non-exposed schema.
create schema if not exists tka_private;
create table public.tka_profiles(id uuid primary key references auth.users(id) on delete cascade,name text not null,role text not null check(role in ('teacher','student')),grade text not null default 'XII',subject text not null default 'Matematika',school text not null default '');
alter table public.tka_profiles enable row level security;
create policy own_profile_read on public.tka_profiles for select to authenticated using(id=(select auth.uid()));
grant select on public.tka_profiles to authenticated;
create table tka_private.classes(id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.tka_profiles(id),name text not null,subject text not null,invite_code text unique not null default upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),ai_enabled boolean not null default false,ai_daily_limit int not null default 10 check(ai_daily_limit between 1 and 100));
create table tka_private.members(class_id uuid references tka_private.classes(id),student_id uuid references public.tka_profiles(id),primary key(class_id,student_id));
create table tka_private.questions(id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.tka_profiles(id),subject text not null,topic text not null,level text not null check(level in('L1','L2','L3')),question text not null,options jsonb not null,answer int not null,explanation text not null,status text not null default 'draft' check(status in('draft','ready','archived')),created_at timestamptz default now());
create table tka_private.documents(id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.tka_profiles(id),class_id uuid references tka_private.classes(id),title text not null,body text not null,kind text not null default 'material',created_at timestamptz default now());
create table tka_private.packages(id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.tka_profiles(id),class_id uuid references tka_private.classes(id),title text not null,subject text not null,duration int not null check(duration between 1 and 240),questions jsonb not null,keys jsonb not null,published boolean default false,release_results boolean default false,starts_at timestamptz,ends_at timestamptz,created_at timestamptz default now());
create table tka_private.attempts(id uuid primary key default gen_random_uuid(),student_id uuid not null references public.tka_profiles(id),package_id uuid not null references tka_private.packages(id),started_at timestamptz not null default now(),submitted_at timestamptz,answers jsonb not null default '{}',score numeric,correct int,unique(student_id,package_id));
create table tka_private.chats(id uuid primary key default gen_random_uuid(),owner_id uuid references public.tka_profiles(id),title text not null,messages jsonb not null default '[]',created_at timestamptz default now());
create table tka_private.ai_settings(owner_id uuid primary key references public.tka_profiles(id),encrypted_key text not null,model text not null default 'groq:openai/gpt-oss-20b',direction text not null default 'Jelas, terstruktur, dan sesuai jenjang siswa.');
create table tka_private.ai_usage(owner_id uuid references public.tka_profiles(id),user_id uuid references public.tka_profiles(id),day date not null default current_date,count int not null default 0,primary key(owner_id,user_id,day));
alter table tka_private.classes enable row level security;
alter table tka_private.members enable row level security;
alter table tka_private.questions enable row level security;
alter table tka_private.documents enable row level security;
alter table tka_private.packages enable row level security;
alter table tka_private.attempts enable row level security;
alter table tka_private.chats enable row level security;
alter table tka_private.ai_settings enable row level security;
alter table tka_private.ai_usage enable row level security;
create index on tka_private.classes(owner_id);
create index on tka_private.members(student_id);
create index on tka_private.questions(owner_id);
create index on tka_private.documents(owner_id);
create index on tka_private.packages(class_id);
create index on tka_private.attempts(package_id);
create index on tka_private.chats(owner_id);

create function tka_private.new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.tka_profiles(id,name,role,grade,subject,school) values(new.id,coalesce(nullif(new.raw_user_meta_data->>'name',''),'Pengguna'),case when new.raw_user_meta_data->>'role'='teacher' then 'teacher' else 'student' end,coalesce(new.raw_user_meta_data->>'grade','XII'),coalesce(new.raw_user_meta_data->>'subject','Matematika'),coalesce(new.raw_user_meta_data->>'school',''));
 return new;
end $$;
revoke all on function tka_private.new_user() from public,anon,authenticated;
create trigger tka_new_user after insert on auth.users for each row execute function tka_private.new_user();

create function tka_private.action(action text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); prof public.tka_profiles; cid uuid; pid uuid; aid uuid; cls tka_private.classes; pkg tka_private.packages; att tka_private.attempts; cfg tka_private.ai_settings; item jsonb; ids uuid[]; q jsonb; k jsonb; n int; right_count int; result jsonb; key_owner uuid;
begin
 if actor is null then raise exception 'Silakan masuk terlebih dahulu.';end if;
 select * into prof from public.tka_profiles where id=actor;
 if prof.id is null then raise exception 'Profil belum tersedia.';end if;
 if action='profile' then
  if payload ? 'name' then update public.tka_profiles set name=left(coalesce(nullif(payload->>'name',''),name),100),grade=left(coalesce(payload->>'grade',grade),50),subject=left(coalesce(payload->>'subject',subject),100),school=left(coalesce(payload->>'school',school),200) where id=actor;end if;
  return (select to_jsonb(p) from public.tka_profiles p where id=actor);
 elsif action='classes' then
  return coalesce((select jsonb_agg(to_jsonb(c)||jsonb_build_object('member_count',(select count(*) from tka_private.members m where m.class_id=c.id))) from tka_private.classes c where c.owner_id=actor or exists(select 1 from tka_private.members m where m.class_id=c.id and m.student_id=actor)),'[]');
 elsif action='create_class' then
  if prof.role<>'teacher' then raise exception 'Hanya guru dapat membuat kelas.';end if;
  if length(trim(payload->>'name'))<2 then raise exception 'Nama kelas wajib diisi.';end if;
  insert into tka_private.classes(owner_id,name,subject) values(actor,left(payload->>'name',100),left(coalesce(payload->>'subject',prof.subject),100)) returning to_jsonb(classes) into result;return result;
 elsif action='join_class' then
  if prof.role<>'student' then raise exception 'Gunakan akun siswa untuk bergabung.';end if;
  select * into cls from tka_private.classes where invite_code=upper(trim(payload->>'code'));
  if cls.id is null then raise exception 'Kode kelas tidak ditemukan.';end if;
  insert into tka_private.members values(cls.id,actor) on conflict do nothing;return to_jsonb(cls);
 elsif action='members' or action='class_settings' then
  cid:=(payload->>'id')::uuid;select * into cls from tka_private.classes where id=cid and owner_id=actor;
  if cls.id is null then raise exception 'Kelas tidak dapat diakses.';end if;
  if action='class_settings' then update tka_private.classes set ai_enabled=coalesce((payload->>'ai_enabled')::boolean,false),ai_daily_limit=coalesce((payload->>'ai_daily_limit')::int,10) where id=cid;return jsonb_build_object('ok',true);end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'grade',p.grade)) from tka_private.members m join public.tka_profiles p on p.id=m.student_id where m.class_id=cid),'[]');
 elsif action='questions' then
  if prof.role<>'teacher' then return '[]';end if;
  return coalesce((select jsonb_agg(to_jsonb(s) order by created_at desc) from tka_private.questions s where owner_id=actor),'[]');
 elsif action='save_question' or action='import_questions' then
  if prof.role<>'teacher' then raise exception 'Hanya guru dapat mengelola bank soal.';end if;
  if action='import_questions' and (jsonb_typeof(payload->'questions')<>'array' or jsonb_array_length(payload->'questions')>1500) then raise exception 'Import maksimal 1500 soal.';end if;
  for item in select value from jsonb_array_elements(case when action='save_question' then jsonb_build_array(payload) else payload->'questions' end) loop
   if length(trim(item->>'question'))<8 or jsonb_typeof(item->'options')<>'array' or jsonb_array_length(item->'options') not between 2 and 5 or coalesce((item->>'answer')::int,-1) not between 0 and jsonb_array_length(item->'options')-1 or item->>'level' not in('L1','L2','L3') or coalesce(item->>'topic','')='' or coalesce(item->>'explanation','')='' then raise exception 'Soal, opsi, kunci, topik, level dan pembahasan harus valid.';end if;
   if item->>'question' ~* '\[contoh butir|ganti dengan|lorem ipsum' then raise exception 'Placeholder tidak boleh masuk bank soal.';end if;
   if exists(select 1 from jsonb_array_elements_text(item->'options') x where trim(x.value)='') or (select count(distinct lower(trim(x.value))) from jsonb_array_elements_text(item->'options') x)<>jsonb_array_length(item->'options') then raise exception 'Pilihan kosong atau duplikat.';end if;
   if action='save_question' and nullif(item->>'id','') is not null then
    update tka_private.questions set subject=left(coalesce(item->>'subject',prof.subject),100),topic=left(item->>'topic',200),level=item->>'level',question=item->>'question',options=item->'options',answer=(item->>'answer')::int,explanation=item->>'explanation',status=coalesce(item->>'status','draft') where id=(item->>'id')::uuid and owner_id=actor;
    if not found then raise exception 'Soal tidak dapat diakses.';end if;
   else insert into tka_private.questions(owner_id,subject,topic,level,question,options,answer,explanation,status) values(actor,left(coalesce(item->>'subject',prof.subject),100),left(item->>'topic',200),item->>'level',item->>'question',item->'options',(item->>'answer')::int,item->>'explanation','draft');end if;
  end loop;return jsonb_build_object('ok',true);
 elsif action='question_status' then
  update tka_private.questions set status=payload->>'status' where id=(payload->>'id')::uuid and owner_id=actor;
  if not found then raise exception 'Soal tidak dapat diakses.';end if;return jsonb_build_object('ok',true);
 elsif action='documents' then
  return coalesce((select jsonb_agg(to_jsonb(d) order by created_at desc) from tka_private.documents d where owner_id=actor or (class_id is not null and exists(select 1 from tka_private.members m where m.class_id=d.class_id and m.student_id=actor))),'[]');
 elsif action='save_document' then
  cid:=nullif(payload->>'class_id','')::uuid;
  if cid is not null and not exists(select 1 from tka_private.classes where id=cid and owner_id=actor) then raise exception 'Kelas tidak dapat diakses.';end if;
  if coalesce(trim(payload->>'title'),'')='' or coalesce(trim(payload->>'body'),'')='' then raise exception 'Judul dan isi wajib diisi.';end if;
  if nullif(payload->>'id','') is null then insert into tka_private.documents(owner_id,class_id,title,body,kind) values(actor,cid,left(payload->>'title',200),payload->>'body',coalesce(payload->>'kind','material'));
  else update tka_private.documents set title=left(payload->>'title',200),body=payload->>'body',class_id=cid where id=(payload->>'id')::uuid and owner_id=actor;if not found then raise exception 'Dokumen tidak dapat diakses.';end if;end if;return jsonb_build_object('ok',true);
 elsif action='delete_document' then
  delete from tka_private.documents where id=(payload->>'id')::uuid and owner_id=actor;return jsonb_build_object('ok',true);
 elsif action='packages' then
  return coalesce((select jsonb_agg((to_jsonb(p)-'keys')||jsonb_build_object('question_count',jsonb_array_length(p.questions),'questions',case when p.owner_id=actor or p.starts_at is null or p.starts_at<=now() then p.questions else '[]'::jsonb end) order by created_at desc) from tka_private.packages p where p.owner_id=actor or (p.published and exists(select 1 from tka_private.members m where m.class_id=p.class_id and m.student_id=actor))),'[]');
 elsif action='create_package' then
  if prof.role<>'teacher' then raise exception 'Hanya guru dapat membuat paket.';end if;
  cid:=nullif(payload->>'class_id','')::uuid;
  if cid is not null and not exists(select 1 from tka_private.classes where id=cid and owner_id=actor) then raise exception 'Kelas tidak dapat diakses.';end if;
  select array_agg(value::uuid) into ids from jsonb_array_elements_text(payload->'question_ids');
  if coalesce(array_length(ids,1),0) not between 1 and 60 or (select count(distinct x) from unnest(ids) x)<>array_length(ids,1) then raise exception 'Paket harus berisi 1–60 soal unik.';end if;
  select count(*) into n from tka_private.questions where id=any(ids) and owner_id=actor and status='ready';
  if n<>array_length(ids,1) then raise exception 'Paket hanya boleh memakai soal milik Anda yang siap dipakai.';end if;
  select jsonb_agg(jsonb_build_object('id',s.id,'question',s.question,'options',s.options,'topic',s.topic,'level',s.level) order by array_position(ids,s.id)),jsonb_object_agg(s.id::text,jsonb_build_object('answer',s.answer,'explanation',s.explanation)) into q,k from tka_private.questions s where id=any(ids);
  if coalesce(trim(payload->>'title'),'')='' then raise exception 'Nama paket wajib diisi.';end if;
  if nullif(payload->>'starts_at','') is not null and nullif(payload->>'ends_at','') is not null and (payload->>'ends_at')::timestamptz <= (payload->>'starts_at')::timestamptz then raise exception 'Akhir jadwal harus setelah awal jadwal.';end if;
  insert into tka_private.packages(owner_id,class_id,title,subject,duration,questions,keys,starts_at,ends_at) values(actor,cid,left(payload->>'title',200),coalesce(nullif(trim(payload->>'subject'),''),prof.subject),(payload->>'duration')::int,q,k,nullif(payload->>'starts_at','')::timestamptz,nullif(payload->>'ends_at','')::timestamptz);return jsonb_build_object('ok',true);
 elsif action='publish_package' then
  update tka_private.packages set published=coalesce((payload->>'published')::boolean,true),release_results=coalesce((payload->>'release_results')::boolean,false) where id=(payload->>'id')::uuid and owner_id=actor and class_id is not null;
  if not found then raise exception 'Pilih kelas sebelum menerbitkan paket.';end if;return jsonb_build_object('ok',true);
 elsif action='start_attempt' then
  pid:=(payload->>'id')::uuid;select * into pkg from tka_private.packages where id=pid;
  if prof.role<>'student' or not coalesce(pkg.published,false) or not exists(select 1 from tka_private.members where class_id=pkg.class_id and student_id=actor) then raise exception 'Paket tidak dapat diakses.';end if;
  if pkg.starts_at>now() or pkg.ends_at<now() then raise exception 'Paket belum dibuka atau jadwal telah berakhir.';end if;
  insert into tka_private.attempts(student_id,package_id) values(actor,pid) on conflict(student_id,package_id) do nothing;
  return (select (case when pkg.release_results then to_jsonb(a) else to_jsonb(a)-'score'-'correct' end)||jsonb_build_object('questions',pkg.questions) from tka_private.attempts a where student_id=actor and package_id=pid);
 elsif action='save_attempt' or action='submit_attempt' then
  aid:=(payload->>'id')::uuid;select * into att from tka_private.attempts where id=aid and student_id=actor for update;
  if att.id is null then raise exception 'Jawaban tidak dapat diakses.';end if;
  select * into pkg from tka_private.packages where id=att.package_id;
  if att.submitted_at is not null then return case when pkg.release_results then to_jsonb(att) else to_jsonb(att)-'score'-'correct' end;end if;
  if jsonb_typeof(payload->'answers')<>'object' then raise exception 'Format jawaban tidak valid.';end if;
  if now()<=att.started_at+make_interval(mins=>pkg.duration) and (pkg.ends_at is null or now()<=pkg.ends_at) then
   for item in select value from jsonb_array_elements(pkg.questions) loop
    if payload->'answers' ? (item->>'id') and (jsonb_typeof(payload->'answers'->(item->>'id'))<>'number' or (payload->'answers'->>(item->>'id'))::numeric <> trunc((payload->'answers'->>(item->>'id'))::numeric) or (payload->'answers'->>(item->>'id'))::int not between 0 and jsonb_array_length(item->'options')-1) then raise exception 'Pilihan jawaban tidak valid.';end if;
   end loop;
   select coalesce(jsonb_object_agg(e.key,e.value),'{}') into result from jsonb_each(payload->'answers') e where pkg.keys ? e.key;
   update tka_private.attempts set answers=result where id=aid returning * into att;
  elsif action='save_attempt' then raise exception 'Waktu habis. Kirim jawaban yang sudah tersimpan.';end if;
  if action='submit_attempt' then
   select count(*) into right_count from jsonb_each(pkg.keys) e where att.answers->e.key=e.value->'answer';
   update tka_private.attempts set submitted_at=now(),correct=right_count,score=round(right_count*100.0/jsonb_array_length(pkg.questions),2) where id=aid returning * into att;
  end if;
  if not pkg.release_results then return to_jsonb(att)-'score'-'correct';end if;return to_jsonb(att);
 elsif action='results' then
  update tka_private.attempts a set submitted_at=now(),correct=(select count(*) from jsonb_each(p.keys) e where a.answers->e.key=e.value->'answer'),score=round((select count(*) from jsonb_each(p.keys) e where a.answers->e.key=e.value->'answer')*100.0/jsonb_array_length(p.questions),2) from tka_private.packages p where p.id=a.package_id and a.submitted_at is null and (a.student_id=actor or p.owner_id=actor) and (now()>a.started_at+make_interval(mins=>p.duration) or now()>p.ends_at);
  return coalesce((select jsonb_agg((case when p.owner_id=actor or p.release_results then to_jsonb(a) else to_jsonb(a)-'score'-'correct' end)||jsonb_build_object('student_name',u.name,'package_title',p.title,'questions',p.questions,'keys',case when a.submitted_at is not null and (p.owner_id=actor or p.release_results) then p.keys else '{}'::jsonb end) order by a.started_at desc) from tka_private.attempts a join tka_private.packages p on p.id=a.package_id join public.tka_profiles u on u.id=a.student_id where a.student_id=actor or p.owner_id=actor),'[]');
 elsif action='package_detail' then
  select * into pkg from tka_private.packages where id=(payload->>'id')::uuid and owner_id=actor;
  if pkg.id is null then raise exception 'Paket tidak dapat diakses.';end if;return to_jsonb(pkg);
 elsif action='chats' then
  return coalesce((select jsonb_agg(to_jsonb(c) order by created_at desc) from tka_private.chats c where owner_id=actor),'[]');
 elsif action='save_chat' then
  if jsonb_typeof(payload->'messages')<>'array' or length(payload->'messages'::text)>200000 then raise exception 'Percakapan terlalu panjang.';end if;
  if nullif(payload->>'id','') is null then insert into tka_private.chats(owner_id,title,messages) values(actor,left(coalesce(payload->>'title','Percakapan'),100),payload->'messages') returning to_jsonb(chats) into result;
  else update tka_private.chats set messages=payload->'messages' where id=(payload->>'id')::uuid and owner_id=actor returning to_jsonb(chats) into result;if not found then raise exception 'Percakapan tidak dapat diakses.';end if;end if;return result;
 elsif action='delete_chat' then delete from tka_private.chats where id=(payload->>'id')::uuid and owner_id=actor;return jsonb_build_object('ok',true);
 elsif action='ai_status' then
  return coalesce((select jsonb_build_object('installed',true,'model',model,'direction',direction) from tka_private.ai_settings where owner_id=actor),jsonb_build_object('installed',false,'model','groq:openai/gpt-oss-20b','direction','Jelas, terstruktur, dan sesuai jenjang siswa.'));
 elsif action='save_ai' then
  if length(payload->>'encrypted_key')<20 then raise exception 'API key belum tersedia.';end if;
  insert into tka_private.ai_settings values(actor,payload->>'encrypted_key',left(payload->>'model',100),left(coalesce(payload->>'direction',''),1000)) on conflict(owner_id) do update set encrypted_key=excluded.encrypted_key,model=excluded.model,direction=excluded.direction;return jsonb_build_object('ok',true);
 elsif action='delete_ai' then delete from tka_private.ai_settings where owner_id=actor;return jsonb_build_object('ok',true);
 elsif action='ai_config' then
  if coalesce(current_setting('request.jwt.claims',true),'{}')::jsonb->>'role' is distinct from 'service_role' then raise exception 'Konfigurasi hanya tersedia untuk server.';end if;
  key_owner:=actor;
  cid:=nullif(payload->>'class_id','')::uuid;
  if cid is not null then
   select * into cls from tka_private.classes where id=cid and (owner_id=actor or exists(select 1 from tka_private.members m where m.class_id=cid and m.student_id=actor));
   if cls.id is null or not cls.ai_enabled then raise exception 'AI kelas belum diaktifkan guru.';end if;key_owner:=cls.owner_id;
   if exists(select 1 from tka_private.attempts a join tka_private.packages p on p.id=a.package_id where a.student_id=actor and p.class_id=cid and a.submitted_at is null and now()<a.started_at+make_interval(mins=>p.duration)) then raise exception 'AI kelas ditutup selama tryout berlangsung.';end if;
  end if;
  select * into cfg from tka_private.ai_settings where owner_id=key_owner;
  if cfg.owner_id is null then raise exception 'Pasang API key di Pengaturan AI, atau pilih kelas yang mengaktifkan AI.';end if;
  insert into tka_private.ai_usage(owner_id,user_id,count) values(key_owner,actor,1) on conflict(owner_id,user_id,day) do update set count=tka_private.ai_usage.count+1 returning count into n;
  if n>(case when cid is not null and actor<>key_owner then cls.ai_daily_limit else 100 end) then raise exception 'Kuota AI harian tercapai.';end if;
  return to_jsonb(cfg)||jsonb_build_object('role',prof.role,'grade',prof.grade,'subject',prof.subject);
 end if;
 raise exception 'Operasi tidak dikenal.';
end $$;
revoke all on function tka_private.action(text,jsonb) from public,anon;
grant usage on schema tka_private to authenticated;
grant execute on function tka_private.action(text,jsonb) to authenticated;
create function public.tka_action(action text,payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$ select tka_private.action(action,payload); $$;
revoke all on function public.tka_action(text,jsonb) from public,anon;
grant execute on function public.tka_action(text,jsonb) to authenticated;

create function public.tka_ai_config(actor uuid,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$ begin perform set_config('request.jwt.claim.sub',actor::text,true);return tka_private.action('ai_config',payload);end $$;
revoke all on function public.tka_ai_config(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.tka_ai_config(uuid,jsonb) to service_role;
