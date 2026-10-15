import { recommendedModels, explainGoogleError } from "../src/lib/gemini-errors.js";
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
    const model = String(req.body.model || "gemini-3.8-flash").trim();
    if (apiKey.length < 20 || apiKey.length > 250)
      throw new Error("API key Gemini harus diambil dari Google AI Studio.");
    if (req.body.listModels === true) {
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=100", {
        method: "GET",
        headers: { "x-goog-api-key": apiKey },
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json().catch(() => ({})) as {
        models?: { name?: string; supportedGenerationMethods?: string[] }[];
      };
      if (!response.ok) throw new Error(explainGoogleError(response.status, result));
      const models = recommendedModels((result.models || [])
        .filter(m => m.supportedGenerationMethods?.includes("generateContent"))
        .map(m => String(m.name || "").replace(/^models\//, "")));
      if (!models.length)
        throw new Error("Google menerima key, tetapi tidak mengembalikan model generateContent yang cocok.");
      res.status(200).json({
        models,
        message: "Daftar model tersedia ditemukan. Pilih model, kemudian tes generate untuk memastikan izin.",
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
      model,
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
