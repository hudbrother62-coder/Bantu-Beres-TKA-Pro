import { useState } from "react";
import {
  Plus,
  Search,
  FileDown,
  Upload,
  Check,
  Archive,
  Edit,
  Trash2,
} from "lucide-react";
import { rpc, type Profile, type ClassRow } from "../lib/db";
import { validateQuestions, type Question } from "../lib/core";
import { exportTable, readExcel, exportDocument } from "../lib/export";
import { SubjectPicker } from "./SubjectPicker";
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
type Doc = {
  id: string;
  owner_id: string;
  title: string;
  body: string;
  class_id: string | null;
  kind: string;
};
export function Materials({ profile }: { profile: Profile }) {
  const docs = useData<Doc>("documents"),
    classes = useData<ClassRow>("classes"),
    [search, setSearch] = useState(""),
    [editing, setEditing] = useState<Partial<Doc> | null>(null),
    [view, setView] = useState<Doc | null>(null);
  const { busy, run } = useWork(),
    notice = useNotice();
  return (
    <>
      <div className="toolbar">
        <label className="search">
          <Search size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari materi atau hasil latihan…"
          />
        </label>
        <button className="primary" onClick={() => setEditing({})}>
          <Plus size={17} />
          Tambah materi
        </button>
      </div>
      <ErrorBox error={docs.error} retry={docs.refresh} />
      {docs.loading ? (
        <Busy />
      ) : docs.data.length ? (
        <div className="document-grid">
          {docs.data
            .filter((d) =>
              (d.title + d.body).toLowerCase().includes(search.toLowerCase()),
            )
            .map((d) => (
              <article className="panel document" key={d.id}>
                <span className="badge">
                  {d.kind === "practice"
                    ? "Latihan mandiri"
                    : d.class_id
                      ? "Materi kelas"
                      : "Pribadi"}
                </span>
                <h3>{d.title}</h3>
                <p>{d.body.replace(/[#*]/g, "").slice(0, 130)}…</p>
                <div className="row-actions">
                  <button onClick={() => setView(d)}>Buka materi</button>
                  {d.owner_id === profile.id && (
                    <>
                      <button
                        className="icon"
                        aria-label="Edit materi"
                        onClick={() => setEditing(d)}
                      >
                        <Edit size={17} />
                      </button>
                      <button
                        className="icon"
                        aria-label="Hapus materi"
                        onClick={() => {
                          if (confirm("Hapus materi ini?"))
                            void run(async () => {
                              await rpc("tka_action", {
                                action: "delete_document",
                                payload: { id: d.id },
                              });
                              await docs.refresh();
                            });
                        }}
                      >
                        <Trash2 size={17} />
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
        </div>
      ) : (
        <Empty
          title="Pustaka masih kosong"
          detail="Simpan hasil Asisten AI atau tambahkan bahan belajar sendiri."
        />
      )}
      {editing && (
        <Modal
          title={editing.id ? "Edit materi" : "Tambah materi"}
          onClose={() => setEditing(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(async () => {
                await rpc("tka_action", {
                  action: "save_document",
                  payload: {
                    id: editing.id,
                    title: f.get("title"),
                    body: f.get("body"),
                    class_id: f.get("class_id") || null,
                  },
                });
                setEditing(null);
                await docs.refresh();
                notice("Materi disimpan.");
              });
            }}
          >
            <Field label="Judul">
              <input name="title" required defaultValue={editing.title} />
            </Field>
            <Field label="Isi materi (mendukung Markdown)">
              <textarea
                name="body"
                required
                rows={12}
                defaultValue={editing.body}
              />
            </Field>
            {profile.role === "teacher" && (
              <Field label="Bagikan ke kelas">
                <select name="class_id" defaultValue={editing.class_id || ""}>
                  <option value="">Simpan pribadi</option>
                  {classes.data.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <button className="primary" disabled={busy}>
              Simpan materi
            </button>
          </form>
        </Modal>
      )}
      {view && (
        <Modal title={view.title} onClose={() => setView(null)}>
          <div className="toolbar">
            <button
              onClick={() =>
                void run(() =>
                  exportDocument(view.title, view.body, "docx", profile.school),
                )
              }
            >
              Unduh Word
            </button>
            <button
              onClick={() =>
                void run(() =>
                  exportDocument(view.title, view.body, "pdf", profile.school),
                )
              }
            >
              Unduh PDF
            </button>
            <button onClick={() => window.print()}>Cetak</button>
          </div>
          <Rich text={view.body} />
        </Modal>
      )}
    </>
  );
}
export function Bank({ profile }: { profile: Profile }) {
  const bank = useData<Question>("questions");
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [subjectFilter, setSubjectFilter] = useState("all"),
    [editing, setEditing] = useState<Partial<Question> | null>(null),
    [imported, setImported] = useState<Question[]>([]);
  const { busy, run } = useWork(),
    notice = useNotice();
  const filtered = bank.data.filter(
    (q) =>
      (filter === "all" || q.status === filter) &&
      (subjectFilter === "all" || q.subject === subjectFilter) &&
      (q.question + " " + q.topic + " " + q.subject)
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  async function importFile(file: File) {
    const rows = await readExcel(file);
    const prepared = rows.map((r, i) => {
      try {
        return {
          ...validateQuestions([
            {
              question: r.pertanyaan,
              options: [
                r.opsi_a,
                r.opsi_b,
                r.opsi_c,
                r.opsi_d,
                r.opsi_e,
              ].filter(Boolean),
              answer: "ABCDE".indexOf((r.kunci || "").trim().toUpperCase()),
              topic: r.topik,
              level: r.level,
              explanation: r.pembahasan,
            },
          ])[0],
          subject: r.mata_pelajaran || profile.subject,
        };
      } catch (e) {
        throw new Error(
          `Baris ${i + 2}: ${e instanceof Error ? e.message : "Data tidak valid."}`,
        );
      }
    });
    setImported(prepared);
  }
  return (
    <>
      <div className="import-strip">
        <div>
          <b>Masukkan banyak soal sekaligus</b>
          <small>Import selalu menjadi draf untuk ditelaah.</small>
        </div>
        <button
          onClick={() =>
            void run(() =>
              exportTable(
                "Template_Bank_Soal",
                [],
                [
                  "mata_pelajaran",
                  "topik",
                  "level",
                  "pertanyaan",
                  "opsi_a",
                  "opsi_b",
                  "opsi_c",
                  "opsi_d",
                  "opsi_e",
                  "kunci",
                  "pembahasan",
                ],
              ),
            )
          }
        >
          <FileDown size={17} />
          Template Excel
        </button>
        <label className="button">
          <Upload size={17} />
          Import Excel
          <input
            className="hidden"
            type="file"
            accept=".xlsx"
            onChange={(e) => {
              if (e.target.files?.[0])
                void run(() => importFile(e.target.files![0]));
              e.target.value = "";
            }}
          />
        </label>
      </div>
      <div className="toolbar">
        <label className="search">
          <Search size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari pertanyaan, topik, atau mapel…"
          />
        </label>
        <select aria-label="Filter mata pelajaran" value={subjectFilter}
          onChange={e => setSubjectFilter(e.target.value)}>
          <option value="all">Semua mata pelajaran</option>
          {Array.from(new Set(bank.data.map(q => q.subject).filter(Boolean))).sort((a,b) => a.localeCompare(b, "id")).map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          aria-label="Filter status"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">Semua status</option>
          <option value="draft">Perlu telaah</option>
          <option value="ready">Siap dipakai</option>
          <option value="archived">Arsip</option>
        </select>
        <button
          className="primary"
          onClick={() =>
            setEditing({
              options: ["", "", "", ""],
              level: "L2",
              status: "draft",
              subject: profile.subject,
            })
          }
        >
          <Plus size={17} />
          Tambah soal
        </button>
        <button
          onClick={() =>
            void run(() =>
              exportTable(
                "Bank_Soal",
                filtered.map((q) => ({
                  mata_pelajaran: q.subject,
                  topik: q.topic,
                  level: q.level,
                  pertanyaan: q.question,
                  opsi_a: q.options[0],
                  opsi_b: q.options[1],
                  opsi_c: q.options[2],
                  opsi_d: q.options[3],
                  opsi_e: q.options[4] || "",
                  kunci: "ABCDE"[q.answer],
                  pembahasan: q.explanation,
                })),
              ),
            )
          }
        >
          Ekspor
        </button>
      </div>
      <ErrorBox error={bank.error} retry={bank.refresh} />
      {bank.loading ? (
        <Busy />
      ) : filtered.length ? (
        <div className="question-list">
          {filtered.map((q) => (
            <article className="panel" key={q.id}>
              <div className="section-heading">
                <div className="badges">
                  <span className="badge">{q.level}</span>
                  <span
                    className={"badge " + (q.status === "ready" ? "green" : "")}
                  >
                    {q.status === "ready"
                      ? "Siap dipakai"
                      : q.status === "archived"
                        ? "Arsip"
                        : "Perlu telaah"}
                  </span>
                  <small>
                    {q.subject} · {q.topic}
                  </small>
                </div>
                <div className="row-actions">
                  <button
                    className="icon"
                    aria-label="Edit soal"
                    onClick={() => setEditing(q)}
                  >
                    <Edit size={17} />
                  </button>
                  <button
                    className="icon"
                    aria-label="Arsip atau pulihkan"
                    onClick={() =>
                      void run(async () => {
                        await rpc("tka_action", {
                          action: "question_status",
                          payload: {
                            id: q.id,
                            status:
                              q.status === "archived" ? "draft" : "archived",
                          },
                        });
                        await bank.refresh();
                      })
                    }
                  >
                    <Archive size={17} />
                  </button>
                </div>
              </div>
              <Rich text={q.question} />
              <details>
                <summary>Lihat pilihan, kunci & pembahasan</summary>
                <ol type="A">
                  {q.options.map((o, i) => (
                    <li key={i}>
                      {o}
                      {i === q.answer ? " ✓" : ""}
                    </li>
                  ))}
                </ol>
                <Rich text={q.explanation} />
              </details>
              {q.status === "draft" && (
                <button
                  className="link"
                  disabled={busy}
                  onClick={() => {
                    if (
                      confirm(
                        "Anda sudah memeriksa pertanyaan, kunci, dan pembahasannya?",
                      )
                    )
                      void run(async () => {
                        await rpc("tka_action", {
                          action: "question_status",
                          payload: { id: q.id, status: "ready" },
                        });
                        await bank.refresh();
                      });
                  }}
                >
                  <Check size={16} />
                  Sudah ditelaah — siap dipakai
                </button>
              )}
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="Belum ada soal pada pilihan ini"
          detail="Tambahkan soal sendiri atau simpan draf dari Asisten AI."
        />
      )}
      {editing && (
        <Modal
          title={editing.id ? "Edit soal" : "Tambah soal"}
          onClose={() => setEditing(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget),
                options = ["a", "b", "c", "d", "e"]
                  .map((k) => String(f.get("option_" + k) || ""))
                  .filter(Boolean);
              void run(async () => {
                const q = validateQuestions([
                  {
                    question: f.get("question"),
                    options,
                    answer: Number(f.get("answer")),
                    topic: f.get("topic"),
                    level: f.get("level"),
                    explanation: f.get("explanation"),
                  },
                ])[0];
                await rpc("tka_action", {
                  action: "save_question",
                  payload: {
                    ...q,
                    id: editing.id,
                    subject: f.get("subject"),
                    status: "draft",
                  },
                });
                setEditing(null);
                await bank.refresh();
                notice("Soal disimpan sebagai draf.");
              });
            }}
          >
            <div className="form-grid">
              <Field label="Mata pelajaran">
                <SubjectPicker name="subject" defaultValue={editing.subject || profile.subject} />
              </Field>
              <Field label="Topik">
                <input name="topic" required defaultValue={editing.topic} />
              </Field>
            </div>
            <Field label="Level kognitif">
              <select name="level" defaultValue={editing.level}>
                <option value="L1">L1 · Pemahaman</option>
                <option value="L2">L2 · Aplikasi</option>
                <option value="L3">L3 · Penalaran</option>
              </select>
            </Field>
            <Field label="Pertanyaan">
              <textarea
                name="question"
                rows={4}
                required
                defaultValue={editing.question}
              />
            </Field>
            {["A", "B", "C", "D", "E"].map((l, i) => (
              <Field
                key={l}
                label={"Opsi " + l + (i === 4 ? " (opsional)" : "")}
              >
                <input
                  name={"option_" + l.toLowerCase()}
                  required={i < 4}
                  defaultValue={editing.options?.[i]}
                />
              </Field>
            ))}
            <Field label="Kunci">
              <select name="answer" defaultValue={editing.answer ?? 0}>
                {["A", "B", "C", "D", "E"].map((l, i) => (
                  <option value={i} key={l}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Pembahasan">
              <textarea
                name="explanation"
                required
                rows={4}
                defaultValue={editing.explanation}
              />
            </Field>
            <button className="primary" disabled={busy}>
              Simpan draf
            </button>
          </form>
        </Modal>
      )}
      {imported.length > 0 && (
        <Modal
          title={`Pratinjau import — ${imported.length} soal`}
          onClose={() => setImported([])}
        >
          <p>
            Semua soal akan disimpan sebagai draf. Data yang sudah ada tetap
            tersimpan.
          </p>
          {imported.slice(0, 10).map((q, i) => (
            <p key={i}>
              {i + 1}. {q.question}
            </p>
          ))}
          {imported.length > 10 && (
            <p>…dan {imported.length - 10} soal lainnya.</p>
          )}
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await rpc("tka_action", {
                  action: "import_questions",
                  payload: { questions: imported },
                });
                setImported([]);
                await bank.refresh();
                notice("Import berhasil. Telaah draf sebelum digunakan.");
              })
            }
          >
            Simpan {imported.length} draf
          </button>
        </Modal>
      )}
    </>
  );
}
