import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Users,
  Copy,
  Clock,
  ArrowLeft,
  ArrowRight,
  Check,
  FileDown,
  Play,
} from "lucide-react";
import {
  rpc,
  type Profile,
  type ClassRow,
  type PackageRow,
  type Attempt,
} from "../lib/db";
import { composePackage, type Question } from "../lib/core";
import {
  Field,
  Modal,
  Rich,
  Empty,
  Busy,
  ErrorBox,
  useData,
  useWork,
  useNotice,
} from "./ui";
import { exportTable, exportDocument } from "../lib/export";
import { SubjectPicker } from "./SubjectPicker";
export function Classes({ profile }: { profile: Profile }) {
  const classes = useData<ClassRow & { member_count: number }>("classes"),
    [open, setOpen] = useState(false),
    [members, setMembers] = useState<
      { name: string; grade: string; id: string }[] | null
    >(null);
  const { busy, run } = useWork(),
    notice = useNotice(),
    teacher = profile.role === "teacher";
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">BELAJAR BERSAMA</span>
          <h1>{teacher ? "Kelas Anda" : "Kelasku"}</h1>
          <p>
            {teacher
              ? "Hubungkan materi, latihan, dan perkembangan siswa."
              : "Bergabung dengan kode undangan dari guru."}
          </p>
        </div>
        <button className="primary" onClick={() => setOpen(true)}>
          <Plus size={18} />
          {teacher ? "Buat kelas" : "Gabung kelas"}
        </button>
      </div>
      <ErrorBox error={classes.error} retry={classes.refresh} />
      {classes.loading ? (
        <Busy />
      ) : classes.data.length ? (
        <div className="document-grid">
          {classes.data.map((c) => (
            <article className="panel" key={c.id}>
              <span className="square-icon">
                <Users />
              </span>
              <h2>{c.name}</h2>
              <p>
                {c.subject} · {c.member_count} siswa
              </p>
              {teacher && (
                <>
                  <div className="invite-code">
                    <span>{c.invite_code}</span>
                    <button
                      className="icon"
                      aria-label="Salin kode kelas"
                      onClick={() =>
                        void navigator.clipboard
                          .writeText(c.invite_code)
                          .then(() => notice("Kode kelas disalin."))
                          .catch(() =>
                            notice("Salin kode yang tampil pada kartu.", true),
                          )
                      }
                    >
                      <Copy size={17} />
                    </button>
                  </div>
                  <button
                    onClick={() =>
                      void run(async () => {
                        setMembers(
                          await rpc("tka_action", {
                            action: "members",
                            payload: { id: c.id },
                          }),
                        );
                      })
                    }
                  >
                    Lihat peserta
                  </button>
                  <div className="class-ai">
                    <label>
                      <input
                        type="checkbox"
                        checked={c.ai_enabled}
                        onChange={(e) =>
                          void run(async () => {
                            await rpc("tka_action", {
                              action: "class_settings",
                              payload: {
                                id: c.id,
                                ai_enabled: e.target.checked,
                                ai_daily_limit: c.ai_daily_limit,
                              },
                            });
                            await classes.refresh();
                          })
                        }
                      />{" "}
                      Aktifkan bantuan AI kelas
                    </label>
                    <Field label="Kuota per siswa / hari">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        defaultValue={c.ai_daily_limit}
                        onBlur={(e) =>
                          void run(async () => {
                            await rpc("tka_action", {
                              action: "class_settings",
                              payload: {
                                id: c.id,
                                ai_enabled: c.ai_enabled,
                                ai_daily_limit: Number(e.target.value),
                              },
                            });
                            await classes.refresh();
                          })
                        }
                      />
                    </Field>
                    <small>
                      Memakai API key guru. Ditutup selama tryout berlangsung.
                    </small>
                  </div>
                </>
              )}
              {!teacher && (
                <span className="badge">
                  {c.ai_enabled ? "Bantuan AI tersedia" : "Terhubung ke guru"}
                </span>
              )}
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title={teacher ? "Belum ada kelas" : "Kamu belum bergabung ke kelas"}
          detail={
            teacher
              ? "Buat kelas pertama dan bagikan kode undangannya."
              : "Mintalah kode kelas kepada guru, lalu pilih Gabung kelas."
          }
        />
      )}
      <div className="guide-strip">
        <Users />
        <p>
          Siswa mendaftar dengan akun sendiri. Kode kelas menghubungkan akun
          siswa ke kelas; tidak membuat akun otomatis.
        </p>
      </div>
      {open && (
        <Modal
          title={teacher ? "Buat kelas" : "Gabung kelas"}
          onClose={() => setOpen(false)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(async () => {
                await rpc("tka_action", {
                  action: teacher ? "create_class" : "join_class",
                  payload: teacher
                    ? { name: f.get("name"), subject: f.get("subject") }
                    : { code: f.get("code") },
                });
                setOpen(false);
                await classes.refresh();
                notice(
                  teacher
                    ? "Kelas dibuat. Bagikan kode kepada siswa."
                    : "Berhasil bergabung.",
                );
              });
            }}
          >
            {teacher ? (
              <>
                <Field label="Nama kelas">
                  <input name="name" required placeholder="Contoh: XII-1" />
                </Field>
                <Field label="Mata pelajaran">
                  <SubjectPicker name="subject" defaultValue={profile.subject} />
                </Field>
              </>
            ) : (
              <Field label="Kode kelas">
                <input
                  name="code"
                  required
                  autoCapitalize="characters"
                  placeholder="Masukkan kode dari guru"
                />
              </Field>
            )}
            <button className="primary" disabled={busy}>
              {teacher ? "Buat kelas" : "Gabung"}
            </button>
          </form>
        </Modal>
      )}
      {members && (
        <Modal title="Peserta kelas" onClose={() => setMembers(null)}>
          <button
            onClick={() =>
              void run(() => exportTable("Peserta_Kelas", members))
            }
          >
            <FileDown size={17} />
            Ekspor Excel
          </button>
          {members.length ? (
            members.map((m) => (
              <div className="list-row" key={m.id}>
                <b>{m.name}</b>
                <span>{m.grade}</span>
              </div>
            ))
          ) : (
            <Empty
              title="Belum ada peserta"
              detail="Bagikan kode kelas kepada siswa."
            />
          )}
        </Modal>
      )}
    </>
  );
}
export function Packages({ profile }: { profile: Profile }) {
  const packages = useData<PackageRow>("packages"),
    classes = useData<ClassRow>("classes"),
    bank = useData<Question>("questions");
  const [open, setOpen] = useState(false),
    [packageSubject, setPackageSubject] = useState(profile.subject),
    [exam, setExam] = useState<{ pkg: PackageRow; attempt: Attempt } | null>(
      null,
    ),
    [preview, setPreview] = useState<
      | (PackageRow & {
          keys?: Record<string, { answer: number; explanation: string }>;
        })
      | null
    >(null);
  const { busy, run } = useWork(),
    notice = useNotice(),
    teacher = profile.role === "teacher";
  if (exam)
    return (
      <Exam
        pkg={exam.pkg}
        initial={exam.attempt}
        onClose={() => {
          setExam(null);
          void packages.refresh();
        }}
      />
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">LATIHAN & TRYOUT</span>
          <h1>{teacher ? "Paket pembelajaran" : "Latihan dari gurumu"}</h1>
          <p>
            {teacher
              ? "Susun paket dari soal yang sudah ditelaah."
              : "Kerjakan dengan tenang. Jawaban tersimpan otomatis."}
          </p>
        </div>
        {teacher && (
          <button className="primary" onClick={() => setOpen(true)}>
            <Plus size={18} />
            Susun paket
          </button>
        )}
      </div>
      <ErrorBox error={packages.error} retry={packages.refresh} />
      {packages.loading ? (
        <Busy />
      ) : packages.data.length ? (
        <div className="document-grid">
          {packages.data.map((p) => (
            <article className="panel" key={p.id}>
              <span className={"badge " + (p.published ? "green" : "")}>
                {p.published ? "Terbit" : "Draf"}
              </span>
              <h2>{p.title}</h2>
              <p>
                {p.subject} · {p.questions.length} soal · {p.duration} menit
              </p>
              <small>
                {classes.data.find((c) => c.id === p.class_id)?.name ||
                  "Belum ditugaskan ke kelas"}
              </small>
              {p.starts_at && (
                <p className="muted">
                  Dibuka: {new Date(p.starts_at).toLocaleString("id-ID")}
                </p>
              )}
              <div className="row-actions">
                {teacher ? (
                  <>
                    <button
                      onClick={() =>
                        void run(async () => {
                          setPreview(
                            await rpc("tka_action", {
                              action: "package_detail",
                              payload: { id: p.id },
                            }),
                          );
                        })
                      }
                    >
                      Pratinjau
                    </button>
                    <button
                      className="primary"
                      disabled={busy || !p.class_id}
                      onClick={() =>
                        void run(async () => {
                          await rpc("tka_action", {
                            action: "publish_package",
                            payload: {
                              id: p.id,
                              published: !p.published,
                              release_results: p.release_results,
                            },
                          });
                          await packages.refresh();
                          notice(
                            p.published
                              ? "Paket ditutup."
                              : "Paket diterbitkan ke kelas.",
                          );
                        })
                      }
                    >
                      {p.published ? "Tutup paket" : "Terbitkan"}
                    </button>
                  </>
                ) : (
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const attempt = await rpc<Attempt>("tka_action", {
                          action: "start_attempt",
                          payload: { id: p.id },
                        });
                        if (attempt.submitted_at) {
                          notice(
                            "Paket sudah selesai. Buka Progres untuk melihat hasil.",
                          );
                          return;
                        }
                        setExam({ pkg: { ...p, questions: (attempt.questions || p.questions) as typeof p.questions }, attempt });
                      })
                    }
                  >
                    <Play size={17} />
                    Mulai / lanjutkan
                  </button>
                )}
              </div>
              {teacher && (
                <label className="release-check">
                  <input
                    type="checkbox"
                    checked={p.release_results}
                    onChange={(e) =>
                      void run(async () => {
                        await rpc("tka_action", {
                          action: "publish_package",
                          payload: {
                            id: p.id,
                            published: p.published,
                            release_results: e.target.checked,
                          },
                        });
                        await packages.refresh();
                      })
                    }
                  />
                  Buka nilai & pembahasan setelah selesai
                </label>
              )}
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title={teacher ? "Belum ada paket" : "Belum ada latihan kelas"}
          detail={
            teacher
              ? "Siapkan bank soal dan tandai soal yang sudah ditelaah."
              : "Latihan muncul setelah guru menerbitkan paket. Untuk latihan mandiri, gunakan Belajar AI."
          }
        />
      )}
      <div className="alert">
        Paket menyimpan salinan soal saat dibuat. Edit bank soal berikutnya
        tidak mengubah paket atau nilai yang sudah ada.
      </div>
      {open && (
        <Modal title="Susun paket tryout" onClose={() => setOpen(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(async () => {
                const selected = composePackage(
                  bank.data.filter(
                    (q) => q.subject === String(f.get("subject")),
                  ),
                  Number(f.get("count")),
                  {
                    L1: Number(f.get("L1")),
                    L2: Number(f.get("L2")),
                    L3: Number(f.get("L3")),
                  },
                );
                await rpc("tka_action", {
                  action: "create_package",
                  payload: {
                    title: f.get("title"),
                    duration: Number(f.get("duration")),
                    class_id: f.get("class_id") || null,
                    subject: f.get("subject"),
                    question_ids: selected.map((q) => q.id),
                    starts_at: f.get("starts_at")
                      ? new Date(String(f.get("starts_at"))).toISOString()
                      : null,
                    ends_at: f.get("ends_at")
                      ? new Date(String(f.get("ends_at"))).toISOString()
                      : null,
                  },
                });
                setOpen(false);
                await packages.refresh();
                notice("Paket disusun. Periksa pratinjau sebelum menerbitkan.");
              });
            }}
          >
            <Field label="Nama paket">
              <input
                name="title"
                required
                placeholder="Tryout 1 — Pemetaan awal"
              />
            </Field>
            <Field label="Mata pelajaran">
              <SubjectPicker name="subject" value={packageSubject} onChange={setPackageSubject} />
            </Field>
            <Field label="Kelas penerima">
              <select name="class_id" required>
                <option value="">Pilih kelas</option>
                {classes.data.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="form-grid">
              <Field label="Jumlah soal">
                <input
                  name="count"
                  type="number"
                  min={1}
                  max={60}
                  defaultValue={10}
                  required
                />
              </Field>
              <Field label="Durasi (menit)">
                <input
                  name="duration"
                  type="number"
                  min={1}
                  max={240}
                  defaultValue={30}
                  required
                />
              </Field>
            </div>
            <div className="form-grid three">
              {(["L1", "L2", "L3"] as const).map((l, i) => (
                <Field
                  label={`${l} (stok ${bank.data.filter((q) => q.status === "ready" && q.level === l && q.subject === packageSubject).length})`}
                  key={l}
                >
                  <input
                    name={l}
                    type="number"
                    min={0}
                    defaultValue={[2, 4, 4][i]}
                    required
                  />
                </Field>
              ))}
            </div>
            <p className="muted">
              Jumlah L1 + L2 + L3 harus sama dengan jumlah soal.
            </p>
            <div className="form-grid">
              <Field label="Dibuka (opsional)">
                <input type="datetime-local" name="starts_at" />
              </Field>
              <Field label="Ditutup (opsional)">
                <input type="datetime-local" name="ends_at" />
              </Field>
            </div>
            <button className="primary" disabled={busy}>
              Susun draf paket
            </button>
          </form>
        </Modal>
      )}
      {preview && (
        <Modal title={preview.title} onClose={() => setPreview(null)}>
          <div className="toolbar">
            <button
              onClick={() =>
                void run(() =>
                  exportDocument(
                    preview.title,
                    preview.questions
                      .map(
                        (q, i) =>
                          `${i + 1}. ${q.question}\n${q.options.map((o, j) => `${"ABCDE"[j]}. ${o}`).join("\n")}`,
                      )
                      .join("\n\n"),
                    "docx",
                    profile.school,
                  ),
                )
              }
            >
              Naskah Word
            </button>
            <button
              onClick={() =>
                void run(() =>
                  exportDocument(
                    "Kunci " + preview.title,
                    preview.questions
                      .map(
                        (q, i) =>
                          `${i + 1}. ${"ABCDE"[preview.keys?.[q.id]?.answer ?? 0]}\n${preview.keys?.[q.id]?.explanation || ""}`,
                      )
                      .join("\n\n"),
                    "docx",
                    profile.school,
                  ),
                )
              }
            >
              Kunci terpisah
            </button>
            <button
              onClick={() =>
                void run(() =>
                  exportTable(
                    "Kisi_Kisi",
                    preview.questions.map((q, i) => ({
                      nomor: i + 1,
                      topik: q.topic,
                      level: q.level,
                      indikator: q.question,
                    })),
                  ),
                )
              }
            >
              Kisi-kisi Excel
            </button>
          </div>
          {preview.questions.map((q, i) => (
            <div className="practice-question" key={q.id}>
              <Rich text={`${i + 1}. ${q.question}`} />
              <ol type="A">
                {q.options.map((o, j) => (
                  <li key={j}>{o}</li>
                ))}
              </ol>
            </div>
          ))}
        </Modal>
      )}
    </>
  );
}
function Exam({
  pkg,
  initial,
  onClose,
}: {
  pkg: PackageRow;
  initial: Attempt;
  onClose: () => void;
}) {
  const storageKey = "tka-answer-" + initial.student_id + "-" + initial.id;
  const [answers, setAnswers] = useState<Record<string, number>>(() => {
      try {
        return {
          ...initial.answers,
          ...JSON.parse(localStorage.getItem(storageKey) || "{}"),
        };
      } catch {
        return initial.answers;
      }
    }),
    [index, setIndex] = useState(0),
    [now, setNow] = useState(Date.now()),
    [marked, setMarked] = useState<Record<string, boolean>>({}),
    [status, setStatus] = useState("Tersimpan"),
    [done, setDone] = useState(false);
  const { busy, run } = useWork(),
    notice = useNotice(),
    autoSubmitted = useRef(false),
    answerRef = useRef(answers);
  answerRef.current = answers;
  const deadline = Math.min(
      new Date(initial.started_at).getTime() + pkg.duration * 60000,
      pkg.ends_at ? new Date(pkg.ends_at).getTime() : Infinity,
    ),
    seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  const current = pkg.questions[index];
  async function submit() {
    await run(async () => {
      await rpc("tka_action", {
        action: "submit_attempt",
        payload: { id: initial.id, answers: answerRef.current },
      });
      localStorage.removeItem(storageKey);
      setDone(true);
      notice("Jawaban berhasil dikumpulkan.");
    });
  }
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (done) return;
    localStorage.setItem(storageKey, JSON.stringify(answers));
    setStatus("Menyimpan…");
    const id = setTimeout(() => {
      void rpc("tka_action", {
        action: "save_attempt",
        payload: { id: initial.id, answers },
      })
        .then(() => setStatus("Tersimpan di server"))
        .catch(() =>
          setStatus("Belum tersinkron. Salinan tersimpan di perangkat."),
        );
    }, 500);
    return () => clearTimeout(id);
  }, [answers, done]);
  useEffect(() => {
    if (seconds === 0 && !done && !autoSubmitted.current) {
      autoSubmitted.current = true;
      void submit();
    }
  }, [seconds, done]);
  useEffect(() => {
    if (done) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [done]);
  if (done)
    return (
      <Empty
        title="Latihan selesai"
        detail="Guru dapat membuka nilai dan pembahasan. Lihat hasilnya pada menu Progres."
      >
        <button className="primary" onClick={onClose}>
          Kembali ke latihan
        </button>
      </Empty>
    );
  return (
    <div className="exam">
      <header className="exam-header">
        <button
          onClick={() => {
            if (
              confirm(
                "Keluar sementara? Jawaban yang tersimpan dapat dilanjutkan selama waktu belum habis.",
              )
            )
              onClose();
          }}
        >
          <ArrowLeft size={18} />
          Kembali
        </button>
        <h2>{pkg.title}</h2>
        <span className={"timer " + (seconds < 60 ? "urgent" : "")}>
          <Clock size={18} />
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
        </span>
      </header>
      <div className="exam-layout">
        <section className="panel">
          <div className="section-heading">
            <span className="badge">
              Soal {index + 1} dari {pkg.questions.length}
            </span>
            <small>{current.topic}</small>
          </div>
          <Rich text={current.question} />
          <div className="exam-options">
            {current.options.map((o, i) => (
              <label
                className={
                  "option " + (answers[current.id] === i ? "selected" : "")
                }
                key={i}
              >
                <input
                  type="radio"
                  name={current.id}
                  disabled={seconds === 0}
                  checked={answers[current.id] === i}
                  onChange={() => setAnswers({ ...answers, [current.id]: i })}
                />
                <b>{"ABCDE"[i]}</b>
                <Rich text={o} />
              </label>
            ))}
          </div>
          <div className="toolbar">
            <button disabled={index === 0} onClick={() => setIndex(index - 1)}>
              <ArrowLeft size={17} />
              Sebelumnya
            </button>
            <button
              onClick={() =>
                setMarked({ ...marked, [current.id]: !marked[current.id] })
              }
            >
              {marked[current.id] ? "Hapus tanda" : "Tandai ragu"}
            </button>
            <button
              disabled={index === pkg.questions.length - 1}
              onClick={() => setIndex(index + 1)}
            >
              Berikutnya
              <ArrowRight size={17} />
            </button>
          </div>
        </section>
        <aside className="panel exam-side">
          <h3>Navigasi soal</h3>
          <div className="question-nav">
            {pkg.questions.map((q, i) => (
              <button
                className={
                  (index === i ? "active " : "") +
                  (answers[q.id] !== undefined ? "answered " : "") +
                  (marked[q.id] ? "marked" : "")
                }
                key={q.id}
                onClick={() => setIndex(i)}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <p>
            {Object.keys(answers).length}/{pkg.questions.length} dijawab
          </p>
          <small className="muted">{status}</small>
          <button
            className="primary wide"
            disabled={busy}
            onClick={() => {
              if (
                seconds === 0 ||
                confirm(
                  `Kumpulkan jawaban? ${pkg.questions.length - Object.keys(answers).length} soal belum dijawab.`,
                )
              )
                void submit();
            }}
          >
            <Check size={18} />
            {seconds === 0 ? "Kirim jawaban tersimpan" : "Selesai & kumpulkan"}
          </button>
        </aside>
      </div>
    </div>
  );
}
type Result = Omit<Attempt, "questions"> & {
  keys?: Record<string, { answer: number; explanation: string }>;
  questions?: {
    id: string;
    question: string;
    options: string[];
    topic: string;
    level: string;
  }[];
};
export function Results({ profile }: { profile: Profile }) {
  const results = useData<Result>("results"),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState<Result | null>(null),
    [threshold, setThreshold] = useState(70);
  const { run } = useWork(),
    teacher = profile.role === "teacher";
  const rows = results.data.filter((r) =>
      (r.student_name + " " + r.package_title)
        .toLowerCase()
        .includes(search.toLowerCase()),
    ),
    scored = rows.filter(
      (r) => r.submitted_at && r.score !== null && r.score !== undefined,
    );
  const avg = scored.length
    ? Math.round(
        scored.reduce((a, b) => a + Number(b.score), 0) / scored.length,
      )
    : null;
  const topics: Record<string, { correct: number; total: number }> = {};
  for (const r of scored)
    for (const q of r.questions || []) {
      topics[q.topic] ??= { correct: 0, total: 0 };
      topics[q.topic].total++;
      if (r.answers[q.id] === r.keys?.[q.id]?.answer) topics[q.topic].correct++;
    }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">HASIL MENJADI ARAH</span>
          <h1>{teacher ? "Hasil & tindak lanjut" : "Progres belajarmu"}</h1>
          <p>
            {teacher
              ? "Lihat capaian, temukan kesulitan, lalu tentukan latihan berikutnya."
              : "Kenali materi yang sudah dipahami dan yang perlu dilatih."}
          </p>
        </div>
      </div>
      <div className="stats-grid">
        <div className="stat">
          <strong>{scored.length}</strong>
          <span>Hasil tersedia</span>
        </div>
        <div className="stat">
          <strong>{avg ?? "—"}</strong>
          <span>Rata-rata</span>
        </div>
        <div className="stat">
          <strong>
            {scored.filter((r) => Number(r.score) >= threshold).length}
          </strong>
          <span>Tuntas ≥ {threshold}</span>
        </div>
        <div className="stat">
          <strong>
            {scored.filter((r) => Number(r.score) < threshold).length}
          </strong>
          <span>Perlu pendampingan</span>
        </div>
      </div>
      <div className="toolbar">
        <input
          placeholder="Cari peserta atau paket…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Field label="Batas tuntas">
          <input
            type="number"
            min={0}
            max={100}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
          />
        </Field>
        <button
          onClick={() =>
            void run(() =>
              exportTable(
                "Rekap_Hasil",
                rows.map((r) => ({
                  nama: r.student_name,
                  paket: r.package_title,
                  tanggal: new Date(r.started_at).toLocaleDateString("id-ID"),
                  status: r.submitted_at ? "Selesai" : "Berlangsung",
                  nilai: r.score ?? "Belum dibuka",
                  benar: r.correct ?? "Belum dibuka",
                })),
              ),
            )
          }
        >
          <FileDown size={17} />
          Ekspor Excel
        </button>
        <button
          onClick={() =>
            void run(() =>
              exportDocument(
                "Laporan Hasil Latihan",
                `Rata-rata: ${avg ?? "Belum tersedia"}\nBatas tuntas: ${threshold}\n\n` +
                  scored
                    .map(
                      (r) =>
                        `${r.student_name} — ${r.package_title}: ${r.score} (${Number(r.score) >= threshold ? "Tuntas" : "Perlu pendampingan"})`,
                    )
                    .join("\n"),
                "docx",
                profile.school,
              ),
            )
          }
        >
          Laporan Word
        </button>
      </div>
      <ErrorBox error={results.error} retry={results.refresh} />
      {results.loading ? (
        <Busy />
      ) : rows.length ? (
        <div className="panel">
          {rows.map((r) => (
            <button
              className="list-row"
              key={r.id}
              onClick={() => setSelected(r)}
            >
              <span className="avatar">
                {(r.student_name || profile.name).slice(0, 1)}
              </span>
              <div>
                <b>{teacher ? r.student_name : r.package_title}</b>
                <small>
                  {teacher
                    ? r.package_title
                    : r.submitted_at
                      ? "Selesai"
                      : "Sedang dikerjakan"}{" "}
                  · {new Date(r.started_at).toLocaleDateString("id-ID")}
                </small>
              </div>
              <strong>{r.score ?? "—"}</strong>
              <ArrowRight size={17} />
            </button>
          ))}
        </div>
      ) : (
        <Empty
          title="Belum ada hasil latihan"
          detail="Hasil muncul setelah siswa mulai mengerjakan paket. Nilai mengikuti pengaturan pembukaan hasil oleh guru."
        />
      )}
      {Object.keys(topics).length > 0 && (
        <section className="panel">
          <h2>Penguasaan per topik</h2>
          {Object.entries(topics)
            .sort(
              (a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total,
            )
            .map(([topic, v]) => (
              <div className="topic-row" key={topic}>
                <b>{topic}</b>
                <div className="progress-track">
                  <span style={{ width: `${(v.correct / v.total) * 100}%` }} />
                </div>
                <span>{Math.round((v.correct / v.total) * 100)}%</span>
              </div>
            ))}
          <p className="muted">
            Topik dengan capaian terendah menjadi prioritas latihan ulang. Angka
            berasal dari hasil yang nilainya sudah dibuka.
          </p>
        </section>
      )}
      {selected && (
        <Modal
          title={`${selected.student_name} — ${selected.package_title}`}
          onClose={() => setSelected(null)}
        >
          {selected.score !== null && selected.score !== undefined ? (
            <>
              <div className="result-score">
                {selected.score}
                <small>Nilai latihan internal</small>
              </div>
              {selected.questions?.map((q, i) => (
                <details key={q.id}>
                  <summary>
                    {i + 1}. {q.question}{" "}
                    {selected.answers[q.id] === selected.keys?.[q.id]?.answer
                      ? "✓"
                      : "—"}
                  </summary>
                  <p>
                    Jawaban:{" "}
                    {selected.answers[q.id] === undefined
                      ? "Belum dijawab"
                      : q.options[selected.answers[q.id]]}
                  </p>
                  <p>Kunci: {q.options[selected.keys?.[q.id]?.answer ?? 0]}</p>
                  <Rich text={selected.keys?.[q.id]?.explanation || ""} />
                </details>
              ))}
              <button
                onClick={() =>
                  void run(() =>
                    exportDocument(
                      "Pembahasan " + selected.package_title,
                      selected.questions
                        ?.map(
                          (q, i) =>
                            `${i + 1}. ${q.question}\n${selected.keys?.[q.id]?.explanation || ""}`,
                        )
                        .join("\n\n") || "",
                      "pdf",
                      profile.school,
                    ),
                  )
                }
              >
                Unduh PDF pembahasan
              </button>
            </>
          ) : (
            <p>
              {selected.submitted_at
                ? "Guru belum membuka nilai dan pembahasan."
                : "Latihan masih berlangsung."}
            </p>
          )}
        </Modal>
      )}
    </>
  );
}
