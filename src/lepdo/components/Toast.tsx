import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CircleCheck, CircleX } from 'lucide-react';

type Toast = { id: number; kind: 'success' | 'error'; text: string };
const Ctx = createContext<{ success: (t: string) => void; error: (t: string) => void }>({ success: () => {}, error: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3000);
  }, []);
  const success = useCallback((t: string) => push('success', t), [push]);
  const error = useCallback((t: string) => push('error', t), [push]);
  return (
    <Ctx.Provider value={{ success, error }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-auto sm:left-auto sm:right-4 sm:top-4 sm:items-end" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto flex max-w-sm items-start gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-pop">
            {t.kind === 'success' ? <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <CircleX className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
