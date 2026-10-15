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

test("TKA Pro only accepts Groq configuration, including old account migration", async () => {
  const { toStoredModel, modelFromStoredModel, GROQ_DEFAULT_MODEL } =
    await import("../src/lib/ai-providers.ts");
  assert.equal(toStoredModel(GROQ_DEFAULT_MODEL), "groq:openai/gpt-oss-20b");
  assert.equal(modelFromStoredModel("groq:openai/gpt-oss-20b"), GROQ_DEFAULT_MODEL);
  assert.throws(() => modelFromStoredModel("gemini-2.5-flash"), /Pengaturan AI lama/);
  assert.throws(() => toStoredModel("unsupported"));
});
test("Groq chat sends JSON questions safely and returns model reply", async () => {
 const { groqChat, describeGroqError } = await import("../src/lib/ai-providers.ts");
 let calls = 0;
 const mockFetch = (async (input: RequestInfo|URL, init?:RequestInit) => {
  calls++;
  assert.equal(String(input),"https://api.groq.com/openai/v1/chat/completions");
  assert.equal(init?.method,"POST");
  assert.equal((init?.headers as Record<string,string>).Authorization,"Bearer dummy-test-key");
  const request = JSON.parse(String(init?.body));
  assert.equal(request.model,"openai/gpt-oss-20b");
  assert.equal(request.messages[0].role,"system");
  assert.equal(request.messages[1].content,"Buat 1 soal.");
  assert.equal(request.response_format.type,"json_object");
  return new Response(JSON.stringify({choices:[{message:{content:'{"questions":[{"question":"Contoh"}]}'}}]}),{status:200});
 }) as typeof fetch;
 const output = await groqChat("dummy-test-key","openai/gpt-oss-20b",
   "Jawab JSON saja",[{role:"user",content:"Buat 1 soal."}],true,mockFetch);
 assert.equal(calls,1);
 assert.match(output,/questions/);
 assert.match(describeGroqError(429,{}),/Kuota gratis/);
});
test("Groq returns clear invalid-credentials errors without leaking key", async () => {
 const { groqChat } = await import("../src/lib/ai-providers.ts");
 const mockFetch = (async () =>
   new Response(JSON.stringify({error:{message:"Invalid API Key"}}),{status:401})) as typeof fetch;
 await assert.rejects(
   groqChat("do-not-log-secret","openai/gpt-oss-20b","test",[{role:"user",content:"tes"}],false,mockFetch),
   /API key Groq tidak valid/,
 );
});


test("Guide embeds supplied YouTube video and provides accessible fallback link", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../src/components/Settings.tsx", import.meta.url), "utf8");
  assert.match(src, /youtube-nocookie\\.com\\/embed\\/8iHwQ19dIeQ/);
  assert.match(src, /href="https:\\/\\/youtu\\.be\\/8iHwQ19dIeQ"/);
  assert.match(src, /loading="lazy"/);
  assert.match(src, /allowFullScreen/);
  assert.doesNotMatch(src, /Video demo akan ditambahkan/);
});
