import {
  authorized,
  action,
  encrypt,
  gemini,
  errorMessage,
  type Request,
  type Response,
} from "./_shared";
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
    const apiKey = String(req.body.apiKey || "").trim(),
      model = String(req.body.model || "gemini-3.8-flash");
    if (apiKey.length < 20 || apiKey.length > 250)
      throw new Error("Masukkan API key yang valid.");
    await gemini(apiKey, model, {
      contents: [
        { role: "user", parts: [{ text: "Jawab hanya: koneksi berhasil" }] },
      ],
      generationConfig: { maxOutputTokens: 64 },
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
