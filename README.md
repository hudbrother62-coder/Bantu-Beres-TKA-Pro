# Bantu Beres TKA Pro

Ruang guru dan siswa: bahan ajar, bank soal, project, paket tryout, penilaian server, analisis, ekspor dan GroqCloud BYOK. Nama dan logo mengikuti permintaan pemilik.

## Development
```sh
npm ci
npm test
npm run build
npm run dev
```

## Database and deployment
1. Create a dedicated Supabase project in the account chosen by the owner (**Tujuh akun**). Do not apply this schema to an unrelated existing product.
2. Run `supabase/schema.sql` once in SQL Editor. The schema keeps answer keys and AI credentials in `tka_private`, outside the default REST API schema. Authenticated requests use the authorized `tka_action` RPC.
3. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY` in Vercel. Use a publishable/anon key, never a service-role key.
4. Generate a random 32-byte hex `AI_ENCRYPTION_KEY` directly in a trusted terminal and set it as an encrypted Vercel variable. Keep this stable; rotation requires re-installing stored user keys.
5. In Supabase Auth, set Site URL to the actual production URL. Add the production URL as an allowed redirect. User-facing sign-up and login use username and password; do not reintroduce an email confirmation flow.
6. Deploy `main` through the linked Vercel project. Verify login, signup, teacher/student isolation and a full classroom tryout before inviting real users.

No database environment variable produces an explicit setup notice; authentication is never simulated. The project-creation connector returned `get_cost UNAVAILABLE` during initial setup, so database creation and live integration require completion before production usage.

## AI
Users install GroqCloud API keys via Settings → Pengaturan Groq AI. Open https://console.groq.com/keys, create an account or log in, choose Create API Key, name the key, copy the gsk_ key, paste it into TKA Pro, run model test, and save. Free usage is rate-limited. The server tests the selected model then encrypts the key with AES-256-GCM. Role/system instructions and configurable direction improve output; this is **not model fine-tuning**. Generated questions are structurally validated and remain drafts pending teacher review. Project sharing has a daily per-student limit and is disabled during an active project attempt.

## Current scope
Implemented: teacher/student accounts, private chat history, material editor/sharing, MCQ bank with draft/review/archive, Excel import preview/template, snapshot packages, scheduling, server timer/scoring, idempotent submission, project invitations, released results, topic analytics, individual practice, Word/PDF/Excel exports, responsive light/dark interface and text guides.

Launch limitations: no Android APK, dual-role switching, essay/complex-question scoring, student-account bulk provisioning, automatic adaptive study plan, document version restoration, offline-ready full app, or demo video until its link is supplied. PDF export is basic text layout; DOCX is the editable export for math-rich material. Groq models currently support text-only prompts in TKA Pro. Copy the relevant contents of images or PDFs as text. No official TKA curriculum compliance claim.

## Verification
Unit tests cover generation validation and blueprints. Embedded PostgreSQL tests cover real schema execution, ownership, hidden keys, teacher/student roles and server scoring. These do not substitute for Supabase Auth and GroqCloud live smoke tests with a connected database and a real user key.

AI configuration is read through the authenticated `tka_ai_context` RPC. No Supabase service-role key needs to be placed in client code.
