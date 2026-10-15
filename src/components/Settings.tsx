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
import { recommendedModels } from "../lib/gemini-errors";
import { type AiProvider, GROQ_MODELS, GROQ_DEFAULT_MODEL, providerFromStoredModel, modelFromStoredModel } from "../lib/ai-providers";
export function SettingsPage({
  profile,
  onProfile,
}: {
  profile: Profile;
  onProfile: (p: Profile) => void;
}) {
  const [installed, setInstalled] = useState(false),
    [provider, setProvider] = useState<AiProvider>("gemini"),
    [model, setModel] = useState("gemini-3.5-flash-lite"),
    [direction, setDirection] = useState(
      "Jelas, terstruktur, dan sesuai jenjang siswa.",
    ),
    [apiKey, setApiKey] = useState(""),
    [availableModels, setAvailableModels] = useState<string[]>([]),
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
        setInstalled(s.installed);
        if (s.installed) {
          setProvider(providerFromStoredModel(s.model));
          setModel(modelFromStoredModel(s.model));
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
            <h2>
              <KeyRound size={20} />
              Pengaturan AI
            </h2>
            <span className={"badge " + (installed ? "green" : "")}>
              {installed ? "Terpasang" : "Belum terpasang"}
            </span>
          </div>
          <ErrorBox error={error} />
          <p>
            Pilih penyedia AI. Jika Gemini ditolak Google (403), gunakan GroqCloud
            dengan API key milik Anda. Groq menyediakan kuota gratis terbatas.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                setConnectError("");
                try {
                  const r = await api("settings", { provider, apiKey, model: model.trim(), direction });
                  setApiKey("");
                  setInstalled(true);
                  setModelNotice(provider === "groq" ? "Model Groq teruji dan tersimpan. Generator kini memakai Groq." : "Model Gemini teruji dan tersimpan.");
                  notice(r.message);
                } catch (cause) {
                  setConnectError(cause instanceof Error ? cause.message : "Koneksi Gemini gagal.");
                  throw cause;
                }
              });
            }}
          >
            <Field label="Penyedia AI">
              <select value={provider} onChange={e => {
                const next = e.target.value as AiProvider;
                setProvider(next);
                setModel(next === "groq" ? GROQ_DEFAULT_MODEL : "gemini-3.5-flash-lite");
                setAvailableModels([]);
                setApiKey("");
                setModelNotice("");
                setConnectError("");
              }}>
                <option value="gemini">Google Gemini · memerlukan akses project Google</option>
                <option value="groq">GroqCloud · tersedia paket gratis</option>
              </select>
            </Field>
            <Field
              label={
                installed
                  ? "API key penyedia terpilih (masukkan ulang untuk mengganti)"
                  : provider === "groq" ? "API key GroqCloud" : "API key Gemini"
              }
            >
              <input
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                required
                placeholder="API key tidak ditampilkan kembali"
              />
            </Field>
            <Field label="Model">
              {provider === "groq" ? (
                <select value={model} onChange={e => setModel(e.target.value)}>
                  {GROQ_MODELS.map(id => <option key={id} value={id}>{id}</option>)}
                </select>
              ) : (
                <>
                  <input list="tka-gemini-model-choices" value={model}
                    onChange={e => { setModel(e.target.value); setModelNotice(""); }}
                    required placeholder="Pilih ID model Gemini" />
                  <datalist id="tka-gemini-model-choices">
                    {recommendedModels([
                      ...availableModels, "gemini-3.5-flash-lite", "gemini-3.1-flash-lite",
                      "gemini-2.5-flash-lite", "gemini-3.8-flash",
                    ]).map(id => <option value={id} key={id} />)}
                  </datalist>
                </>
              )}
              <div className="model-lookup-row">
                <button type="button" disabled={modelLoading || busy || apiKey.trim().length < 20}
                  onClick={async () => {
                    setModelLoading(true);
                    setConnectError("");
                    setModelNotice("");
                    try {
                      const response = await api("settings", { provider, apiKey, autoDetect: true });
                      const found = response.models as string[];
                      setAvailableModels(found);
                      setModel(response.model as string);
                      setModelNotice(response.message);
                    } catch (cause) {
                      setConnectError(cause instanceof Error ? cause.message : "Daftar model gagal dimuat.");
                    } finally {
                      setModelLoading(false);
                    }
                  }}>
                  {modelLoading ? "Menguji beberapa model…" : "Cari & uji model otomatis"}
                </button>
              </div>
              {modelNotice && <small className="muted" role="status">{modelNotice}</small>}
              <small className="muted">
                {provider === "groq"
                  ? "Aplikasi menguji model Groq dengan permintaan nyata. Kuota gratis tergantung ketentuan Groq; mode ini mendukung teks, bukan gambar atau PDF."
                  : "Aplikasi mencoba beberapa model Gemini ringan lebih dahulu. Jika semuanya ditolak 403, pilih GroqCloud."}
                Setelah satu model berhasil diuji, klik Tes koneksi &amp; simpan.
              </small>
            </Field>
            {connectError && <div className="alert error" role="alert">{connectError}</div>}
            <Field label="Arah jawaban AI">
              <textarea
                value={direction}
                onChange={(e) => setDirection(e.target.value)}
                rows={5}
                maxLength={1000}
                placeholder="Contoh: jelaskan bertahap, gunakan contoh sehari-hari, dan tutup dengan tiga latihan."
              />
            </Field>
            <button className="primary" disabled={busy || !apiKey}>
              {busy ? "Menguji koneksi…" : "Tes koneksi & simpan"}
            </button>
          </form>
          <div className="security-note">
            <ShieldCheck size={18} />
            <small>
              Key disimpan terenkripsi di server, tidak dimasukkan ke ekspor
              atau dibagikan ke siswa.
            </small>
          </div>
          {installed && (
            <button
              className="danger"
              disabled={busy}
              onClick={() => {
                if (
                  confirm(
                    "Hapus API key? Fitur AI pribadi dan AI project Anda akan berhenti sampai dipasang kembali.",
                  )
                )
                  void run(async () => {
                    await api("settings", { remove: true });
                    setInstalled(false);
                    notice("API key dihapus.");
                  });
              }}
            >
              Hapus API key
            </button>
          )}
          <a
            className="link"
            href={provider === "groq" ? "https://console.groq.com/keys" : "https://aistudio.google.com/apikey"}
            target="_blank"
            rel="noreferrer"
          >
            {provider === "groq" ? "Buat API key gratis di GroqCloud" : "Buka Google AI Studio"}
            <ExternalLink size={15} />
          </a>
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
          "Buka Google AI Studio, buat API key, lalu salin ke Pengaturan AI. Isi nama model yang tersedia pada akun Anda. Pilih Tes koneksi & simpan. Jangan bagikan key ke siswa.",
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
            Periksa key dan nama model, kuota Google, serta koneksi. Untuk AI
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
      <section className="panel">
        <h2>Video demo</h2>
        <p>
          Petunjuk teks sudah tersedia. Video demo akan ditambahkan setelah
          pemilik aplikasi memberikan tautan videonya.
        </p>
      </section>
      <div className="alert">
        Hasil dan nilai merupakan latihan internal. Materi AI perlu diperiksa
        sebelum digunakan untuk pembelajaran atau penilaian.
      </div>
    </>
  );
}
