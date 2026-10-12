-- User-visible terminology only: "class" workspaces are called "Project".
-- Keep the existing table, ID, RPC actions, RLS and references unchanged.
-- CREATE OR REPLACE generated from the installed function preserves its privileges
-- and avoids destructive data migrations.
do $rename_project_messages$
declare routine text;
begin
  routine := pg_get_functiondef('tka_private.action(text,jsonb)'::regprocedure);
  if routine is null then
    raise exception 'TKA action function is missing';
  end if;
  routine := replace(routine, 'Hanya guru dapat membuat kelas.', 'Hanya guru dapat membuat project.');
  routine := replace(routine, 'Nama kelas wajib diisi.', 'Nama project wajib diisi.');
  routine := replace(routine, 'Kode kelas tidak ditemukan.', 'Kode project tidak ditemukan.');
  routine := replace(routine, 'Kelas tidak dapat diakses.', 'Project tidak dapat diakses.');
  routine := replace(routine, 'Pilih kelas sebelum menerbitkan paket.', 'Pilih project sebelum menerbitkan paket.');
  routine := replace(routine, 'AI kelas belum diaktifkan guru.', 'AI project belum diaktifkan guru.');
  routine := replace(routine, 'Pasang API key di Pengaturan AI, atau pilih kelas yang mengaktifkan AI.',
    'Pasang API key di Pengaturan AI, atau pilih project yang mengaktifkan AI.');
  execute routine;
end
$rename_project_messages$;
