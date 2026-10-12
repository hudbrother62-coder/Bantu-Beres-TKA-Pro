export const SUBJECTS = [
  "Matematika", "Matematika Tingkat Lanjut", "Bahasa Indonesia",
  "Bahasa Indonesia Tingkat Lanjut", "Bahasa Inggris",
  "Bahasa Inggris Tingkat Lanjut", "IPA", "IPS", "IPAS",
  "Fisika", "Kimia", "Biologi", "Ekonomi", "Sejarah",
  "Sosiologi", "Geografi", "Informatika", "Pendidikan Pancasila",
  "Pendidikan Agama", "PJOK", "Seni Budaya", "Prakarya",
  "Kewirausahaan", "Bahasa Arab", "Bahasa Jepang", "Bahasa Jawa",
] as const;

// "Kejuruan" is a category, not a subject. Each vocational teacher names the actual subjects.
export function isListedSubject(value: string): boolean {
  return (SUBJECTS as readonly string[]).includes(value);
}
export function normalizeSubjectList(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  const list: string[] = [];
  for (const item of items) {
    if (typeof item !== "string") continue;
    const value = item.trim().replace(/\s+/g, " ");
    const key = value.toLocaleLowerCase("id-ID");
    if (value.length < 2 || value.length > 100 || seen.has(key) || value === "Dasar Kejuruan / SMK") continue;
    seen.add(key);
    list.push(value);
    if (list.length >= 20) break;
  }
  return list;
}
export function profileSubjects(profile: { subject: string; subjects?: string[] }): string[] {
  const list = normalizeSubjectList(profile.subjects);
  return list.length ? list : normalizeSubjectList([profile.subject]);
}
