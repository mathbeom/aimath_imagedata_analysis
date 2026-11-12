import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import {
  computeAllDistances,
  computeHammingDistance,
  computeXorMatrix,
  getBinaryGridById,
  HammingDistances,
} from '../engine/hammingMath';
import { BinaryEditEntry, BinaryImageId, Experiment5Answer } from '../types/lab';

interface Exp5ClassificationCenterPanelProps {
  xGrid: number[][];
  initialDistances: HammingDistances;
  currentDistances: HammingDistances;
  editLog: BinaryEditEntry[];
  answer: Experiment5Answer;
  onChangeAnswer: (next: Experiment5Answer) => void;
  onVerifyDistances?: () => void;
}

const IMAGE_OPTIONS: Array<{ id: BinaryImageId; label: string }> = [
  { id: 'X', label: '입력 X' },
  { id: 'A', label: '기준 A (숫자 0)' },
  { id: 'B', label: '기준 B (숫자 1)' },
  { id: 'C', label: '기준 C (숫자 7)' },
];

export const Exp5ClassificationCenterPanel: React.FC<Exp5ClassificationCenterPanelProps> = ({
  xGrid,
  initialDistances,
  currentDistances,
  editLog,
  answer,
  onChangeAnswer,
  onVerifyDistances,
}) => {
  const [compareLeft, setCompareLeft] = useState<BinaryImageId>('X');
  const [compareRight, setCompareRight] = useState<BinaryImageId>('B');
  const [showComputedDistances, setShowComputedDistances] = useState<boolean>(false);

  const leftGrid = getBinaryGridById(compareLeft, xGrid);
  const rightGrid = getBinaryGridById(compareRight, xGrid);
  const xorMatrix = computeXorMatrix(leftGrid, rightGrid);
  const pairDistance = computeHammingDistance(leftGrid, rightGrid);

  const diffCoords: string[] = [];
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      if (xorMatrix[r][c]) {
        diffCoords.push(`(${r + 1}, ${c + 1})`);
      }
    }
  }

  const maxBarDist = Math.max(
    initialDistances.A,
    initialDistances.B,
    initialDistances.C,
    currentDistances.A,
    currentDistances.B,
    currentDistances.C,
    24,
  );

  // Unused helper avoided: computeAllDistances kept for reference in engine
  void computeAllDistances;

  return (
    <section
      aria-label="이진 행렬 쌍 비교, XOR 차이 강조 및 해밍 거리 시각화 영역"
      className="flex flex-col gap-4 bg-white border border-slate-200 rounded-lg p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            2. 두 이미지 비교 · 해밍 거리 계측
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            두 8×8 행렬에서 같은 위치의 성분 값이 서로 다른 칸의 개수를 세어 비교
          </p>
        </div>
        <span className="text-xs font-mono tabular-nums text-slate-500 whitespace-nowrap shrink-0">
          8×8 = 64픽셀
        </span>
      </div>

      {/* Pairwise Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-md">
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-semibold text-slate-700">비교 이미지 ①</span>
          <select
            value={compareLeft}
            onChange={(e) => setCompareLeft(e.target.value as BinaryImageId)}
            aria-label="첫 번째 비교 이미지 선택"
            className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-600"
          >
            {IMAGE_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-semibold text-slate-700">비교 이미지 ②</span>
          <select
            value={compareRight}
            onChange={(e) => setCompareRight(e.target.value as BinaryImageId)}
            aria-label="두 번째 비교 이미지 선택"
            className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-600"
          >
            {IMAGE_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Side-by-side Selected Two Images + XOR Diff Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { title: `이미지 ${compareLeft}`, grid: leftGrid, isXor: false },
          { title: `이미지 ${compareRight}`, grid: rightGrid, isXor: false },
          { title: `서로 다른 칸 (${compareLeft} ≠ ${compareRight})`, grid: null, isXor: true },
        ].map((panel) => (
          <div
            key={panel.title}
            className={`flex flex-col gap-1.5 p-2.5 rounded-md border ${
              panel.isXor
                ? 'bg-amber-50/50 border-amber-300'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <span className="text-[11px] font-semibold text-slate-900 text-center">
              {panel.title}
            </span>
            <table className="mx-auto border-collapse font-mono tabular-nums">
              <thead>
                <tr>
                  <th className="w-3" />
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((c) => (
                    <th key={c} className="text-[9px] text-slate-400 font-normal text-center">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 8 }, (_, rIdx) => (
                  <tr key={rIdx}>
                    <th className="text-[9px] text-slate-400 font-normal pr-0.5 text-right">
                      {rIdx + 1}
                    </th>
                    {Array.from({ length: 8 }, (__, cIdx) => {
                      const isDiff = xorMatrix[rIdx][cIdx];
                      if (panel.isXor) {
                        return (
                          <td
                            key={cIdx}
                            className={`w-5 h-5 border border-slate-300 text-[9px] text-center ${
                              isDiff
                                ? 'bg-amber-400 text-amber-950 font-bold'
                                : 'bg-white text-slate-300'
                            }`}
                          >
                            {isDiff ? '1' : '0'}
                          </td>
                        );
                      }
                      const val = panel.grid![rIdx][cIdx];
                      return (
                        <td
                          key={cIdx}
                          className={`w-5 h-5 border text-[9px] text-center ${
                            val === 1 ? 'bg-slate-900 text-white' : 'bg-white text-slate-700'
                          } ${isDiff ? 'border-amber-500 ring-1 ring-inset ring-amber-400' : 'border-slate-300'}`}
                        >
                          {val}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {/* Differing Coordinates Readout */}
      <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-slate-800">
          {compareLeft}와 {compareRight}에서 서로 다른 좌표 ({diffCoords.length}칸)
        </span>
        <span className="font-mono text-[11px] text-amber-900 font-semibold">
          {diffCoords.length > 0 ? diffCoords.join(', ') : '모든 픽셀 일치 (차이 0칸)'}
        </span>
      </div>

      {/* Manual Student Calculation Input + Toggleable Verification */}
      <div className="flex flex-col gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-md">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col text-xs">
            <span className="font-semibold text-slate-900">
              직접 계산한 해밍 거리 입력 및 확인
            </span>
            <span className="text-slate-500 text-[11px] mt-0.5">
              직접 세어 적은 뒤 확인 버튼을 눌러 검증하세요.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              const nextShow = !showComputedDistances;
              setShowComputedDistances(nextShow);
              if (nextShow && onVerifyDistances) {
                onVerifyDistances();
              }
            }}
            data-testid="exp5-toggle-verify"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-blue-900 bg-white hover:bg-blue-50 border border-blue-300 rounded transition-colors cursor-pointer whitespace-nowrap"
          >
            {showComputedDistances ? (
              <>
                <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                <span>계산 결과 숨기기</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                <span>계산된 해밍 거리 확인</span>
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs font-mono tabular-nums">
          {(
            [
              { key: 'initialDistA' as const, label: 'd(X, A)', target: currentDistances.A },
              { key: 'initialDistB' as const, label: 'd(X, B)', target: currentDistances.B },
              { key: 'initialDistC' as const, label: 'd(X, C)', target: currentDistances.C },
            ]
          ).map((item) => {
            const val = answer[item.key];
            const parsed = val.trim() === '' ? null : Number(val);
            const matches = parsed !== null && parsed === item.target;
            return (
              <div key={item.key} className="bg-white border border-slate-200 rounded p-2 flex flex-col gap-1">
                <label className="flex flex-col gap-1">
                  <span className="font-semibold text-slate-800">{item.label}</span>
                  <input
                    type="number"
                    min={0}
                    max={64}
                    value={val}
                    onChange={(e) =>
                      onChangeAnswer({ ...answer, [item.key]: e.target.value })
                    }
                    placeholder="직접 입력"
                    aria-label={`직접 계산한 ${item.label}`}
                    className="w-full px-2 py-1 text-xs text-center bg-slate-50 border border-slate-300 rounded focus:outline-none focus:border-blue-600"
                  />
                </label>
                {showComputedDistances && (
                  <div className="text-[11px] flex items-center justify-between pt-0.5 border-t border-slate-100">
                    <span className="text-slate-500">계산값</span>
                    <span
                      className={`font-semibold ${
                        parsed === null
                          ? 'text-blue-900'
                          : matches
                            ? 'text-emerald-700'
                            : 'text-rose-700'
                      }`}
                    >
                      {item.target}
                      {parsed !== null ? (matches ? ' (일치)' : ' (재확인)') : ''}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {showComputedDistances && (
          <div className="text-[11px] font-mono text-slate-600 flex items-center justify-between px-1">
            <span>현재 선택 비교쌍 {compareLeft} ↔ {compareRight} 거리</span>
            <strong className="text-slate-900">d({compareLeft}, {compareRight}) = {pairDistance}</strong>
          </div>
        )}
      </div>

      {/* Real-time Before / After SVG Bar Chart */}
      <div className="flex flex-col gap-2 pt-1 border-t border-slate-200">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-900">
            해밍 거리 변화 비교 차트 (수정 전 초기 상태 vs 현재 상태)
          </span>
          <div className="flex items-center gap-3 text-[11px] text-slate-600">
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 inline-block bg-slate-300 rounded-xs" />
              초기 X₀
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 inline-block bg-blue-800 rounded-xs" />
              현재 X
            </span>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-md p-3">
          <svg
            viewBox="0 0 420 132"
            className="w-full h-auto block"
            role="img"
            aria-label="초기 X와 현재 X의 A, B, C별 해밍 거리 비교 막대 차트"
          >
            {(['A', 'B', 'C'] as const).map((cls, idx) => {
              const yBase = 16 + idx * 38;
              const initD = initialDistances[cls];
              const currD = currentDistances[cls];
              const initW = (initD / maxBarDist) * 230;
              const currW = (currD / maxBarDist) * 230;
              const digitLabel = cls === 'A' ? 'A (0)' : cls === 'B' ? 'B (1)' : 'C (7)';
              return (
                <g key={cls}>
                  <text
                    x={4}
                    y={yBase + 16}
                    fontSize={12}
                    fontWeight={600}
                    fill="#0f172a"
                  >
                    {digitLabel}
                  </text>

                  {/* Initial Bar */}
                  <rect
                    x={74}
                    y={yBase}
                    width={Math.max(2, initW)}
                    height={11}
                    rx={2}
                    fill="#cbd5e1"
                  />
                  <text
                    x={74 + Math.max(2, initW) + 6}
                    y={yBase + 9}
                    fontSize={10}
                    fontFamily="monospace"
                    fill="#475569"
                  >
                    초기 {initD}
                  </text>

                  {/* Current Bar */}
                  <rect
                    x={74}
                    y={yBase + 14}
                    width={Math.max(2, currW)}
                    height={12}
                    rx={2}
                    fill="#1e40af"
                  />
                  <text
                    x={74 + Math.max(2, currW) + 6}
                    y={yBase + 24}
                    fontSize={11}
                    fontWeight={700}
                    fontFamily="monospace"
                    fill="#1e3a8a"
                  >
                    현재 {currD}
                  </text>
                </g>
              );
            })}
          </svg>

          {editLog.length > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-200 text-[11px] font-mono text-slate-600 flex flex-wrap gap-x-3 gap-y-1">
              <span>단계별 d(X, B) 변화:</span>
              <span>초기 {initialDistances.B}</span>
              {editLog.map((e) => (
                <span key={e.step} className="text-blue-900 font-semibold">
                  → #{e.step} ({e.coord.row},{e.coord.col}): {e.distancesAfter.B}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
