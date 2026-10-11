import { createClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL,
  key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const configured = Boolean(url && key);
export const db = configured ? createClient(url, key) : null;
export async function withTimeout<T>(request: PromiseLike<T>, ms = 20000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(request),
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Server terlalu lama merespons. Periksa internet dan coba lagi.")),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
export async function checked<T>(
  request: PromiseLike<{ data: T; error: { message: string } | null }>,
): Promise<T> {
  const { data, error } = await withTimeout(request);
  if (error) throw new Error(error.message);
  return data;
}
export async function rpc<T = unknown>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  if (!db) throw new Error("Database belum terhubung.");
  return checked(db.rpc(name, args)) as Promise<T>;
}
export async function api(path: string, body: unknown) {
  if (!db) throw new Error("Database belum terhubung.");
  const { data } = await withTimeout(db.auth.getSession(), 15000);
  const r = await fetch("/api/" + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session?.access_token || ""}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(65000),
  });
  const result = await r.json().catch(() => {
    throw new Error("Respons server tidak valid. Coba lagi sesaat.");
  });
  if (!r.ok) throw new Error(result.error || "Layanan belum tersedia.");
  return result;
}
export type Profile = {
  id: string;
  name: string;
  role: "teacher" | "student";
  grade: string;
  subject: string;
  school: string;
};
export type ClassRow = {
  id: string;
  owner_id: string;
  name: string;
  subject: string;
  invite_code: string;
  ai_enabled: boolean;
  ai_daily_limit: number;
};
export type PackageRow = {
  id: string;
  owner_id: string;
  class_id: string | null;
  title: string;
  subject: string;
  duration: number;
  published: boolean;
  release_results: boolean;
  questions: PublicQuestion[];
  created_at: string;
  starts_at: string | null;
  ends_at: string | null;
};
export type PublicQuestion = {
  id: string;
  question: string;
  options: string[];
  topic: string;
  level: string;
};
export type Attempt = {
  id: string;
  student_id: string;
  package_id: string;
  started_at: string;
  submitted_at: string | null;
  answers: Record<string, number>;
  score: number | null;
  correct: number | null;
  student_name?: string;
  package_title?: string;
  questions?: Record<string, unknown>[];
};
