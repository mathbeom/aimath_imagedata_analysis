import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'danger' | 'warning';
  onConfirm: () => void;
}

interface ConfirmDialogProps {
  dialog: ConfirmDialogState | null;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  dialog,
  onCancel,
}) => {
  if (!dialog || !dialog.isOpen) return null;

  const isDanger = dialog.tone === 'danger';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="no-print fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/55 p-4"
    >
      <div className="bg-white border border-slate-200 rounded-lg w-full max-w-md shadow-xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <AlertTriangle
              className={`w-4 h-4 shrink-0 ${
                isDanger ? 'text-rose-600' : 'text-amber-600'
              }`}
              aria-hidden="true"
            />
            <h2
              id="confirm-dialog-title"
              className="text-sm font-semibold text-slate-900"
            >
              {dialog.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="확인 창 닫기"
            className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="px-4 py-4 text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line">
          {dialog.description}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 bg-slate-50 border-t border-slate-200">
          <button
            type="button"
            onClick={onCancel}
            data-testid="confirm-dialog-cancel"
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-md transition-colors cursor-pointer whitespace-nowrap"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => {
              dialog.onConfirm();
              onCancel();
            }}
            data-testid="confirm-dialog-confirm"
            className={`px-3.5 py-1.5 text-xs font-semibold text-white rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              isDanger
                ? 'bg-rose-700 hover:bg-rose-800'
                : 'bg-blue-900 hover:bg-blue-800'
            }`}
          >
            {dialog.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
