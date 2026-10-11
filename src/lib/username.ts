/** Internal Supabase Auth identifier. Customers use a username only. */
export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}
export function usernameEmail(username: string): string {
  const value = normalizeUsername(username);
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(value)) {
    throw new Error("Username harus 3–32 karakter, menggunakan huruf, angka, titik, _ atau -.");
  }
  return value + "@users.tka-pro.invalid";
}
export type Registration = {
  username: string;
  password: string;
  name: string;
  grade: string;
  subject: string;
  role: string;
  school: string;
};
export async function createUsernameAccount(registration: Registration) {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Database belum terhubung.");
  const response = await fetch(url + "/functions/v1/username-signup", {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": key },
    body: JSON.stringify({
      ...registration,
      username: normalizeUsername(registration.username),
    }),
    signal: AbortSignal.timeout(20000),
  });
  const result = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(result.error || "Gagal mendaftarkan akun.");
}
