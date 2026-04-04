import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import Toast, { type ToastType } from '../components/Toast';

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}

interface QueueItem {
  message: string;
  type: ToastType;
  id: number;
}

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [current, setCurrent] = useState<QueueItem | null>(null);

  const processNext = useCallback(() => {
    setQueue((prev) => {
      if (prev.length === 0) {
        setCurrent(null);
        return prev;
      }
      const [next, ...rest] = prev;
      setCurrent(next);
      return rest;
    });
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info') => {
      const item: QueueItem = { message, type, id: nextId++ };
      if (!current) {
        setCurrent(item);
      } else {
        setQueue((prev) => [...prev, item]);
      }
    },
    [current]
  );

  const handleDismiss = useCallback(() => {
    processNext();
  }, [processNext]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <Toast
        message={current?.message || ''}
        type={current?.type || 'info'}
        visible={current !== null}
        onDismiss={handleDismiss}
      />
    </ToastContext.Provider>
  );
}
