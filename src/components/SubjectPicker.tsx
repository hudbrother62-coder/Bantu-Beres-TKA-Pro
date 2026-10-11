import { useState } from "react";
import { SUBJECTS, isListedSubject } from "../lib/subjects";
type Props = { name?: string; defaultValue?: string; value?: string; onChange?: (s: string) => void };
export function SubjectPicker({ name, defaultValue = "Matematika", value, onChange }: Props) {
  const [internal, setInternal] = useState(defaultValue);
  const subject = value === undefined ? internal : value;
  const listed = isListedSubject(subject);
  function choose(s: string) { if (onChange) onChange(s); else setInternal(s); }
  return <div className="subject-picker">
    <select value={listed ? subject : "__custom"} name={listed ? name : undefined} required
      aria-label="Pilih mata pelajaran" onChange={e => choose(e.target.value === "__custom" ? "" : e.target.value)}>
      {SUBJECTS.map(s => <option value={s} key={s}>{s}</option>)}
      <option value="__custom">Lainnya — tulis sendiri</option>
    </select>
    {!listed && <input name={name} required maxLength={100} value={subject}
      onChange={e => choose(e.target.value)} aria-label="Mata pelajaran khusus"
      placeholder="Tulis mata pelajaran sendiri" />}
  </div>;
}
