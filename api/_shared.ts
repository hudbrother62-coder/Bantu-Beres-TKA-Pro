import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
export type Request = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body: Record<string, unknown>;
};
export type Response = {
  status: (code: number) => Response;
  json: (body: unknown) => void;
  setHeader: (key: string, value: string) => void;
};
export async function authorized(req: Request) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Database belum terhubung.");
  const token = String(req.headers.authorization || "").replace(/^Bearer /, "");
  if (!token) throw new Error("Silakan masuk terlebih dahulu.");
  const db = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user)
    throw new Error("Sesi berakhir. Silakan masuk kembali.");
  return db;
}
function key() {
  const v = process.env.AI_ENCRYPTION_KEY;
  if (!v || !/^[a-f0-9]{64}$/i.test(v))
    throw new Error("Konfigurasi keamanan AI belum tersedia.");
  return Buffer.from(v, "hex");
}
export function encrypt(text: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), iv),
    data = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return [
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    data.toString("base64"),
  ].join(".");
}
export function decrypt(text: string) {
  const [iv, tag, data] = text.split(".");
  const cipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(iv, "base64"),
  );
  cipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    cipher.update(Buffer.from(data, "base64")),
    cipher.final(),
  ]).toString("utf8");
}
export async function action(
  db: Awaited<ReturnType<typeof authorized>>,
  name: string,
  payload: Record<string, unknown> = {},
) {
  const { data, error } = await db.rpc("tka_action", { action: name, payload });
  if (error) throw new Error(error.message);
  return data;
}
export function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : "Layanan mengalami kendala.";
}
export async function gemini(key: string, model: string, body: unknown) {
  if (!/^gemini-[a-zA-Z0-9.-]{1,80}$/.test(model))
    throw new Error("Nama model Gemini tidak valid.");
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(55000),
    },
  );
  const result = await r.json();
  if (!r.ok)
    throw new Error(
      r.status === 429
        ? "Kuota layanan AI habis. Periksa kuota dan tagihan di Google AI Studio."
        : r.status === 400 || r.status === 403
          ? "API key atau izin model tidak valid. Periksa Pengaturan AI."
          : r.status === 404
            ? "Model tidak tersedia untuk key ini. Pilih model lain di Pengaturan AI."
            : "Layanan AI sedang mengalami kendala. Coba kembali.",
    );
  const text = result.candidates?.[0]?.content?.parts
    ?.filter((p: { thought?: boolean }) => !p.thought)
    .map((p: { text?: string }) => p.text || "")
    .join("");
  if (!text)
    throw new Error("AI tidak menghasilkan jawaban. Coba ubah permintaan.");
  return text as string;
}

export async function aiConfig(db: Awaited<ReturnType<typeof authorized>>,payload: Record<string,unknown>) {
 const {data:user,error:authError}=await db.auth.getUser();
 if(authError||!user.user) throw new Error('Sesi berakhir.');
 const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!secret) throw new Error('Konfigurasi server AI belum tersedia.');
 const admin=createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,secret,{auth:{persistSession:false}});
 const {data,error}=await admin.rpc('tka_ai_config',{actor:user.user.id,payload});
 if(error) throw new Error(error.message);return data;
}
