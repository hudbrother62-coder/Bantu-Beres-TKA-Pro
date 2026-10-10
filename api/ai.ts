import { aiConfig } from "./_shared";
import {
  authorized,
  action,
  decrypt,
  gemini,
  errorMessage,
  type Request,
  type Response,
} from "./_shared";
import { buildSystemPrompt, validateQuestions } from "../src/lib/core";
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
    const apiKey = decrypt(cfg.encrypted_key);
    const instruction = buildSystemPrompt({
      role: cfg.role,
      grade: cfg.grade,
      subject: cfg.subject,
      direction: cfg.direction,
      mode,
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
        temperature: mode === "questions" ? 0.3 : 0.5,
        maxOutputTokens: 12000,
        ...(mode === "questions"
          ? { responseMimeType: "application/json" }
          : {}),
      },
    };
    const text = await gemini(apiKey, cfg.model, body);
    if (mode === "questions") {
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error(
          "Format keluaran AI belum valid. Kurangi jumlah soal dan coba kembali.",
        );
      }
      const questions = validateQuestions(parsed.questions);
      res
        .status(200)
        .json({
          text: `${questions.length} draf soal berhasil dibuat. Telaah kunci dan pembahasan sebelum dipakai.`,
          questions,
        });
    } else res.status(200).json({ text });
  } catch (e) {
    res.status(400).json({ error: errorMessage(e) });
  }
}
