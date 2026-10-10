import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  GraduationCap,
  BookOpen,
  Eye,
  EyeOff,
} from "lucide-react";
import { db, configured } from "../lib/db";
import { Field } from "./ui";
export default function Auth({
  initial,
  onBack,
}: {
  initial: "login" | "signup";
  onBack: () => void;
}) {
  const [mode, setMode] = useState(initial),
    [role, setRole] = useState("teacher"),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!db) {
      setError(
        "Database belum terhubung. Pendaftaran dan login akan aktif setelah pemasangan Supabase selesai.",
      );
      return;
    }
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const email = String(f.get("email")).trim(),
        password = String(f.get("password"));
      if (mode === "signup") {
        if (password !== f.get("confirm"))
          throw new Error("Konfirmasi kata sandi belum cocok.");
        const { data, error } = await db.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: location.origin,
            data: {
              name: f.get("name"),
              role,
              grade: f.get("grade"),
              school: f.get("school"),
              subject: f.get("subject"),
            },
          },
        });
        if (error) throw error;
        if (!data.session)
          setMessage(
            "Akun dibuat. Periksa email untuk mengaktifkan akun, kemudian masuk.",
          );
      } else {
        const { error } = await db.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tidak berhasil masuk.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <button className="back" onClick={onBack}>
        <ArrowLeft size={18} /> Kembali
      </button>
      <div className="auth-brand">
        <img src="/logo.png" alt="Bantu Beres" />
        <span>
          Bantu Beres <b>TKA Pro</b>
        </span>
      </div>
      <section className="auth-card">
        <div className="eyebrow">RUANG BELAJAR ANDA</div>
        <h1>
          {mode === "login"
            ? "Selamat datang kembali."
            : "Mulai langkah belajar baru."}
        </h1>
        <p>
          {mode === "login"
            ? "Masuk untuk melanjutkan pekerjaan dan belajarmu."
            : "Pilih peran, lalu buat akun pribadi Anda."}
        </p>
        <div className="tabs">
          <button
            className={mode === "login" ? "active" : ""}
            onClick={() => {
              setMode("login");
              setError("");
            }}
          >
            Masuk
          </button>
          <button
            className={mode === "signup" ? "active" : ""}
            onClick={() => {
              setMode("signup");
              setError("");
            }}
          >
            Daftar
          </button>
        </div>
        {!configured && (
          <div className="alert">
            Pemasangan database sedang disiapkan. Formulir tersedia; akun belum
            dapat dibuat.
          </div>
        )}
        <form onSubmit={submit}>
          {mode === "signup" && (
            <>
              <div className="role-pick">
                <button
                  type="button"
                  className={role === "teacher" ? "selected" : ""}
                  onClick={() => setRole("teacher")}
                >
                  <BookOpen /> Saya Guru
                  <small>Siapkan materi & kelola kelas</small>
                </button>
                <button
                  type="button"
                  className={role === "student" ? "selected" : ""}
                  onClick={() => setRole("student")}
                >
                  <GraduationCap /> Saya Siswa
                  <small>Belajar & kerjakan latihan</small>
                </button>
              </div>
              <Field label="Nama lengkap">
                <input name="name" required autoComplete="name" />
              </Field>
              <div className="form-grid">
                <Field label="Jenjang / kelas">
                  <input
                    name="grade"
                    defaultValue="XII"
                    required
                    placeholder="Contoh: XII SMA"
                  />
                </Field>
                <Field label="Mata pelajaran">
                  <input
                    name="subject"
                    defaultValue="Matematika"
                    required
                    list="subjects"
                  />
                </Field>
              </div>
              <Field label="Sekolah / lembaga (opsional)">
                <input name="school" placeholder="Boleh diisi nanti" />
              </Field>
            </>
          )}
          <Field label="Email">
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="nama@email.com"
            />
          </Field>
          <Field label="Kata sandi">
            <div className="password">
              <input
                name="password"
                type={show ? "text" : "password"}
                required
                minLength={8}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                placeholder="Minimal 8 karakter"
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                aria-label="Tampilkan kata sandi"
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </Field>
          {mode === "signup" && (
            <Field label="Ulangi kata sandi">
              <input
                name="confirm"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </Field>
          )}
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          {message && <div className="alert success">{message}</div>}
          <button className="primary wide" disabled={busy}>
            {busy ? "Memproses…" : mode === "login" ? "Masuk" : "Buat akun"}
            <ArrowRight size={18} />
          </button>
        </form>
        {mode === "login" && (
          <button
            className="link"
            onClick={async () => {
              const email = prompt("Email akun yang akan dipulihkan:");
              if (email && db) {
                const { error } = await db.auth.resetPasswordForEmail(email, {
                  redirectTo: location.origin + "/?reset=1",
                });
                error
                  ? setError(error.message)
                  : setMessage(
                      "Jika akun tersedia, tautan pemulihan dikirim ke email.",
                    );
              }
            }}
          >
            Lupa kata sandi?
          </button>
        )}
      </section>
      <p className="muted center">
        Bahan latihan internal, bukan soal atau nilai resmi TKA.
      </p>
    </div>
  );
}
