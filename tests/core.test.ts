import test from "node:test";
import assert from "node:assert/strict";
import {
  validateQuestions,
  composePackage,
  scoreAnswers,
  buildSystemPrompt,
} from "../src/lib/core.ts";
test("AI questions reject placeholder, missing key and duplicated choices", () => {
  assert.throws(() =>
    validateQuestions([
      {
        question: "[Contoh butir MAT-01]",
        options: ["a", "b", "c", "d"],
        answer: 0,
        topic: "Aljabar",
        level: "L2",
        explanation: "x",
      },
    ]),
  );
  assert.throws(() =>
    validateQuestions([
      {
        question: "Berapa hasil 2+2?",
        options: ["4", "4"],
        answer: 0,
        topic: "Aljabar",
        level: "L2",
        explanation: "4",
      },
    ]),
  );
});
test("valid generated questions remain draft and strip extra fields", () => {
  const q = validateQuestions([
    {
      question: "Berapa hasil 2+2?",
      options: ["3", "4", "5", "6"],
      answer: 1,
      topic: "Bilangan",
      level: "L1",
      explanation: "Dua ditambah dua adalah empat.",
      status: "ready",
    },
  ]);
  assert.equal(q[0].status, "draft");
  assert.equal(q[0].answer, 1);
});
test("blueprint rejects inconsistent counts and insufficient stock", () => {
  assert.throws(() => composePackage([], 2, { L1: 1, L2: 0, L3: 0 }));
  assert.throws(() => composePackage([], 2, { L1: 1, L2: 1, L3: 0 }));
});
test("scores skipped questions as wrong and is order-independent", () => {
  assert.deepEqual(
    scoreAnswers(
      [
        { id: "a", answer: 1 },
        { id: "b", answer: 0 },
      ],
      { b: 0 },
    ),
    { correct: 1, total: 2, score: 50 },
  );
});
test("student instruction separates study from exam and treats source as data", () => {
  const p = buildSystemPrompt({
    role: "student",
    grade: "XII",
    subject: "Matematika",
    direction: "Ringkas",
    mode: "chat",
  });
  assert.match(p, /petunjuk/i);
  assert.match(p, /dokumen.*data/i);
  assert.match(p, /ujian/i);
});


test("question prompt respects per-request subject, count, and depth", () => {
  const prompt = buildSystemPrompt({
    role: "teacher", grade: "XII SMA", subject: "Bahasa Inggris Tingkat Lanjut",
    direction: "Tulis alami", mode: "questions", questionCount: 6,
    difficulty: "L3", topic: "reading inference",
  });
  assert.match(prompt, /Bahasa Inggris Tingkat Lanjut/);
  assert.match(prompt, /TEPAT 6 soal/);
  assert.match(prompt, /level L3/);
  assert.match(prompt, /reading inference/);
});
test("generated content cannot contain repeated or shallow questions", async () => {
  const { validateGeneratedQuestions } = await import("../src/lib/core.ts");
  const sample = {
    question: "Seorang siswa menganalisis data penjualan. Pernyataan manakah yang tepat?",
    options: ["A adalah benar", "B adalah benar", "C adalah benar", "D adalah benar"],
    answer: 2, topic: "Statistika", level: "L2",
    explanation: "Analisis data memperlihatkan opsi C konsisten terhadap semua perubahan pada grafik dan nilai.",
  };
  assert.equal(validateGeneratedQuestions([sample]).length, 1);
  assert.throws(() => validateGeneratedQuestions([sample, sample]));
  assert.throws(() => validateGeneratedQuestions([{ ...sample, explanation: "Benar." }]));
});

test("username identifiers are normalized consistently without a contact email", async () => {
  const { normalizeUsername, usernameEmail } = await import("../src/lib/username.ts");
  assert.equal(normalizeUsername("  GuruSMA01  "), "gurusma01");
  assert.equal(usernameEmail(" Siswa.01 "), "siswa.01@users.tka-pro.invalid");
  assert.throws(() => usernameEmail("bad email"));
  assert.throws(() => usernameEmail("ab"));
});

test("vocational subjects are individual subjects, deduplicated, and preserved", async () => {
  const { SUBJECTS, normalizeSubjectList, profileSubjects } = await import("../src/lib/subjects.ts");
  assert.ok(!SUBJECTS.includes("Dasar Kejuruan / SMK" as never));
  assert.deepEqual(normalizeSubjectList(["Pemrograman Web", " Akuntansi Dasar ", "pemrograman web", "Dasar Kejuruan / SMK"]),
    ["Pemrograman Web", "Akuntansi Dasar"]);
  assert.deepEqual(profileSubjects({ subject: "Matematika", subjects: ["Teknik Sepeda Motor", "Bahasa Indonesia"] }),
    ["Teknik Sepeda Motor", "Bahasa Indonesia"]);
  assert.deepEqual(profileSubjects({ subject: "Fisika" }), ["Fisika"]);
});

test("Google Gemini errors are specific and models are sorted", async () => {
  const { explainGoogleError, recommendedModels } = await import("../src/lib/gemini-errors.ts");
  assert.match(explainGoogleError(400, {error:{message:"API key not valid",details:[{reason:"API_KEY_INVALID"}]}}), /API key tidak valid/i);
  assert.match(explainGoogleError(400, {error:{message:"Invalid generationConfig"}}), /format permintaan/i);
  assert.match(explainGoogleError(403, {error:{status:"PERMISSION_DENIED"}}), /ditolak/i);
  assert.match(explainGoogleError(404, {error:{status:"NOT_FOUND"}},"gemini-3.8-flash"), /3.8-flash/i);
  assert.match(explainGoogleError(429, {error:{status:"RESOURCE_EXHAUSTED"}}), /Kuota/i);
  assert.deepEqual(recommendedModels(["gemini-3.5-flash-lite","gemini-3.8-flash","gemini-3.8-flash","gemini-3.8-live"]),
    ["gemini-3.5-flash-lite","gemini-3.8-flash"]);
});

test("403 Google Gemini project restrictions are distinct from unavailable models", async () => {
 const { explainGoogleError, recommendedModels } = await import("../src/lib/gemini-errors.ts");
 assert.match(explainGoogleError(403,{error:{message:"Your project has been denied access"}}),/memblokir akses project/i);
 assert.match(explainGoogleError(403,{error:{message:"API key referrer restrictions"}}),/API restrictions/i);
 assert.equal(recommendedModels(["gemini-3.8-flash","gemini-3.1-flash-lite"])[0],"gemini-3.1-flash-lite");
});
