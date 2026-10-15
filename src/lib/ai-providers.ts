export const GROQ_MODELS = ["openai/gpt-oss-20b", "openai/gpt-oss-120b"] as const;
export const GROQ_DEFAULT_MODEL = GROQ_MODELS[0];

export function toStoredModel(model: string): string {
  if (!(GROQ_MODELS as readonly string[]).includes(model))
    throw new Error("Model Groq tidak didukung untuk TKA Pro.");
  return "groq:" + model;
}
export function modelFromStoredModel(stored: string): string {
  if (!stored.startsWith("groq:"))
    throw new Error("Pengaturan AI lama tidak didukung. Pasang API key GroqCloud melalui Pengaturan AI.");
  const model = stored.slice("groq:".length);
  if (!(GROQ_MODELS as readonly string[]).includes(model))
    throw new Error("Model Groq tidak tersedia. Pilih model lain pada Pengaturan AI.");
  return model;
}
export function describeGroqError(status: number, body: unknown): string {
  const payload = body && typeof body === "object" && "error" in body
    ? (body as {error?: {type?: string; code?: string; message?: string}}).error
    : undefined;
  const message = String(payload?.message || "").slice(0, 240);
  if (status === 401) return "API key Groq tidak valid atau kedaluwarsa (401). Buat key baru di GroqCloud Console.";
  if (status === 403) return "Groq menolak izin API key atau project (403). Periksa key dan status akun GroqCloud.";
  if (status === 404) return "Model Groq tidak tersedia (404). Coba model lain yang disediakan aplikasi.";
  if (status === 429) return "Kuota gratis Groq tercapai (429). Tunggu sampai kuota pulih, lalu coba kembali.";
  if (status === 400) return "Groq menolak format permintaan (400). " + (message || "Periksa kompatibilitas model dan keluaran JSON.");
  if (status >= 500) return "Server Groq sedang bermasalah (" + status + "). Coba lagi setelah beberapa saat.";
  return "Koneksi Groq gagal (HTTP " + status + "). " + message;
}
type ChatMessage = {role: "system" | "user" | "assistant"; content: string};
export function groqRequest(
  model: string,
  system: string,
  messages: {role: string;content:string}[],
  jsonMode: boolean,
) {
  if (!(GROQ_MODELS as readonly string[]).includes(model))
    throw new Error("Model Groq tidak tersedia untuk TKA Pro.");
  return {
    model,
    messages: [
      {role:"system", content: system} as ChatMessage,
      ...messages.map(m => ({
        role: m.role === "assistant" ? "assistant" as const : "user" as const,
        content: String(m.content).slice(0,20000),
      })),
    ],
    temperature: 0.3,
    max_completion_tokens: jsonMode ? 7500 : 3500,
    reasoning_effort: "low",
    reasoning_format: "hidden",
    ...(jsonMode ? {response_format: {type:"json_object" as const}} : {}),
  };
}
export async function groqChat(
  key: string,
  model: string,
  system: string,
  messages: {role: string;content:string}[],
  jsonMode = false,
  fetcher: typeof fetch = fetch,
  timeoutMs = 55000,
): Promise<string> {
  const payload = groqRequest(model, system, messages, jsonMode);
  const response = await fetcher("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {"Content-Type": "application/json", Authorization: "Bearer " + key},
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const raw: unknown = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(describeGroqError(response.status, raw));
  const text = (raw as {choices?:{message?:{content?:string}}[]}).choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Groq tidak memberikan jawaban. Coba ulang dengan permintaan lebih singkat.");
  return text;
}
