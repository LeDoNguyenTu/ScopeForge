"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "info";
type ToastRecord = { id: number; kind: ToastKind; message: string };
type ToastApi = Record<ToastKind, (message: string) => void>;

const ToastContext = createContext<ToastApi | null>(null);
const TOAST_DURATION: Readonly<Record<ToastKind, number>> = {
  success: 5000,
  info: 5000,
  error: 9000,
};

function ToastItem({ toast, dismiss }: { toast: ToastRecord; dismiss: (id: number) => void }) {
  const remaining = useRef(TOAST_DURATION[toast.kind]);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopTimer = useCallback(() => {
    if (!timer.current) return;
    clearTimeout(timer.current);
    timer.current = null;
    remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
  }, []);

  const startTimer = useCallback(() => {
    if (timer.current || remaining.current <= 0) return;
    startedAt.current = Date.now();
    timer.current = setTimeout(() => dismiss(toast.id), remaining.current);
  }, [dismiss, toast.id]);

  useEffect(() => {
    startTimer();
    return stopTimer;
  }, [startTimer, stopTimer]);

  const Icon = toast.kind === "success" ? CheckCircle2 : toast.kind === "error" ? CircleAlert : Info;

  return (
    <div
      className={`productToast productToast-${toast.kind}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) startTimer();
      }}
      onFocus={stopTimer}
      onMouseEnter={stopTimer}
      onMouseLeave={startTimer}
      role={toast.kind === "error" ? "alert" : "status"}
    >
      <Icon aria-hidden="true" size={18} />
      <span>{toast.message}</span>
      <button type="button" aria-label="Dismiss notification" onClick={() => dismiss(toast.id)}>
        <X aria-hidden="true" size={16} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const nextId = useRef(0);
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);
  const show = useCallback((kind: ToastKind, message: string) => {
    const normalized = message.trim();
    if (!normalized) return;
    const toast = { id: nextId.current += 1, kind, message: normalized };
    setToasts((current) => [...current, toast].slice(-3));
  }, []);
  const value = useMemo<ToastApi>(() => ({
    success: (message) => show("success", message),
    error: (message) => show("error", message),
    info: (message) => show("info", message),
  }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="productToastRegion" aria-label="Notifications">
        {toasts.map((toast) => <ToastItem dismiss={dismiss} key={toast.id} toast={toast} />)}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}
