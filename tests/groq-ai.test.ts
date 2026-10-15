import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

test("Groq configuration follows project membership and never requires an admin key in browser", async () => {
 const pg = new PGlite();
 await pg.exec(`create role service_role;create role anon;create role authenticated;
 create schema auth;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql as $$
   select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
 await pg.exec(readFileSync(new URL("../supabase/schema.sql", import.meta.url),"utf8"));
 await pg.exec(readFileSync(new URL("../supabase/migrations/20261015_gemini_ai_context.sql", import.meta.url),"utf8"));
 const teacher = "11111111-1111-4111-8111-111111111111";
 const student = "22222222-2222-4222-8222-222222222222";
 const outsider = "33333333-3333-4333-8333-333333333333";
 for(const [id,role] of [[teacher,"teacher"],[student,"student"],[outsider,"student"]])
  await pg.query("insert into auth.users values($1,$2)",[id,JSON.stringify({name:role,role})]);
 await pg.exec("grant usage on schema auth to authenticated;set role authenticated;");
 const as = async (id:string) => { await pg.query("select set_config('request.jwt.claim.sub',$1,false)",[id]); };
 const act = async (name:string,payload:object={}) =>
  (await pg.query<{value:any}>("select public.tka_action($1,$2) value",[name,JSON.stringify(payload)])).rows[0].value;
 const context = async (id:string|null=null) =>
  (await pg.query<{value:any}>("select public.tka_ai_context($1::jsonb) value",[JSON.stringify({class_id:id})])).rows[0].value;
 await as(teacher);
 await act("save_ai",{encrypted_key:"encrypted-test-placeholder-not-a-real-key",model:"groq:openai/gpt-oss-20b",direction:"clear"});
 const own = await context();
 assert.equal(own.encrypted_key,"encrypted-test-placeholder-not-a-real-key");
 const project = await act("create_class",{name:"TKA project",subject:"Matematika"});
 await as(student);
 await assert.rejects(context());
 await assert.rejects(context(project.id));
 await act("join_class",{code:project.invite_code});
 await assert.rejects(context(project.id));
 await as(teacher);
 await act("class_settings",{id:project.id,ai_enabled:true,ai_daily_limit:10});
 await as(student);
 assert.equal((await context(project.id)).model,"groq:openai/gpt-oss-20b");
 await as(outsider);
 await assert.rejects(context(project.id));
 await pg.close();
});
