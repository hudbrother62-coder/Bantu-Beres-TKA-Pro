import { useEffect, useState } from "react";
import {
  KeyRound,
  ShieldCheck,
  ExternalLink,
  BookOpen,
  GraduationCap,
} from "lucide-react";
import { api, rpc, type Profile } from "../lib/db";
import { Field, ErrorBox, useWork, useNotice } from "./ui";
import { SubjectPicker, TeacherSubjects } from "./SubjectPicker";
import { normalizeSubjectList, profileSubjects } from "../lib/subjects";
import { GROQ_MODELS, GROQ_DEFAULT_MODEL, modelFromStoredModel } from "../lib/ai-providers";
export function SettingsPage({
  profile,
  onProfile,
}: {
  profile: Profile;
  onProfile: (p: Profile) => void;
}) {
  const [installed, setInstalled] = useState(false),
    [model, setModel] = useState<string>(GROQ_DEFAULT_MODEL),
    [direction, setDirection] = useState(
      "Jelas, terstruktur, dan sesuai jenjang siswa.",
    ),
    [apiKey, setApiKey] = useState(""),
    [modelLoading, setModelLoading] = useState(false),
    [modelNotice, setModelNotice] = useState(""),
    [connectError, setConnectError] = useState(""),
    [error, setError] = useState("");
  const { busy, run } = useWork(),
    notice = useNotice();
  useEffect(() => {
    rpc<{ installed: boolean; model: string; direction: string }>(
      "tka_action",
      { action: "ai_status" },
    )
      .then((s) => {
        const configured = s.installed && s.model.startsWith("groq:");
        setInstalled(configured);
        if (configured) {
          try {
            setModel(modelFromStoredModel(s.model));
          } catch {
            setModel(GROQ_DEFAULT_MODEL);
            setInstalled(false);
          }
        } else if (s.installed) {
          setModelNotice("Pengaturan AI lama tidak digunakan lagi. Pasang API key GroqCloud untuk mengaktifkan AI.");
        }
        setDirection(s.direction);
      })
      .catch((e) => setError(e.message));
  }, []);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">SESUAIKAN RUANG ANDA</span>
          <h1>Pengaturan</h1>
          <p>Profil, koneksi AI, dan arah jawaban.</p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="panel">
          <h2>Profil akun</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(async () => {
                const items = profile.role === "teacher"
                  ? normalizeSubjectList(JSON.parse(String(f.get("subjects") || "[]")))
                  : [];
                if (profile.role === "teacher" && !items.length)
                  throw new Error("Minimal satu mata pelajaran harus dipilih.");
                await rpc<Profile>("tka_action", {
                  action: "profile",
                  payload: Object.fromEntries(f),
                });
                if (profile.role === "teacher") {
                  await rpc("tka_subjects", { subject_items: items });
                }
                const updated = await rpc<Profile>("tka_action", { action: "profile" });
                onProfile(updated);
                notice("Profil dan mata pelajaran berhasil diperbarui.");
              });
            }}
          >
            <Field label="Nama lengkap">
              <input name="name" required defaultValue={profile.name} />
            </Field>
            <Field label="Peran">
              <input
                readOnly
                value={profile.role === "teacher" ? "Guru" : "Siswa"}
              />
            </Field>
            <Field label="Jenjang / kelas">
              <input name="grade" required defaultValue={profile.grade} />
            </Field>
            {profile.role === "teacher" ? (
              <Field label="Daftar mata pelajaran yang diampu">
                <TeacherSubjects key={profile.subjects?.join("|") || profile.subject}
                  defaultValue={profileSubjects(profile)} />
              </Field>
            ) : (
              <Field label="Mata pelajaran fokus belajar">
                <SubjectPicker name="subject" defaultValue={profile.subject} />
              </Field>
            )}
            <Field label="Sekolah / lembaga">
              <input name="school" defaultValue={profile.school} />
            </Field>
            <button className="primary" disabled={busy}>
              Simpan profil
            </button>
          </form>
          <p className="muted">
            {profile.role === "teacher"
              ? "Anda dapat menambah, mengganti, dan menghapus mapel umum atau kejuruan tanpa membuat akun lain. Mapel pertama adalah mapel utama."
              : "Jenjang dan fokus belajar dapat diperbarui. Hak akses project mengikuti undangan guru."}
          </p>
        </section>
        <section className="panel">
          <div className="section-heading">
            <h2><KeyRound size={20} /> Pengaturan Groq AI</h2>
            <span className={"badge " + (installed ? "green" : "")}>
              {installed ? "Terpasang" : "Belum terpasang"}
            </span>
          </div>
          <ErrorBox error={error} />
          <p className="muted">
            TKA Pro menggunakan GroqCloud untuk generator soal, bahan ajar, dan asisten belajar.
            Anda dapat membuat API key melalui akun GroqCloud dengan kuota gratis terbatas.
          </p>
          <div className="groq-setup-guide">
            <h3>Cara memasang API key Groq</h3>
            <ol>
              <li>Buka <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer">GroqCloud API Keys <ExternalLink size={13} /></a> lalu daftar atau login.</li>
              <li>Pada halaman API Keys pilih <strong>Create API Key</strong>.</li>
              <li>Beri nama, misalnya <strong>TKA Pro</strong>, lalu buat key baru.</li>
              <li>Salin key yang muncul (biasanya diawali <code>gsk_</code>). Simpan dengan aman, jangan kirim ke chat.</li>
              <li>Tempel key ke kolom di bawah, pilih model, kemudian klik <strong>Cari &amp; uji model otomatis</strong>.</li>
              <li>Jika uji berhasil, klik <strong>Tes koneksi &amp; simpan</strong>. Setelah itu gunakan Generator &amp; Asisten AI.</li>
            </ol>
            <a className="groq-setup-link" href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer">
              <ExternalLink size={16} /> Buka GroqCloud — Buat API Key
            </a>
          </div>
          <form onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              setConnectError("");
              try {
                const result = await api("settings", { apiKey, model, direction });
                setApiKey("");
                setInstalled(true);
                setModelNotice("Groq berhasil diuji dan disimpan. Generator AI siap digunakan.");
                notice(result.message);
              } catch (cause) {
                setConnectError(cause instanceof Error ? cause.message : "Tes koneksi Groq gagal.");
                throw cause;
              }
            });
          }}>
            <Field label={installed ? "API key GroqCloud (isi kembali untuk mengganti)" : "API key GroqCloud"}>
              <input type="password" autoComplete="new-password" value={apiKey}
                onChange={e => { setApiKey(e.target.value); setConnectError(""); }}
                required placeholder="Tempel API key Groq (gsk_...)" />
            </Field>
            <Field label="Model Groq">
              <select value={model} onChange={e => { setModel(e.target.value); setModelNotice(""); }}>
                {GROQ_MODELS.map(id => <option key={id} value={id}>{id}</option>)}
              </select>
              <div className="model-lookup-row">
                <button type="button" disabled={modelLoading || busy || apiKey.trim().length < 20}
                  onClick={async () => {
                    setModelLoading(true);
                    setConnectError("");
                    setModelNotice("");
                    try {
                      const response = await api("settings", { apiKey, autoDetect: true });
                      setModel(response.model as string);
                      setModelNotice(response.message);
                    } catch (cause) {
                      setConnectError(cause instanceof Error ? cause.message : "Tidak ada model Groq yang berhasil diuji.");
                    } finally {
                      setModelLoading(false);
                    }
                  }}>
                  {modelLoading ? "Menguji model…" : "Cari & uji model otomatis"}
                </button>
              </div>
              {modelNotice && <small className="muted" role="status">{modelNotice}</small>}
              <small className="muted">Gunakan key GroqCloud, bukan Google AI Studio. Kuota gratis memiliki batas permintaan. Model yang tersedia mendukung teks, bukan unggahan gambar/PDF.</small>
            </Field>
            {connectError && <div className="alert error" role="alert">{connectError}</div>}
            <Field label="Arah jawaban AI">
              <textarea value={direction} onChange={e => setDirection(e.target.value)}
                rows={5} maxLength={1000}
                placeholder="Contoh: Jelaskan bertahap, beri contoh nyata dan pembahasan lengkap." />
            </Field>
            <button className="primary" disabled={busy || modelLoading || !apiKey}>
              {busy ? "Menguji koneksi…" : "Tes koneksi & simpan"}
            </button>
          </form>
          <div className="security-note">
            <ShieldCheck size={18} />
            <small>Key tersimpan terenkripsi di server; tidak dimasukkan ke ekspor atau dibagikan ke siswa.</small>
          </div>
          {installed && (
            <button className="danger" disabled={busy}
              onClick={() => {
                if (confirm("Hapus API key? Generator AI pribadi dan project akan berhenti sampai dipasang kembali.")) {
                  void run(async () => {
                    await api("settings", { remove: true });
                    setInstalled(false);
                    setModelNotice("");
                    notice("API key Groq dihapus.");
                  });
                }
              }}>
              Hapus API key
            </button>
          )}
        </section>
      </div>
      <section className="panel">
        <h2>Cara AI diarahkan</h2>
        <p>
          Instruksi peran menyesuaikan kebutuhan Guru dan Siswa. Sumber unggahan
          menjadi konteks, keluaran soal diperiksa strukturnya, lalu disimpan
          sebagai draf. Guru tetap menelaah ketepatan materi dan kunci.
          Pengaturan ini tidak mengubah atau melatih ulang bobot model AI.
        </p>
        <p className="muted">
          Fitur project, soal, tryout, penilaian, dan ekspor tidak bergantung pada
          koneksi AI.
        </p>
      </section>
    </>
  );
}
export function Guide({ profile }: { profile: Profile }) {
  const teacher = profile.role === "teacher";
  const steps = teacher
    ? [
        [
          "Lengkapi profil",
          "Atur sekolah, jenjang, dan mata pelajaran di Pengaturan. Profil digunakan sebagai konteks AI dan identitas dokumen.",
        ],
        [
          "Pasang AI pribadi",
          "Buka https://console.groq.com/keys, login, pilih Create API Key, beri nama TKA Pro, lalu salin key gsk_ ke Pengaturan Groq AI. Pilih model, uji koneksi dan simpan. Jangan bagikan key ke siswa.",
        ],
        [
          "Buat project",
          "Buka Project, beri nama sesuai tujuan pembelajaran, lalu bagikan kode undangan. Anda dapat membuat beberapa project untuk rombel yang sama.",
        ],
        [
          "Siapkan bahan ajar",
          "Gunakan Asisten AI dengan mode Bahan ajar. Sertakan materi rujukan dan tujuan pembelajaran. Periksa hasil, simpan, lalu bagikan ke project.",
        ],
        [
          "Isi dan telaah bank soal",
          "Tambahkan manual, import Excel menggunakan template, atau simpan hasil AI. Periksa setiap kunci dan pembahasan, kemudian tandai Siap dipakai.",
        ],
        [
          "Susun paket",
          "Pilih project tujuan, mapel, jumlah soal, komposisi L1/L2/L3, durasi, dan jadwal. Project menentukan penerima tryout.",
        ],
        [
          "Lihat hasil dan tindak lanjut",
          "Buka Hasil & Laporan, temukan topik yang perlu dilatih. Buat latihan remedial melalui Asisten AI berdasarkan ringkasan yang telah Anda periksa. Atur pembukaan hasil pada paket.",
        ],
      ]
    : [
        [
          "Lengkapi profil",
          "Atur nama, jenjang, dan mata pelajaran agar bantuan belajar sesuai kebutuhan.",
        ],
        [
          "Gabung project",
          "Minta kode undangan guru. Buka Projectku, lalu Gabung project. Materi dan latihan akan tersedia sesuai penerbitan guru.",
        ],
        [
          "Belajar dengan AI",
          "Pasang API key pribadi atau pilih AI project yang diaktifkan guru. Minta petunjuk, contoh, dan penjelasan bertahap. Percakapan pribadi tidak dibaca guru otomatis.",
        ],
        [
          "Latihan mandiri",
          "Pilih mode Latihan mandiri di Belajar AI. Minta jumlah dan topik soal, kerjakan, lalu buka pembahasan. Hasil tersimpan sebagai catatan pribadi pada Materi.",
        ],
        [
          "Kerjakan tryout",
          "Buka Latihan. Timer berjalan sejak mulai dan tidak kembali ke awal setelah keluar. Jawaban disimpan otomatis. Saat selesai, tekan Kumpulkan dan tunggu pesan berhasil.",
        ],
        [
          "Lihat progres",
          "Buka Progres. Nilai dan pembahasan project muncul setelah guru membukanya. Gunakan topik dengan capaian rendah sebagai prioritas belajar.",
        ],
      ];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">MULAI DI SINI</span>
          <h1>Panduan {teacher ? "Guru" : "Siswa"}</h1>
          <p>Ikuti langkah pertama sampai hasil belajar tersimpan.</p>
        </div>
        {teacher ? <BookOpen size={36} /> : <GraduationCap size={36} />}
      </div>
      <div className="guide-steps">
        {steps.map(([title, body], i) => (
          <article className="panel guide-step" key={title}>
            <span className="step-number">{i + 1}</span>
            <div>
              <h2>{title}</h2>
              <p>{body}</p>
            </div>
          </article>
        ))}
      </div>
      <section className="panel">
        <h2>Jika ada kendala</h2>
        <details>
          <summary>AI tidak memberikan jawaban</summary>
          <p>
            Periksa API key GroqCloud, pilihan model, batas kuota Groq serta koneksi. Untuk AI
            project, pastikan guru mengaktifkannya. AI project ditutup selama
            tryout. Kurangi panjang permintaan jika keluaran terpotong.
          </p>
        </details>
        <details>
          <summary>Jawaban belum tersinkron</summary>
          <p>
            Jangan hapus data browser. Sambungkan kembali internet dan tunggu
            status Tersimpan di server. Timer tetap berjalan. Saat waktu habis,
            sistem menilai jawaban yang tersimpan sebelum tenggat.
          </p>
        </details>
        <details>
          <summary>Nilai belum muncul</summary>
          <p>
            Pastikan pengumpulan berhasil. Jika sudah selesai, tunggu guru
            membuka hasil paket.
          </p>
        </details>
        <details>
          <summary>Import gagal</summary>
          <p>
            Gunakan template Excel terbaru. Isi opsi unik, kunci A–E, level
            L1/L2/L3, topik dan pembahasan. Pesan kesalahan menunjukkan baris
            yang perlu diperbaiki.
          </p>
        </details>
      </section>
      <section className="panel guide-video-section" aria-labelledby="guide-video-title">
        <div className="section-heading">
          <div>
            <h2 id="guide-video-title">Video panduan</h2>
            <p className="muted">Tonton video berikut langsung dari aplikasi, atau buka di YouTube.</p>
          </div>
        </div>
        <div className="guide-video-frame">
          <iframe
            src="https://www.youtube-nocookie.com/embed/8iHwQ19dIeQ"
            title="Video panduan TKA Pro dari YouTube"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
        <a
          className="guide-video-link"
          href="https://youtu.be/8iHwQ19dIeQ"
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink size={16} /> Buka video di YouTube
        </a>
      </section>
      <div className="alert">
        Hasil dan nilai merupakan latihan internal. Materi AI perlu diperiksa
        sebelum digunakan untuk pembelajaran atau penilaian.
      </div>
    </>
  );
}
