import React from 'react';
import { CheckCircle2, CircleDashed } from 'lucide-react';
import { ExperimentCheckStatus } from '../types/lab';

interface ResultConfirmToggleProps {
  experimentNumber: 1 | 2 | 3 | 4 | 5;
  status: ExperimentCheckStatus;
  onToggle: (nextChecked: boolean) => void;
}

export const ResultConfirmToggle: React.FC<ResultConfirmToggleProps> = ({
  experimentNumber,
  status,
  onToggle,
}) => {
  return (
    <label
      className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-md border text-xs cursor-pointer transition-colors ${
        status.resultChecked
          ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <input
          type="checkbox"
          checked={status.resultChecked}
          onChange={(e) => onToggle(e.target.checked)}
          data-testid={`exp${experimentNumber}-result-check`}
          className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600 cursor-pointer shrink-0"
        />
        <span className="font-medium">
          실험 결과 확인 여부 (변환 결과와 계산 과정을 직접 확인함)
        </span>
      </div>
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold whitespace-nowrap shrink-0">
        {status.resultChecked ? (
          <>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
            <span className="text-emerald-800">확인 완료</span>
          </>
        ) : (
          <>
            <CircleDashed className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
            <span className="text-slate-500">미확인</span>
          </>
        )}
      </span>
    </label>
  );
};
