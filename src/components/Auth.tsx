import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  GraduationCap,
  BookOpen,
  Eye,
  EyeOff,
} from "lucide-react";
import { db, configured, rpc } from "../lib/db";
import { Field } from "./ui";
import { SubjectPicker, TeacherSubjects } from "./SubjectPicker";
import { normalizeSubjectList } from "../lib/subjects";
import { createUsernameAccount, normalizeUsername, usernameEmail } from "../lib/username";
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
      const username = normalizeUsername(String(f.get("username") || "")),
        password = String(f.get("password"));
      if (mode === "signup") {
        if (password !== f.get("confirm"))
          throw new Error("Konfirmasi kata sandi belum cocok.");
        const teacherSubjects = role === "teacher"
          ? normalizeSubjectList(JSON.parse(String(f.get("subjects") || "[]")))
          : [];
        if (role === "teacher" && !teacherSubjects.length)
          throw new Error("Tambahkan minimal satu mata pelajaran yang Anda ampu.");
        await createUsernameAccount({
          username, password,
          name: String(f.get("name") || ""),
          role,
          grade: String(f.get("grade") || ""),
          subject: role === "teacher" ? teacherSubjects[0] : String(f.get("subject") || ""),
          school: String(f.get("school") || ""),
        });
        const { error } = await db.auth.signInWithPassword({
          email: usernameEmail(username), password,
        });
        if (error) {
          setMode("login");
          setMessage("Akun dibuat. Silakan masuk menggunakan username dan kata sandi.");
        } else if (role === "teacher") {
          try {
            await rpc("tka_subjects", { subject_items: teacherSubjects });
            window.dispatchEvent(new Event("tka-profile-updated"));
          } catch {
            setMessage("Akun aktif. Tambahkan kembali mata pelajaran melalui Pengaturan.");
          }
        }
      } else {
        const { error } = await db.auth.signInWithPassword({
          email: usernameEmail(username), password,
        });
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
              <Field label={role === "teacher" ? "Jenjang / kelas yang diampu" : "Jenjang / kelas"}>
                <input name="grade" defaultValue="XII" required
                  placeholder="Contoh: XII SMA / XI SMK" />
              </Field>
              {role === "teacher" ? (
                <Field label="Mata pelajaran yang diajarkan">
                  <TeacherSubjects />
                </Field>
              ) : (
                <Field label="Mata pelajaran yang ingin dipelajari">
                  <SubjectPicker name="subject" defaultValue="Matematika" />
                </Field>
              )}
              <Field label="Sekolah / lembaga (opsional)">
                <input name="school" placeholder="Boleh diisi nanti" />
              </Field>
            </>
          )}
          <Field label="Username">
            <input
              name="username"
              type="text"
              required
              autoComplete="username"
              minLength={3}
              maxLength={32}
              pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,31}"
              placeholder="Contoh: gurutka01"
              title="3–32 karakter; huruf, angka, titik, garis bawah, atau tanda hubung"
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
        <p className="muted center">Tidak perlu email atau verifikasi. Simpan username dan kata sandi Anda dengan aman.</p>
      </section>
      <p className="muted center">
        Bahan latihan internal, bukan soal atau nilai resmi TKA.
      </p>
    </div>
  );
}
