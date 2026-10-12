-- Additive migration. Preserves all existing accounts, classes, packages and attempts.
-- The first element remains the primary subject used by existing integrations.
alter table public.tka_profiles
  add column if not exists subjects text[] not null default '{}'::text[];
update public.tka_profiles set subjects = array[subject]
where coalesce(array_length(subjects,1),0)=0;

create or replace function public.tka_subjects(subject_items text[] default null)
returns text[]
language plpgsql security definer set search_path=''
as $$
declare uid uuid := auth.uid(); current_role text; clean text[];
begin
 if uid is null then raise exception 'Masuk terlebih dahulu.'; end if;
 select role into current_role from public.tka_profiles where id=uid;
 if current_role is null then raise exception 'Profil tidak ditemukan.'; end if;
 if subject_items is not null then
   if current_role <> 'teacher' then raise exception 'Hanya guru yang dapat mengelola daftar mata pelajaran.'; end if;
   select coalesce(array_agg(t.s order by t.ord),'{}'::text[]) into clean
   from (select btrim(x) as s, ord
         from unnest(subject_items) with ordinality as z(x,ord)) t;
   if coalesce(array_length(clean,1),0)<1 or array_length(clean,1)>20
     then raise exception 'Pilih 1–20 mata pelajaran.'; end if;
   if exists(select 1 from unnest(clean) as x where length(x)<2 or length(x)>100)
     then raise exception 'Nama mata pelajaran harus 2–100 karakter.'; end if;
   if (select count(distinct lower(x)) from unnest(clean) as x) <> array_length(clean,1)
     then raise exception 'Mata pelajaran tidak boleh duplikat.'; end if;
   update public.tka_profiles set subjects=clean,subject=clean[1] where id=uid;
 end if;
 return (select case when cardinality(subjects)>0 then subjects else array[subject] end
         from public.tka_profiles where id=uid);
end $$;
revoke all on function public.tka_subjects(text[]) from public,anon;
grant execute on function public.tka_subjects(text[]) to authenticated;
