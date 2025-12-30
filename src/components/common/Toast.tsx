// =====================================================
// Toast Notification Component
// Provides visual feedback for user actions
// =====================================================

import { AlertCircle, CheckCircle, Info, X, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
}

interface ToastContextValue {
    toasts: Toast[];
    showToast: (type: ToastType, message: string, duration?: number) => void;
    removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    const showToast = useCallback((type: ToastType, message: string, duration: number = 4000) => {
        const id = Date.now().toString(36) + Math.random().toString(36).substr(2);

        setToasts((prev) => [...prev, { id, type, message, duration }]);

        if (duration > 0) {
            setTimeout(() => {
                removeToast(id);
            }, duration);
        }
    }, [removeToast]);

    return (
        <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
            {children}
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </ToastContext.Provider>
    );
}

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
    if (toasts.length === 0) return null;

    const getIcon = (type: ToastType) => {
        switch (type) {
            case 'success':
                return <CheckCircle size={20} />;
            case 'error':
                return <XCircle size={20} />;
            case 'warning':
                return <AlertCircle size={20} />;
            case 'info':
            default:
                return <Info size={20} />;
        }
    };

    return (
        <div className="toast-container">
            <style>{`
        .toast-container {
          position: fixed;
          top: var(--space-4);
          right: var(--space-4);
          z-index: 9999;
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
          max-width: 400px;
        }

        .toast {
          display: flex;
          align-items: flex-start;
          gap: var(--space-3);
          padding: var(--space-3) var(--space-4);
          background: var(--bg-primary);
          border: 1px solid var(--border-light);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-lg);
          animation: toast-slide-in 0.3s ease-out;
        }

        .toast.removing {
          animation: toast-slide-out 0.2s ease-in forwards;
        }

        @keyframes toast-slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes toast-slide-out {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }

        .toast-icon {
          flex-shrink: 0;
          margin-top: 2px;
        }

        .toast.success .toast-icon { color: var(--color-success-600); }
        .toast.error .toast-icon { color: var(--color-danger-600); }
        .toast.warning .toast-icon { color: var(--color-warning-600); }
        .toast.info .toast-icon { color: var(--color-primary-600); }

        .toast-content {
          flex: 1;
          font-size: var(--text-sm);
          line-height: 1.5;
        }

        .toast-close {
          flex-shrink: 0;
          padding: var(--space-1);
          border: none;
          background: transparent;
          color: var(--text-tertiary);
          cursor: pointer;
          border-radius: var(--radius-sm);
          transition: all var(--transition-fast);
        }

        .toast-close:hover {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }

        .toast.success {
          border-left: 3px solid var(--color-success-500);
        }
        .toast.error {
          border-left: 3px solid var(--color-danger-500);
        }
        .toast.warning {
          border-left: 3px solid var(--color-warning-500);
        }
        .toast.info {
          border-left: 3px solid var(--color-primary-500);
        }
      `}</style>
            {toasts.map((toast) => (
                <div key={toast.id} className={`toast ${toast.type}`}>
                    <span className="toast-icon">{getIcon(toast.type)}</span>
                    <span className="toast-content">{toast.message}</span>
                    <button className="toast-close" onClick={() => onRemove(toast.id)}>
                        <X size={16} />
                    </button>
                </div>
            ))}
        </div>
    );
}
