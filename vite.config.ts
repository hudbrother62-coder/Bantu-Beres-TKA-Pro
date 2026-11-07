import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1200, rollupOptions: { input: { main: fileURLToPath(new URL('./index.html', import.meta.url)), recovery: fileURLToPath(new URL('./recovery.html', import.meta.url)) } } },
});
