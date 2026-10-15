import { aiConfig } from "./_shared.js";
import {
  authorized,
  action,
  decrypt,
  gemini,
  errorMessage,
  type Request,
  type Response,
} from "./_shared.js";
import { buildSystemPrompt, validateGeneratedQuestions } from "../src/lib/core.js";
import { groqChat, modelFromStoredModel, providerFromStoredModel } from "../src/lib/ai-providers.js";
export const config = { maxDuration: 60 };
export default async function handler(req: Request, res: Response) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.status(405).json({ error: "Metode tidak didukung." });
    return;
  }
  try {
    const db = await authorized(req);
    const mode = String(req.body.mode || "chat");
    if (!["chat", "questions", "material", "analysis"].includes(mode))
      throw new Error("Mode AI tidak valid.");
    const messages = req.body.messages as { role: string; content: string }[];
    if (
      !Array.isArray(messages) ||
      !messages.length ||
      messages.length > 40 ||
      messages.some(
        (m) =>
          !["user", "assistant"].includes(m.role) ||
          typeof m.content !== "string",
      ) ||
      JSON.stringify(req.body).length > 180000
    )
      throw new Error("Permintaan terlalu panjang atau tidak valid.");
    const cfg = await aiConfig(db, {
      class_id: req.body.classId || null,
    });
    const requestedSubject = typeof req.body.subject === "string" ? req.body.subject.trim() : "";
    if (requestedSubject.length > 100) throw new Error("Nama mata pelajaran terlalu panjang.");
    const questionCount = Number(req.body.questionCount ?? 5);
    if (mode === "questions" && (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > 20))
      throw new Error("Jumlah generate soal harus 1–20 per proses.");
    const difficulty = String(req.body.difficulty ?? "mixed");
    if (!["mixed", "L1", "L2", "L3"].includes(difficulty)) throw new Error("Tingkat kesulitan tidak valid.");
    const topic = typeof req.body.topic === "string" ? req.body.topic.trim().slice(0, 150) : "";
    const apiKey = decrypt(cfg.encrypted_key);
    const instruction = buildSystemPrompt({
      role: cfg.role,
      grade: cfg.grade,
      subject: requestedSubject || cfg.subject,
      direction: cfg.direction,
      mode,
      questionCount,
      topic,
      difficulty: difficulty as "mixed" | "L1" | "L2" | "L3",
    });
    const attachment = req.body.attachment as
      | { data: string; mimeType: string }
      | undefined;
    if (
      attachment &&
      (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(
        attachment.mimeType,
      ) ||
        attachment.data.length > 150000)
    )
      throw new Error(
        "Lampiran maksimal sekitar 100 KB untuk pengiriman langsung. Gunakan teks untuk dokumen lebih besar.",
      );
    const contents = messages
      .slice(-16)
      .map((m, i, arr) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [
          { text: m.content.slice(0, 20000) },
          ...(attachment && i === arr.length - 1
            ? [
                {
                  inlineData: {
                    mimeType: attachment.mimeType,
                    data: attachment.data,
                  },
                },
              ]
            : []),
        ],
      }));
    const body = {
      systemInstruction: { parts: [{ text: instruction }] },
      contents,
      generationConfig: {
        // Gemini 3+ no longer accepts older sampling controls in this API.
        ...(/^gemini-(3|4)[.-]/.test(String(cfg.model))
          ? {}
          : { temperature: mode === "questions" ? 0.3 : 0.5 }),
        maxOutputTokens: 12000,
        ...(mode === "questions"
          ? { responseMimeType: "application/json" }
          : {}),
      },
    };
    const provider = providerFromStoredModel(String(cfg.model));
    const model = modelFromStoredModel(String(cfg.model));
    if (provider === "groq" && attachment) {
      throw new Error("Model Groq gratis yang dipilih mendukung teks saja. Hapus lampiran gambar/PDF atau salin isinya ke kolom dokumen sumber.");
    }
    const text = provider === "groq"
      ? await groqChat(apiKey, model, instruction,
          messages.slice(-12).map(m => ({role:m.role,content:m.content})), mode === "questions")
      : await gemini(apiKey, model, body);
    if (mode === "questions") {
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error(
          "Format keluaran AI belum valid. Kurangi jumlah soal dan coba kembali.",
        );
      }
      const questions = validateGeneratedQuestions(parsed.questions);
      if (questions.length > questionCount) throw new Error("AI membuat terlalu banyak soal. Coba kurangi jumlahnya.");
      res
        .status(200)
        .json({
          text: `${questions.length} dari ${questionCount} draf soal ${requestedSubject || cfg.subject} dibuat. ${questions.length === questionCount ? "" : "Jumlah belum sesuai target; coba ulang dengan topik lebih spesifik. "}Telaah akurasi kunci dan pembahasannya sebelum dipakai.`,
          questions,
        });
    } else res.status(200).json({ text });
  } catch (e) {
    res.status(400).json({ error: errorMessage(e) });
  }
}
