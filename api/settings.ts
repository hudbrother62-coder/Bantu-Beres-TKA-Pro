import { groqChat, GROQ_MODELS, GROQ_DEFAULT_MODEL, toStoredModel } from "../src/lib/ai-providers.js";
import { authorized, action, encrypt, errorMessage, type Request, type Response } from "./_shared.js";

export const config = { maxDuration: 60 };

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
    if (apiKey.length < 20 || apiKey.length > 250)
      throw new Error("Masukkan API key GroqCloud yang valid dari console.groq.com/keys.");
    if (!apiKey.startsWith("gsk_"))
      throw new Error("Ini bukan format API key GroqCloud. Key biasanya diawali gsk_. Jangan gunakan key dari Google AI Studio.");

    const direction = String(
      req.body.direction || "Jelas, terstruktur dan sesuai jenjang siswa."
    ).slice(0, 1000);

    if (req.body.autoDetect === true) {
      const failed: string[] = [];
      for (const candidate of GROQ_MODELS) {
        try {
          await groqChat(
            apiKey, candidate, "Balas singkat dalam bahasa Indonesia.",
            [{ role: "user", content: "Jawab hanya satu kata: BERHASIL" }],
            false, fetch, 14000
          );
          res.status(200).json({
            model: candidate,
            models: [...GROQ_MODELS],
            message: "Koneksi Groq berhasil dengan model " + candidate +
              ". Tekan Tes koneksi & simpan untuk menyimpan API key.",
          });
          return;
        } catch (reason) {
          failed.push(candidate + ": " +
            (reason instanceof Error ? reason.message : "Permintaan gagal."));
        }
      }
      throw new Error("Tidak ada model Groq yang berhasil diuji. " +
        failed.join("; ").slice(0, 420));
    }

    const model = String(req.body.model || GROQ_DEFAULT_MODEL);
    const storedModel = toStoredModel(model);
    await groqChat(
      apiKey, model, "Balas singkat dalam bahasa Indonesia.",
      [{ role: "user", content: "Jawab hanya satu kata: BERHASIL" }],
      false, fetch, 20000
    );
    await action(db, "save_ai", {
      encrypted_key: encrypt(apiKey),
      model: storedModel,
      direction,
    });
    res.status(200).json({
      ok: true,
      model,
      message: "Groq berhasil diuji. API key tersimpan terenkripsi; generator AI siap digunakan.",
    });
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
}
