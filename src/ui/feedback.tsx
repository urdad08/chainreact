import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { Button } from "./primitives";

// ---- Toasts ---------------------------------------------------------------

type ToastTone = "success" | "error" | "info" | "warning";
interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastApi {
  toast: (t: { tone?: ToastTone; title: string; description?: string }) => void;
}

const ToastContext = createContext<ToastApi>({ toast: () => undefined });

const TOAST_ICON: Record<ToastTone, ReactNode> = {
  success: <CheckCircle2 size={17} style={{ color: "var(--success)", flexShrink: 0, marginTop: 1 }} />,
  error: <XCircle size={17} style={{ color: "var(--danger)", flexShrink: 0, marginTop: 1 }} />,
  warning: <AlertTriangle size={17} style={{ color: "var(--warning)", flexShrink: 0, marginTop: 1 }} />,
  info: <Info size={17} style={{ color: "var(--cyan)", flexShrink: 0, marginTop: 1 }} />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((all) => all.filter((t) => t.id !== id)), []);

  const toast = useCallback<ToastApi["toast"]>(
    ({ tone = "info", title, description }) => {
      const id = nextId.current++;
      setItems((all) => [...all.slice(-3), { id, tone, title, description }]);
      window.setTimeout(() => dismiss(id), tone === "error" ? 7000 : 4200);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-region" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="toast" role="status">
            {TOAST_ICON[t.tone]}
            <div className="grow">
              <div className="toast-title">{t.title}</div>
              {t.description && <div className="toast-desc">{t.description}</div>}
            </div>
            <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext).toast;

// ---- Confirmation dialog ---------------------------------------------------

interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;
const ConfirmContext = createContext<ConfirmFn>(async () => false);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);

  const confirm = useCallback<ConfirmFn>(
    (opts) => new Promise<boolean>((resolve) => setPending({ ...opts, resolve })),
    []
  );

  const close = (value: boolean) => {
    pending?.resolve(value);
    setPending(null);
  };

  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close(false)}>
          <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
            <div className="modal-body">
              <div className="row gap-3">
                {pending.tone === "danger" ? (
                  <span className="empty-state-icon" style={{ width: 36, height: 36, color: "var(--danger)", background: "var(--danger-soft)", borderColor: "transparent" }}>
                    <AlertTriangle size={18} />
                  </span>
                ) : null}
                <h3 id="confirm-title" style={{ fontSize: 16 }}>
                  {pending.title}
                </h3>
              </div>
              {pending.description && <div className="text-secondary" style={{ fontSize: 13.5, lineHeight: 1.55 }}>{pending.description}</div>}
            </div>
            <div className="modal-footer">
              <Button variant="ghost" onClick={() => close(false)}>
                {pending.cancelLabel ?? "Cancel"}
              </Button>
              <Button variant={pending.tone === "danger" ? "danger" : "primary"} onClick={() => close(true)} autoFocus>
                {pending.confirmLabel ?? "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);
