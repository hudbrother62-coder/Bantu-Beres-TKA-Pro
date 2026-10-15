import { recommendedModels, explainGoogleError } from "../src/lib/gemini-errors.js";
import { groqChat, GROQ_MODELS, GROQ_DEFAULT_MODEL, toStoredModel } from "../src/lib/ai-providers.js";
export const config = { maxDuration: 60 };
import {
  authorized,
  action,
  encrypt,
  gemini,
  errorMessage,
  type Request,
  type Response,
} from "./_shared.js";
export default async function handler(req: Request, res: Response) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.status(405).json({ error: "Metode tidak didukung." });
    return;
  }
  try {
    const db = await authorized(req);
    if (req.body.remove) {
      await action(db, "delete_ai");
      res.status(200).json({ ok: true });
      return;
    }
    const apiKey = String(req.body.apiKey || "").trim();
    const model = String(req.body.model || "gemini-3.5-flash-lite").trim();
    if (apiKey.length < 20 || apiKey.length > 250)
      throw new Error("API key Gemini harus diambil dari Google AI Studio.");
    const provider = String(req.body.provider || "gemini");
    if (provider !== "gemini" && provider !== "groq")
      throw new Error("Penyedia AI tidak didukung.");
    if (provider === "groq") {
      if (req.body.autoDetect === true || req.body.listModels === true) {
        const candidates = [...GROQ_MODELS];
        const failures: string[] = [];
        for (const candidate of candidates) {
          try {
            const result = await groqChat(apiKey, candidate, "Balas singkat dalam bahasa Indonesia.",
              [{role: "user", content: "Jawab satu kata: BERHASIL"}]);
            if (result.trim()) {
              res.status(200).json({model: candidate, models: candidates,
                message: "Groq berhasil menghasilkan jawaban dengan " + candidate + ". Klik Tes koneksi & simpan."});
              return;
            }
          } catch (reason) {
            failures.push(candidate + ": " + (reason instanceof Error ? reason.message : "Gagal."));
          }
        }
        throw new Error("Tidak ada model Groq yang lolos uji. " + failures.join("; ").slice(0,450));
      }
      const groqModel = String(req.body.model || GROQ_DEFAULT_MODEL);
      await groqChat(apiKey, groqModel, "Balas singkat dalam bahasa Indonesia.",
        [{role: "user", content: "Jawab satu kata: BERHASIL"}]);
      await action(db, "save_ai", {
        encrypted_key: encrypt(apiKey),
        model: toStoredModel("groq", groqModel),
        direction: String(req.body.direction || "Jelas, terstruktur dan sesuai jenjang siswa.").slice(0,1000),
      });
      res.status(200).json({ok: true,
        message: "Groq berhasil terhubung. API key tersimpan terenkripsi dan siap digunakan di generator."});
      return;
    }
    if (req.body.listModels === true || req.body.autoDetect === true) {
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=100", {
        method: "GET",
        headers: { "x-goog-api-key": apiKey },
        signal: AbortSignal.timeout(12000),
      });
      const result = await response.json().catch(() => ({})) as {
        models?: { name?: string; supportedGenerationMethods?: string[] }[];
      };
      if (!response.ok) throw new Error(explainGoogleError(response.status, result));
      const models = recommendedModels((result.models || [])
        .filter(m => m.supportedGenerationMethods?.includes("generateContent"))
        .map(m => String(m.name || "").replace("models/", "")));
      if (!models.length)
        throw new Error("Tidak ada model teks generateContent yang tersedia untuk API key ini.");
      if (req.body.autoDetect === true) {
        // Real generate requests are required: listModels alone does not prove permission.
        // Limit cost and latency: probe at most four models, one tiny prompt each.
        const failures: string[] = [];
        const candidates = models.slice(0, 4);
        for (const candidate of candidates) {
          try {
            const probe = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(candidate)}:generateContent`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
                body: JSON.stringify({
                  contents: [{ role: "user", parts: [{text:"Jawab satu kata: OK"}] }],
                  generationConfig: { maxOutputTokens: 384 },
                }),
                signal: AbortSignal.timeout(8500),
              },
            );
            const responseBody = await probe.json().catch(() => ({}));
            if (!probe.ok) {
              failures.push(candidate + ": " + explainGoogleError(probe.status, responseBody, candidate));
              continue;
            }
            const text = responseBody?.candidates?.[0]?.content?.parts
              ?.map((p: { text?: string }) => p.text || "").join("").trim();
            if (!text) {
              failures.push(candidate + ": respons kosong dari Google");
              continue;
            }
            res.status(200).json({
              models, model: candidate,
              message: "Model " + candidate + " berhasil diuji melalui generateContent. Klik Tes koneksi & simpan untuk menyimpan key terenkripsi.",
            });
            return;
          } catch {
            failures.push(candidate + ": permintaan tidak selesai tepat waktu");
          }
        }
        const forbidden = failures.filter(f => f.includes("(403)"));
        throw new Error(forbidden.length === candidates.length
          ? "Semua model yang diuji ditolak Google (403), termasuk model ringan. Periksa izin dan pembatasan API key atau project Google; mengganti model saja tidak cukup."
          : "Tidak ada model yang berhasil diuji. " + failures.slice(0, 2).join("; ").slice(0, 380));
      }
      res.status(200).json({
        models,
        message: "Daftar model ditemukan. Pilih model, kemudian tes koneksi untuk memastikan izin.",
      });
      return;
    }
    await gemini(apiKey, model, {
      contents: [
        { role: "user", parts: [{ text: "Jawab hanya: koneksi berhasil" }] },
      ],
      generationConfig: {
        maxOutputTokens: 256,
        ...(/^gemini-3\./.test(model) ? { thinkingConfig: { thinkingLevel: "low" } } : {}),
      },
    });
    await action(db, "save_ai", {
      encrypted_key: encrypt(apiKey),
      model: toStoredModel("gemini", model),
      direction: String(
        req.body.direction || "Jelas, terstruktur, sesuai jenjang siswa.",
      ).slice(0, 1000),
    });
    res
      .status(200)
      .json({
        ok: true,
        message: "Koneksi berhasil. API key tersimpan terenkripsi.",
      });
  } catch (e) {
    res.status(400).json({ error: errorMessage(e) });
  }
}
