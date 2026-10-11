export const SUBJECTS = [
  "Matematika", "Matematika Tingkat Lanjut", "Bahasa Indonesia",
  "Bahasa Indonesia Tingkat Lanjut", "Bahasa Inggris",
  "Bahasa Inggris Tingkat Lanjut", "IPA", "IPS", "IPAS",
  "Fisika", "Kimia", "Biologi", "Ekonomi", "Sejarah",
  "Sosiologi", "Geografi", "Informatika", "Pendidikan Pancasila",
  "Pendidikan Agama", "PJOK", "Seni Budaya", "Prakarya",
  "Kewirausahaan", "Bahasa Arab", "Bahasa Jepang", "Bahasa Jawa",
  "Dasar Kejuruan / SMK",
] as const;
export function isListedSubject(value: string): boolean {
  return (SUBJECTS as readonly string[]).includes(value);
}
