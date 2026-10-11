import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./style.css";

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError(): { error: boolean } { return { error: true }; }
  componentDidCatch(error: Error) { console.error("TKA Pro UI error:", error.message); }
  render() {
    if (this.state.error) return (
      <div className="recovery-page" role="alert">
        <div className="recovery-card">
          <img src="/logo.png" alt="Bantu Beres TKA Pro" width="54" height="54" />
          <h1>Tampilan mengalami kendala</h1>
          <p>Data akun tidak dihapus. Muat ulang aplikasi untuk mencoba kembali.</p>
          <button className="primary" onClick={() => window.location.reload()}>
            Muat ulang aplikasi
          </button>
          <p className="muted">Jika masalah berulang, periksa koneksi atau coba kembali beberapa saat lagi.</p>
        </div>
      </div>
    );
    return this.props.children;
  }
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppErrorBoundary><App /></AppErrorBoundary>
  </React.StrictMode>,
);
