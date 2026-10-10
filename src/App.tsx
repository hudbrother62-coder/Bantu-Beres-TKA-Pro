import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  ArrowRight,
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  MessageSquare,
  Library,
  Users,
  BarChart3,
  Settings,
  HelpCircle,
  Sun,
  Moon,
  LogOut,
  Check,
  ClipboardList,
  Menu,
  X,
} from "lucide-react";
import {
  db,
  rpc,
  type Profile,
  type PackageRow,
  type Attempt,
  type ClassRow,
} from "./lib/db";
import Auth from "./components/Auth";
import { NoticeContext, Busy, ErrorBox, Field, useData } from "./components/ui";
import { Assistant } from "./components/Assistant";
import { Bank, Materials } from "./components/Content";
import { Classes, Packages, Results } from "./components/Classroom";
import { SettingsPage, Guide } from "./components/Settings";
type Page =
  | "home"
  | "ai"
  | "content"
  | "classes"
  | "results"
  | "packages"
  | "settings"
  | "guide";
export default function App() {
  const [session, setSession] = useState<Session | null>(null),
    [initializing, setInitializing] = useState(Boolean(db)),
    [profile, setProfile] = useState<Profile | null>(null),
    [profileError, setProfileError] = useState(""),
    [auth, setAuth] = useState<"login" | "signup" | null>(null),
    [page, setPage] = useState<Page>("home"),
    [dark, setDark] = useState(
      () => localStorage.getItem("tka-theme") === "dark",
    ),
    [toast, setToast] = useState<{ text: string; error: boolean } | null>(null),
    [mobileMenu, setMobileMenu] = useState(false),
    [reset, setReset] = useState(location.search.includes("reset=1"));
  function notice(text: string, error = false) {
    setToast({ text, error });
  }
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 6500);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("tka-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    if (!db) return;
    db.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setInitializing(false);
    });
    const { data } = db.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setInitializing(false);
      if (event === "PASSWORD_RECOVERY") setReset(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  async function loadProfile() {
    if (!session) return;
    try {
      setProfile(await rpc<Profile>("tka_action", { action: "profile" }));
      setProfileError("");
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : "Profil gagal dimuat.");
    }
  }
  useEffect(() => {
    setProfile(null);
    void loadProfile();
  }, [session?.user.id]);
  const teacher = profile?.role === "teacher";
  const nav: { id: Page; label: string; icon: typeof BookOpen }[] = [
    { id: "home", label: "Beranda", icon: LayoutDashboard },
    {
      id: "ai",
      label: teacher ? "Asisten AI" : "Belajar AI",
      icon: MessageSquare,
    },
    {
      id: "content",
      label: teacher ? "Materi & Soal" : "Materi",
      icon: Library,
    },
    {
      id: "packages",
      label: teacher ? "Paket Tryout" : "Latihan",
      icon: ClipboardList,
    },
    { id: "classes", label: teacher ? "Kelas" : "Kelasku", icon: Users },
    {
      id: "results",
      label: teacher ? "Hasil & Laporan" : "Progres",
      icon: BarChart3,
    },
  ];
  function navigate(id: Page) {
    setPage(id);
    setMobileMenu(false);
  }
  if (initializing) return <Busy />;
  return (
    <NoticeContext.Provider value={notice}>
      <datalist id="subjects">
        {[
          "Matematika",
          "Bahasa Indonesia",
          "Bahasa Inggris",
          "Fisika",
          "Kimia",
          "Biologi",
          "Ekonomi",
          "Sejarah",
          "Sosiologi",
          "Geografi",
        ].map((s) => (
          <option key={s}>{s}</option>
        ))}
      </datalist>
      {session && reset ? (
        <div className="auth-page">
          <section className="auth-card">
            <h1>Atur kata sandi baru</h1>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const password = String(
                  new FormData(e.currentTarget).get("password"),
                );
                const { error } = await db!.auth.updateUser({ password });
                if (error) notice(error.message, true);
                else {
                  setReset(false);
                  history.replaceState({}, "", location.pathname);
                  notice("Kata sandi diperbarui.");
                }
              }}
            >
              <Field label="Kata sandi baru">
                <input type="password" name="password" required minLength={8} />
              </Field>
              <button className="primary">Simpan kata sandi</button>
            </form>
          </section>
        </div>
      ) : !session ? (
        auth ? (
          <Auth initial={auth} onBack={() => setAuth(null)} />
        ) : (
          <Landing onAuth={setAuth} dark={dark} toggle={() => setDark(!dark)} />
        )
      ) : !profile ? (
        <div className="profile-loading">
          <Busy />
          <ErrorBox error={profileError} retry={loadProfile} />
          <button onClick={() => db?.auth.signOut()}>Keluar</button>
        </div>
      ) : (
        <div className="app-shell">
          <aside className={"sidebar " + (mobileMenu ? "open" : "")}>
            <a
              className="brand"
              href="#"
              onClick={(e) => {
                e.preventDefault();
                navigate("home");
              }}
            >
              <img src="/logo.png" alt="Bantu Beres" />
              <span>
                Bantu Beres<b>TKA Pro</b>
              </span>
            </a>
            <div className="workspace-tag">
              {teacher ? "RUANG KERJA GURU" : "RUANG BELAJAR SISWA"}
            </div>
            <nav>
              {nav.map((n) => (
                <button
                  key={n.id}
                  className={page === n.id ? "active" : ""}
                  onClick={() => navigate(n.id)}
                >
                  <n.icon size={20} />
                  {n.label}
                </button>
              ))}
            </nav>
            <div className="sidebar-bottom">
              <button onClick={() => navigate("guide")}>
                <HelpCircle size={19} />
                Panduan penggunaan
              </button>
              <button onClick={() => navigate("settings")}>
                <Settings size={19} />
                Pengaturan
              </button>
              <div className="account">
                <span className="avatar">{profile.name.slice(0, 1)}</span>
                <div>
                  <b>{profile.name}</b>
                  <small>
                    {teacher ? "Guru" : "Siswa"} · {profile.grade}
                  </small>
                </div>
                <button aria-label="Keluar" onClick={() => db?.auth.signOut()}>
                  <LogOut size={18} />
                </button>
              </div>
            </div>
          </aside>
          {mobileMenu && (
            <div
              className="sidebar-scrim"
              onClick={() => setMobileMenu(false)}
            />
          )}
          <main className="workspace">
            <header className="topbar">
              <button
                className="mobile-only icon"
                aria-label="Buka menu"
                onClick={() => setMobileMenu(!mobileMenu)}
              >
                {mobileMenu ? <X /> : <Menu />}
              </button>
              <div>
                <span className="breadcrumb">TKA Pro / </span>
                <b>
                  {nav.find((n) => n.id === page)?.label ||
                    (page === "settings" ? "Pengaturan" : "Panduan")}
                </b>
              </div>
              <div className="top-actions">
                <span className="subject-pill">{profile.subject}</span>
                <button
                  className="icon"
                  aria-label="Ganti mode warna"
                  onClick={() => setDark(!dark)}
                >
                  {dark ? <Sun size={20} /> : <Moon size={20} />}
                </button>
                <button
                  className="icon"
                  aria-label="Pengaturan"
                  onClick={() => navigate("settings")}
                >
                  <Settings size={20} />
                </button>
              </div>
            </header>
            <div
              className={"page-content " + (page === "ai" ? "chat-page" : "")}
              key={page}
            >
              {page === "home" ? (
                <Dashboard profile={profile} navigate={navigate} />
              ) : page === "ai" ? (
                <Assistant profile={profile} />
              ) : page === "content" ? (
                <ContentPage profile={profile} />
              ) : page === "classes" ? (
                <Classes profile={profile} />
              ) : page === "packages" ? (
                <Packages profile={profile} />
              ) : page === "results" ? (
                <Results profile={profile} />
              ) : page === "settings" ? (
                <SettingsPage profile={profile} onProfile={setProfile} />
              ) : (
                <Guide profile={profile} />
              )}
            </div>
          </main>
          <nav className="bottom-nav">
            {nav
              .filter((n) =>
                ["home", "ai", "packages", "classes", "results"].includes(n.id),
              )
              .map((n) => (
                <button
                  key={n.id}
                  className={page === n.id ? "active" : ""}
                  onClick={() => navigate(n.id)}
                >
                  <n.icon size={21} />
                  <span>
                    {n.id === "packages"
                      ? "Latihan"
                      : n.id === "results"
                        ? "Hasil"
                        : n.id === "ai"
                          ? "AI"
                          : n.label}
                  </span>
                </button>
              ))}
          </nav>
        </div>
      )}
      {toast && (
        <div className={"toast " + (toast.error ? "error" : "")} role="status">
          {toast.text}
          <button
            className="icon"
            onClick={() => setToast(null)}
            aria-label="Tutup pesan"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </NoticeContext.Provider>
  );
}
function ContentPage({ profile }: { profile: Profile }) {
  const [tab, setTab] = useState("materials");
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">PUSTAKA PEMBELAJARAN</span>
          <h1>
            {profile.role === "teacher"
              ? "Materi & bank soal"
              : "Materi belajarmu"}
          </h1>
          <p>Semua bahan belajar tersimpan dalam satu tempat.</p>
        </div>
      </div>
      {profile.role === "teacher" && (
        <div className="tabs compact">
          <button
            className={tab === "materials" ? "active" : ""}
            onClick={() => setTab("materials")}
          >
            Bahan ajar
          </button>
          <button
            className={tab === "questions" ? "active" : ""}
            onClick={() => setTab("questions")}
          >
            Bank soal
          </button>
        </div>
      )}
      {tab === "questions" ? (
        <Bank profile={profile} />
      ) : (
        <Materials profile={profile} />
      )}
    </>
  );
}
function Dashboard({
  profile,
  navigate,
}: {
  profile: Profile;
  navigate: (p: Page) => void;
}) {
  const cls = useData<ClassRow>("classes"),
    pkg = useData<PackageRow>("packages"),
    results = useData<Attempt>("results");
  const teacher = profile.role === "teacher";
  const finished = results.data.filter((a) => a.submitted_at),
    scored = finished.filter((a) => a.score !== null && a.score !== undefined);
  const avg = scored.length
    ? Math.round(
        scored.reduce((a, b) => a + Number(b.score), 0) / scored.length,
      )
    : null;
  return (
    <>
      <section className="welcome">
        <div>
          <span className="eyebrow">
            {teacher ? "MENGAJAR LEBIH TERARAH" : "SATU LANGKAH LEBIH PAHAM"}
          </span>
          <h1>Halo, {profile.name.split(" ")[0]}.</h1>
          <p>
            {teacher
              ? "Siapkan pembelajaran, lihat hasilnya, dan bantu setiap siswa berkembang."
              : "Lanjutkan belajarmu. Mulai dari satu konsep, satu latihan, satu kemajuan."}
          </p>
          <button className="primary" onClick={() => navigate("ai")}>
            {teacher ? "Mulai dengan Asisten AI" : "Mulai belajar"}
            <ArrowRight size={18} />
          </button>
        </div>
        <div className="welcome-mark">
          <GraduationCap size={72} />
          <span>{profile.grade}</span>
          <small>{profile.subject}</small>
        </div>
      </section>
      <div className="stats-grid">
        {[
          {
            label: teacher ? "Kelas dikelola" : "Kelas diikuti",
            value: cls.data.length,
            icon: Users,
          },
          {
            label: "Paket latihan",
            value: pkg.data.length,
            icon: ClipboardList,
          },
          {
            label: teacher ? "Pengumpulan jawaban" : "Latihan selesai",
            value: finished.length,
            icon: Check,
          },
          { label: "Rata-rata nilai", value: avg ?? "—", icon: BarChart3 },
        ].map((s) => (
          <div className="stat" key={s.label}>
            <s.icon size={20} />
            <strong>{s.value}</strong>
            <span>{s.label}</span>
          </div>
        ))}
      </div>
      <div className="section-heading">
        <h2>
          {teacher
            ? "Apa yang ingin Anda kerjakan?"
            : "Pilih langkah berikutnya"}
        </h2>
      </div>
      <div className="action-grid">
        {[
          {
            title: teacher ? "Siapkan bahan ajar" : "Pahami materi",
            text: teacher
              ? "Draf materi, contoh, dan aktivitas pembelajaran."
              : "Penjelasan sederhana, contoh, dan petunjuk bertahap.",
            page: "ai" as Page,
            icon: BookOpen,
          },
          {
            title: teacher ? "Susun latihan & tryout" : "Kerjakan latihan",
            text: teacher
              ? "Paket dari soal yang sudah Anda telaah."
              : "Tugas kelas dan latihan untuk menguji pemahaman.",
            page: "packages" as Page,
            icon: ClipboardList,
          },
          {
            title: teacher
              ? "Lihat perkembangan kelas"
              : "Lihat perkembanganmu",
            text: teacher
              ? "Temukan topik lemah dan tentukan tindak lanjut."
              : "Kenali kekuatan dan materi yang perlu dilatih.",
            page: "results" as Page,
            icon: BarChart3,
          },
        ].map((a) => (
          <button
            className="action-card"
            key={a.title}
            onClick={() => navigate(a.page)}
          >
            <a.icon />
            <h3>{a.title}</h3>
            <p>{a.text}</p>
            <ArrowRight size={18} />
          </button>
        ))}
      </div>
      <section className="panel">
        <div className="section-heading">
          <h2>{teacher ? "Paket terbaru" : "Latihan dari kelas"}</h2>
          <button className="link" onClick={() => navigate("packages")}>
            Lihat semua
          </button>
        </div>
        {pkg.loading ? (
          <Busy />
        ) : pkg.data.length ? (
          pkg.data.slice(0, 4).map((p) => (
            <button
              className="list-row"
              key={p.id}
              onClick={() => navigate("packages")}
            >
              <span className="square-icon">
                <ClipboardList size={20} />
              </span>
              <div>
                <b>{p.title}</b>
                <small>
                  {p.questions.length} soal · {p.duration} menit
                </small>
              </div>
              <span className="badge">{p.published ? "Terbit" : "Draf"}</span>
              <ArrowRight size={18} />
            </button>
          ))
        ) : (
          <p className="muted">
            {teacher
              ? "Paket pertama akan muncul setelah Anda menyusunnya."
              : "Bergabung ke kelas untuk menerima latihan dari guru."}
          </p>
        )}
        <ErrorBox error={pkg.error} retry={pkg.refresh} />
      </section>
      <div className="guide-strip">
        <HelpCircle />
        <div>
          <b>Baru pertama kali menggunakan?</b>
          <p>Ikuti panduan sesuai peranmu, termasuk pemasangan AI.</p>
        </div>
        <button onClick={() => navigate("guide")}>Buka panduan</button>
      </div>
    </>
  );
}
function Landing({
  onAuth,
  dark,
  toggle,
}: {
  onAuth: (mode: "login" | "signup") => void;
  dark: boolean;
  toggle: () => void;
}) {
  return (
    <div className="landing">
      <header className="landing-nav">
        <a className="brand" href="#">
          <img src="/logo.png" alt="Bantu Beres" />
          <span>
            Bantu Beres<b>TKA Pro</b>
          </span>
        </a>
        <div>
          <button
            className="icon"
            aria-label="Ganti mode warna"
            onClick={toggle}
          >
            {dark ? <Sun /> : <Moon />}
          </button>
          <button onClick={() => onAuth("login")}>Masuk</button>
          <button className="primary" onClick={() => onAuth("signup")}>
            Daftar
          </button>
        </div>
      </header>
      <section className="hero">
        <div>
          <span className="eyebrow">UNTUK GURU. UNTUK SISWA.</span>
          <h1>
            Persiapan lebih rapi.
            <br />
            <em>Belajar lebih terarah.</em>
          </h1>
          <p>
            Satu ruang untuk menyiapkan materi, berlatih, dan memahami
            perkembangan belajar. Dengan asisten AI yang mengikuti kebutuhanmu.
          </p>
          <div className="hero-actions">
            <button className="primary" onClick={() => onAuth("signup")}>
              Mulai sekarang
              <ArrowRight size={19} />
            </button>
            <button
              onClick={() =>
                document
                  .getElementById("roles")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Kenali fiturnya
            </button>
          </div>
          <div className="hero-notes">
            <span>
              <Check size={16} />
              Guru & siswa
            </span>
            <span>
              <Check size={16} />
              API key sendiri
            </span>
            <span>
              <Check size={16} />
              Nyaman di HP
            </span>
          </div>
        </div>
        <div className="hero-preview">
          <div className="preview-top">
            <span className="dot" />
            RUANG BELAJAR TKA PRO<span className="badge">Siswa</span>
          </div>
          <h3>Hari ini, pahami satu hal baru.</h3>
          <div className="sample-user">Aku belum paham persamaan kuadrat.</div>
          <div className="sample-ai">
            <span className="square-icon">
              <BookOpen size={19} />
            </span>
            <div>
              <b>Kita mulai dari konsepnya.</b>
              <p>
                Persamaan kuadrat memiliki pangkat tertinggi dua. Contohnya:
              </p>
              <div className="math-sample">x² − 5x + 6 = 0</div>
              <p>Dua bilangan apa yang jumlahnya 5 dan hasil kalinya 6?</p>
            </div>
          </div>
          <div className="preview-progress">
            <span>Langkah belajar</span>
            <b>Konsep → Contoh → Latihan</b>
          </div>
        </div>
      </section>
      <section className="landing-roles" id="roles">
        <span className="eyebrow">SATU APLIKASI, DUA KEBUTUHAN</span>
        <h2>Ruang yang mengikuti peranmu.</h2>
        <div className="role-grid">
          <article>
            <BookOpen />
            <h3>Saya Guru</h3>
            <p>
              Siapkan bahan ajar, telaah soal, susun tryout, dan lihat hasil
              kelas untuk menentukan tindak lanjut.
            </p>
            <ul>
              <li>Bahan ajar & bank soal</li>
              <li>Kelas, latihan & tryout</li>
              <li>Analisis & laporan</li>
            </ul>
            <button className="primary" onClick={() => onAuth("signup")}>
              Buka ruang guru
              <ArrowRight size={17} />
            </button>
          </article>
          <article>
            <GraduationCap />
            <h3>Saya Siswa</h3>
            <p>
              Belajar dengan petunjuk bertahap, kerjakan tugas kelas, dan
              temukan materi yang perlu dilatih.
            </p>
            <ul>
              <li>Chatbot pendamping belajar</li>
              <li>Latihan mandiri & tugas kelas</li>
              <li>Pembahasan & progres pribadi</li>
            </ul>
            <button className="primary" onClick={() => onAuth("signup")}>
              Buka ruang siswa
              <ArrowRight size={17} />
            </button>
          </article>
        </div>
      </section>
      <section className="landing-end">
        <h2>Dari materi sampai tindak lanjut.</h2>
        <p>
          Guru menyiapkan. Siswa berlatih. Hasilnya menjadi arah pembelajaran
          berikutnya.
        </p>
        <button className="primary" onClick={() => onAuth("signup")}>
          Buat akun
          <ArrowRight size={18} />
        </button>
      </section>
      <footer>
        <span>© {new Date().getFullYear()} Bantu Beres TKA Pro</span>
        <p>Latihan internal. Bukan penerbit atau prediksi soal resmi TKA.</p>
      </footer>
    </div>
  );
}
