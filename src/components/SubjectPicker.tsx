import { useState } from "react";
import { SUBJECTS, normalizeSubjectList } from "../lib/subjects";

type PickerProps = {
  name?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (subject: string) => void;
  extraSubjects?: readonly string[];
};
export function SubjectPicker({
  name, defaultValue = "Matematika", value, onChange, extraSubjects = [],
}: PickerProps) {
  const [internal, setInternal] = useState(defaultValue);
  const subject = value === undefined ? internal : value;
  const choices = normalizeSubjectList([...SUBJECTS, ...extraSubjects]);
  const listed = choices.includes(subject);
  function change(next: string) {
    if (onChange) onChange(next);
    else setInternal(next);
  }
  return <div className="subject-picker">
    <select
      value={listed ? subject : "__custom"}
      name={listed ? name : undefined}
      required
      aria-label="Pilih mata pelajaran"
      onChange={e => change(e.target.value === "__custom" ? "" : e.target.value)}
    >
      {choices.map(s => <option key={s} value={s}>{s}</option>)}
      <option value="__custom">Mata pelajaran lain — tulis sendiri</option>
    </select>
    {!listed && <input
      name={name}
      required
      maxLength={100}
      value={subject}
      onChange={e => change(e.target.value)}
      aria-label="Nama mata pelajaran khusus"
      placeholder="Contoh: Teknik Kendaraan Ringan"
    />}
  </div>;
}

type TeacherProps = {
  name?: string;
  primaryName?: string;
  defaultValue?: string[];
};
export function TeacherSubjects({ name = "subjects", primaryName = "subject", defaultValue = [] }: TeacherProps) {
  const [items, setItems] = useState(() => normalizeSubjectList(defaultValue));
  const [pick, setPick] = useState("");
  const [custom, setCustom] = useState("");
  const [message, setMessage] = useState("");
  function add(raw: string) {
    const text = raw.trim().replace(/\s+/g, " ");
    if (text.length < 2 || text.length > 100 || text === "Dasar Kejuruan / SMK") {
      setMessage("Tulis nama mata pelajaran yang sebenarnya (2–100 karakter).");
      return;
    }
    if (items.some(s => s.toLocaleLowerCase("id-ID") === text.toLocaleLowerCase("id-ID"))) {
      setMessage("Mata pelajaran ini sudah tercantum.");
      return;
    }
    if (items.length >= 20) { setMessage("Maksimal 20 mata pelajaran."); return; }
    setItems(current => [...current, text]);
    setPick(""); setCustom(""); setMessage("");
  }
  return <div className="teacher-subjects">
    <p className="muted">Kelola mapel yang Anda ampu. Untuk SMK, tulis nama mapel kejuruan satu per satu; semua mapel akan tersimpan dalam akun yang sama.</p>
    <div className="teacher-subject-input">
      <select value={pick} onChange={e => setPick(e.target.value)} aria-label="Daftar mata pelajaran umum">
        <option value="">Pilih mata pelajaran umum</option>
        {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <button type="button" onClick={() => add(pick)} disabled={!pick}>Tambah</button>
    </div>
    <div className="teacher-subject-input">
      <input value={custom} onChange={e => setCustom(e.target.value)}
        maxLength={100} placeholder="Tulis mapel kejuruan / lainnya, mis. Pemrograman Web"
        aria-label="Tulis mata pelajaran sendiri"
        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(custom); } }}
      />
      <button type="button" onClick={() => add(custom)} disabled={!custom.trim()}>Tambah</button>
    </div>
    <div className="teacher-subject-chips" aria-live="polite">
      {items.length ? items.map((subject, i) => (
        <span className="teacher-subject-chip" key={subject}>
          {i === 0 ? "Utama: " : ""}{subject}
          <button type="button" aria-label={"Hapus " + subject}
            onClick={() => setItems(old => old.filter((_, j) => j !== i))}>×</button>
        </span>
      )) : <small className="muted">Belum ada mata pelajaran. Tambahkan minimal satu.</small>}
    </div>
    {message && <small className="subject-validation" role="alert">{message}</small>}
    <input type="hidden" name={name} value={JSON.stringify(items)} />
    <input type="hidden" name={primaryName} value={items[0] || ""} />
  </div>;
}
