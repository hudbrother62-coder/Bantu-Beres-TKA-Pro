import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { X, LoaderCircle, Inbox } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { rpc } from "../lib/db";
export const NoticeContext = createContext<
  (message: string, error?: boolean) => void
>(() => {});
export const useNotice = () => useContext(NoticeContext);
export function Rich({ text }: { text: string }) {
  return (
    <div className="rich">
      <Markdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
      >
        {text}
      </Markdown>
    </div>
  );
}
export function Empty({
  title,
  detail,
  children,
}: {
  title: string;
  detail?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <Inbox size={32} />
      <h3>{title}</h3>
      <p>{detail}</p>
      {children}
    </div>
  );
}
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", key);
    };
  }, [onClose]);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <h2>{title}</h2>
          <button className="icon" aria-label="Tutup" onClick={onClose}>
            <X />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Busy() {
  return (
    <div className="loading">
      <LoaderCircle className="spin" /> Memuat data…
    </div>
  );
}
export function useData<T>(action: string) {
  const [data, setData] = useState<T[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  async function refresh() {
    setLoading(true);
    try {
      setData(await rpc<T[]>("tka_action", { action }));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, [action]);
  return { data, setData, loading, error, refresh };
}
export function ErrorBox({
  error,
  retry,
}: {
  error: string;
  retry?: () => void;
}) {
  return error ? (
    <div className="alert error">
      {error} {retry && <button onClick={retry}>Coba lagi</button>}
    </div>
  ) : null;
}
export function useWork() {
  const [busy, setBusy] = useState(false);
  const notice = useNotice();
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      notice(e instanceof Error ? e.message : "Terjadi kendala.", true);
    } finally {
      setBusy(false);
    }
  }
  return { busy, run };
}
