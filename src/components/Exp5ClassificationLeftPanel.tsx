import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import {
  BINARY_REF_A,
  BINARY_REF_B,
  BINARY_REF_C,
} from '../data/experimentAssets';
import { BinaryEditEntry, PixelCoord } from '../types/lab';

interface Exp5ClassificationLeftPanelProps {
  xGrid: number[][];
  editLog: BinaryEditEntry[];
  onToggleXCell: (coord: PixelCoord) => void;
  onResetX: () => void;
}

const BinaryMatrixCard: React.FC<{
  title: string;
  subtitle: string;
  grid: number[][];
  showNumbers: boolean;
  interactive?: boolean;
  editedCoordKeys?: Set<string>;
  onCellClick?: (coord: PixelCoord) => void;
}> = ({
  title,
  subtitle,
  grid,
  showNumbers,
  interactive = false,
  editedCoordKeys,
  onCellClick,
}) => {
  const cellSize = interactive ? 'w-7 h-7 sm:w-8 sm:h-8' : 'w-4 h-4 sm:w-5 sm:h-5';
  const fontSize = interactive ? 'text-[11px]' : 'text-[9px]';

  return (
    <div
      className={`flex flex-col gap-1.5 p-2.5 rounded-md border ${
        interactive ? 'bg-blue-50/50 border-blue-300' : 'bg-slate-50 border-slate-200'
      }`}
    >
      <div className="flex items-center justify-between gap-1 text-xs">
        <span className="font-semibold text-slate-900">{title}</span>
        <span className="font-mono text-[11px] text-slate-500">{subtitle}</span>
      </div>

      <div className="overflow-x-auto flex justify-center">
        <table className="border-collapse font-mono tabular-nums select-none">
          <thead>
            <tr>
              <th className="w-4 text-[9px] text-slate-400 font-normal" />
              {[1, 2, 3, 4, 5, 6, 7, 8].map((col) => (
                <th
                  key={col}
                  className="text-[9px] text-slate-400 font-normal text-center pb-0.5"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((rowVals, rIdx) => (
              <tr key={rIdx}>
                <th className="text-[9px] text-slate-400 font-normal pr-1 text-right">
                  {rIdx + 1}
                </th>
                {rowVals.map((val, cIdx) => {
                  const r1 = rIdx + 1;
                  const c1 = cIdx + 1;
                  const key = `${r1}-${c1}`;
                  const wasEdited = editedCoordKeys?.has(key) ?? false;
                  const bgClass = val === 1 ? 'bg-slate-900 text-white' : 'bg-white text-slate-700';

                  return (
                    <td key={key} className="p-0 border border-slate-300">
                      {interactive ? (
                        <button
                          type="button"
                          onClick={() => onCellClick?.({ row: r1, col: c1 })}
                          data-testid={`exp5-x-cell-${r1}-${c1}`}
                          aria-label={`입력 X (${r1}행, ${c1}열) 현재값 ${val} 클릭하여 반전`}
                          className={`${cellSize} ${fontSize} ${bgClass} flex items-center justify-center cursor-pointer transition-colors hover:opacity-85 ${
                            wasEdited ? 'ring-2 ring-inset ring-amber-400 font-bold' : ''
                          }`}
                        >
                          {showNumbers ? val : ''}
                        </button>
                      ) : (
                        <div
                          aria-label={`${title} (${r1}행, ${c1}열) 값 ${val}`}
                          className={`${cellSize} ${fontSize} ${bgClass} flex items-center justify-center`}
                        >
                          {showNumbers ? val : ''}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const Exp5ClassificationLeftPanel: React.FC<Exp5ClassificationLeftPanelProps> = ({
  xGrid,
  editLog,
  onToggleXCell,
  onResetX,
}) => {
  const [showNumbers, setShowNumbers] = useState<boolean>(true);
  const editedCoordKeys = new Set(
    editLog.map((entry) => `${entry.coord.row}-${entry.coord.col}`),
  );

  return (
    <section
      aria-label="8x8 이진 이미지 관찰 및 입력 이미지 X 편집"
      className="flex flex-col gap-4 bg-white border border-slate-200 rounded-lg p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900">
            1. 8×8 이진 행렬 · 입력 X
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            0 흰색 · 1 검은색 · 기준 A·B·C 비교
          </p>
        </div>
        <button
          type="button"
          onClick={onResetX}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>입력 X 초기화</span>
        </button>
      </div>

      {/* Display Option */}
      <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
        <span>클릭하여 입력 X 픽셀 반전 (0 ↔ 1)</span>
        <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showNumbers}
            onChange={(e) => setShowNumbers(e.target.checked)}
            className="rounded border-slate-300 text-blue-700"
          />
          <span>0 / 1 숫자 표시</span>
        </label>
      </div>

      {/* Interactive Input X (Prominent) */}
      <BinaryMatrixCard
        title="입력 이미지 X (클릭하여 수정)"
        subtitle={`수정 ${editLog.length}회`}
        grid={xGrid}
        showNumbers={showNumbers}
        interactive
        editedCoordKeys={editedCoordKeys}
        onCellClick={onToggleXCell}
      />

      {/* Simultaneous Reference Images A, B, C */}
      <div className="flex flex-col gap-2 pt-1 border-t border-slate-200">
        <span className="text-xs font-semibold text-slate-900">
          고정 기준 숫자 이미지 (8×8 이진 행렬)
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-1 gap-2">
          <BinaryMatrixCard
            title="기준 이미지 A"
            subtitle="숫자 0"
            grid={BINARY_REF_A}
            showNumbers={showNumbers}
          />
          <BinaryMatrixCard
            title="기준 이미지 B"
            subtitle="숫자 1"
            grid={BINARY_REF_B}
            showNumbers={showNumbers}
          />
          <BinaryMatrixCard
            title="기준 이미지 C"
            subtitle="숫자 7"
            grid={BINARY_REF_C}
            showNumbers={showNumbers}
          />
        </div>
      </div>
    </section>
  );
};
