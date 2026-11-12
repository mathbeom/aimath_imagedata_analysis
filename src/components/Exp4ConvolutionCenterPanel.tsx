import React from 'react';
import { ChevronDown } from 'lucide-react';
import {
  computeValid3x3Convolution,
  Grayscale5x5Patch,
} from '../engine/convolutionMath';
import { ConvolutionFilterType } from '../types/lab';
import { EXP4_MEAN_K_OPTIONS } from '../data/experimentAssets';

interface Exp4ConvolutionCenterPanelProps {
  patch: Grayscale5x5Patch;
  filterType: ConvolutionFilterType;
  meanK: number;
  edgeM: number;
  selectedOutRow: number;
  selectedOutCol: number;
  onChangeFilterType: (t: ConvolutionFilterType) => void;
  onChangeMeanK: (k: number) => void;
  onChangeEdgeM: (m: number) => void;
  onSelectOutCell: (outRow0: number, outCol0: number) => void;
}

function formatNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '');
}

function formatKernelWeight(num: number, denom: number): string {
  if (num === 0) return '0';
  if (num % denom === 0) return String(num / denom);
  return `${num}/${denom}`;
}

export const Exp4ConvolutionCenterPanel: React.FC<Exp4ConvolutionCenterPanelProps> = ({
  patch,
  filterType,
  meanK,
  edgeM,
  selectedOutRow,
  selectedOutCol,
  onChangeFilterType,
  onChangeMeanK,
  onChangeEdgeM,
  onSelectOutCell,
}) => {
  const activeCoef = filterType === 'mean' ? meanK : edgeM;
  const conv = computeValid3x3Convolution(patch, filterType, activeCoef);
  const safeRow = Math.max(0, Math.min(2, selectedOutRow));
  const safeCol = Math.max(0, Math.min(2, selectedOutCol));
  const cellDetail = conv.details[safeRow][safeCol];

  return (
    <section
      aria-label="합성곱 커널 연산 및 3x3 출력 행렬 영역"
      className="flex flex-col gap-4 bg-white border border-slate-200 rounded-lg p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            2. 합성곱 필터 K · 3×3 계산 과정
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            패딩 없이 1칸씩 이동(Valid 3×3) · 필터 행렬을 뒤집지 않고 대응 성분 곱을 합산
          </p>
        </div>
        <span className="text-xs font-mono tabular-nums text-blue-900 font-semibold whitespace-nowrap shrink-0">
          {conv.kernel.shortName}
        </span>
      </div>

      {/* Filter Type & Coefficient m Selector */}
      <div className="flex flex-col gap-2.5">
        <div
          role="group"
          aria-label="합성곱 필터 종류 선택"
          className="grid grid-cols-1 sm:grid-cols-2 gap-2"
        >
          <button
            type="button"
            onClick={() => onChangeFilterType('mean')}
            className={`px-3 py-2 rounded-md border text-left transition-colors cursor-pointer ${
              filterType === 'mean'
                ? 'bg-blue-950 text-white border-blue-950'
                : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <div className="text-xs font-semibold">실험 A · 평균 필터 K₁</div>
            <div
              className={`text-[11px] font-mono mt-0.5 ${
                filterType === 'mean' ? 'text-blue-200' : 'text-slate-500'
              }`}
            >
              주변 9개 픽셀을 같은 비율로 합산 (k ∈ {'{1, 2, 3}'})
            </div>
          </button>

          <button
            type="button"
            onClick={() => onChangeFilterType('edge')}
            className={`px-3 py-2 rounded-md border text-left transition-colors cursor-pointer ${
              filterType === 'edge'
                ? 'bg-blue-950 text-white border-blue-950'
                : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <div className="text-xs font-semibold">실험 B · 세로 경계 필터 K₂</div>
            <div
              className={`text-[11px] font-mono mt-0.5 ${
                filterType === 'edge' ? 'text-blue-200' : 'text-slate-500'
              }`}
            >
              좌우 명암 차이를 강조 (m ∈ {'{1, 2, 3}'})
            </div>
          </button>
        </div>

        {filterType === 'mean' && (
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-md">
            <span className="text-xs font-semibold text-slate-800">
              필터 계수 <span className="font-mono">k</span> 선택 · K₁ = (k/9) × J
            </span>
            <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="평균 필터 계수 k 선택">
              {EXP4_MEAN_K_OPTIONS.map((kOpt) => (
                <button
                  key={kOpt}
                  type="button"
                  onClick={() => onChangeMeanK(kOpt)}
                  aria-pressed={meanK === kOpt}
                  className={`px-3 py-1 text-xs font-mono tabular-nums rounded border transition-colors cursor-pointer ${
                    meanK === kOpt
                      ? 'bg-blue-700 text-white border-blue-700 font-semibold'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  k = {kOpt}
                </button>
              ))}
            </div>
          </div>
        )}

        {filterType === 'edge' && (
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-md">
            <span className="text-xs font-semibold text-slate-800">
              필터 계수 <span className="font-mono">m</span> 선택 (m ∈ {'{1, 2, 3}'})
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {[1, 2, 3].map((mOpt) => (
                <button
                  key={mOpt}
                  type="button"
                  onClick={() => onChangeEdgeM(mOpt)}
                  className={`px-3 py-1 text-xs font-mono tabular-nums rounded border transition-colors cursor-pointer ${
                    edgeM === mOpt
                      ? 'bg-blue-700 text-white border-blue-700 font-semibold'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  m = {mOpt}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Connected 3x3 Patch * 3x3 Kernel -> Products Grid */}
      <div className="flex flex-col gap-2 p-3 bg-slate-50 border border-slate-200 rounded-md">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-slate-900">
            출력 ({safeRow + 1}, {safeCol + 1}) 위치의 3×3 대응 곱 계산
          </span>
          <span className="font-mono tabular-nums text-[11px] text-slate-500">
            입력 범위 ({patch.rows[safeRow]}~{patch.rows[safeRow + 2]}행,{' '}
            {patch.cols[safeCol]}~{patch.cols[safeCol + 2]}열)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr] gap-2 items-center">
          {/* 3x3 Source Subwindow */}
          <div className="bg-white border border-slate-200 rounded p-2 flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-700 text-center">
              원본 3×3 부분
            </span>
            <div className="grid grid-cols-3 gap-1 font-mono tabular-nums text-xs">
              {[0, 1, 2].map((kr) =>
                [0, 1, 2].map((kc) => {
                  const val = patch.values[safeRow + kr][safeCol + kc];
                  return (
                    <div
                      key={`sub-${kr}-${kc}`}
                      className="py-1 text-center bg-slate-50 border border-slate-200 rounded font-medium text-slate-900"
                    >
                      {val}
                    </div>
                  );
                }),
              )}
            </div>
          </div>

          <div className="text-center font-mono font-bold text-slate-500 text-sm">⊙</div>

          {/* 3x3 Kernel Matrix K */}
          <div className="bg-white border border-slate-200 rounded p-2 flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-blue-900 text-center">
              필터 행렬 {filterType === 'mean' ? `K₁(k=${meanK})` : `K₂(m=${edgeM})`}
            </span>
            <div className="grid grid-cols-3 gap-1 font-mono tabular-nums text-xs">
              {conv.kernel.numeratorMatrix.map((row, kr) =>
                row.map((num, kc) => (
                  <div
                    key={`k-${kr}-${kc}`}
                    className={`py-1 text-center rounded border font-medium ${
                      num > 0
                        ? 'bg-blue-50 border-blue-200 text-blue-900'
                        : num < 0
                          ? 'bg-rose-50 border-rose-200 text-rose-800'
                          : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}
                  >
                    {formatKernelWeight(num, conv.kernel.denominator)}
                  </div>
                )),
              )}
            </div>
          </div>

          <div className="text-center font-mono font-bold text-slate-500 text-sm">=</div>

          {/* 3x3 Products Matrix */}
          <div className="bg-white border border-slate-200 rounded p-2 flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-700 text-center">
              대응 성분 곱 (9항)
            </span>
            <div className="grid grid-cols-3 gap-1 font-mono tabular-nums text-[11px]">
              {cellDetail.terms.map((t, idx) => (
                <div
                  key={`prod-${idx}`}
                  className="py-1 px-0.5 text-center bg-amber-50/70 border border-amber-200 rounded text-slate-900 font-medium truncate"
                  title={`${t.imageValue} × ${formatKernelWeight(t.kernelCoefficientNumerator, t.kernelDenominator)} = ${formatNum(t.product)}`}
                >
                  {formatNum(t.product)}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Summation Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 bg-white border border-slate-200 rounded text-xs font-mono tabular-nums">
          <span className="font-sans text-slate-600">
            9개 곱의 합산 → 출력 ({safeRow + 1}, {safeCol + 1})
          </span>
          <span className="font-semibold text-blue-950">
            합계 = {formatNum(cellDetail.rawSum)}
          </span>
        </div>

        {/* Expandable 9-term Detailed Arithmetic List */}
        <details className="bg-white border border-slate-200 rounded">
          <summary className="px-2.5 py-1.5 text-xs font-medium text-slate-700 cursor-pointer flex items-center justify-between select-none hover:bg-slate-50">
            <span>9개 항 곱셈·합산 단계 자세히 보기 (펼치기/접기)</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
          </summary>
          <div className="px-2.5 pb-2.5 pt-1 border-t border-slate-100">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 font-mono tabular-nums text-[11px]">
              {cellDetail.terms.map((t) => (
                <div
                  key={`term-${t.kernelRow}-${t.kernelCol}`}
                  className="p-1.5 bg-slate-50 border border-slate-200 rounded flex flex-col"
                >
                  <span className="text-[10px] text-slate-500">
                    ({t.imageRow},{t.imageCol}) · K({t.kernelRow},{t.kernelCol})
                  </span>
                  <span className="text-slate-800">
                    {t.imageValue} × {formatKernelWeight(t.kernelCoefficientNumerator, t.kernelDenominator)} ={' '}
                    <strong className="text-slate-950">{formatNum(t.product)}</strong>
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-2 pt-1.5 border-t border-slate-100 text-[11px] font-mono text-slate-700">
              총합: {cellDetail.terms.map((t) => formatNum(t.product)).join(' + ')} ={' '}
              <strong className="text-blue-950">{formatNum(cellDetail.rawSum)}</strong>
            </div>
          </div>
        </details>
      </div>

      {/* Exact Mathematical 3x3 Output Matrix (Preserves Negatives & >255) */}
      <div className="flex flex-col gap-2 pt-1 border-t border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-semibold text-slate-900">
              합성곱 결과 3×3 행렬 (음수 및 255 초과값 그대로 보존)
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              각 칸을 클릭하면 해당 위치의 3×3 입력 영역과 9개 항 곱셈 과정이 위에 표시됩니다.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto bg-slate-50 border border-slate-200 rounded-md p-2.5">
          <div className="inline-flex items-stretch gap-1.5 min-w-full justify-center">
            <div
              aria-hidden="true"
              className="w-2 border-y-2 border-l-2 border-slate-700 rounded-l-xs my-4"
            />
            <table
              className="border-collapse font-mono tabular-nums text-xs"
              data-testid="exp4-output-matrix"
            >
              <thead>
                <tr>
                  <th className="text-[10px] font-normal text-slate-400 pb-1 text-right pr-2 whitespace-nowrap">
                    출력 행\열
                  </th>
                  {[1, 2, 3].map((c) => (
                    <th key={c} className="px-2 pb-1 text-[10px] font-medium text-slate-500 text-center">
                      {c}열
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {conv.outputMatrix.map((rowVals, rIdx) => (
                  <tr key={rIdx}>
                    <th className="text-[10px] font-medium text-slate-500 text-right pr-2 whitespace-nowrap">
                      {rIdx + 1}행
                    </th>
                    {rowVals.map((val, cIdx) => {
                      const isActive = rIdx === safeRow && cIdx === safeCol;
                      const isOutOfRange = val < 0 || val > 255;
                      return (
                        <td key={`${rIdx}-${cIdx}`} className="p-0.5">
                          <button
                            type="button"
                            onClick={() => onSelectOutCell(rIdx, cIdx)}
                            className={`min-w-[64px] px-2.5 py-2 rounded text-center transition-colors cursor-pointer ${
                              isActive
                                ? 'bg-blue-900 text-white font-semibold ring-2 ring-amber-400'
                                : isOutOfRange
                                  ? 'bg-amber-50 text-amber-950 border border-amber-300 font-semibold hover:bg-amber-100'
                                  : 'bg-white text-slate-900 border border-slate-200 hover:bg-slate-100 font-medium'
                            }`}
                          >
                            <div>{formatNum(val)}</div>
                            {isOutOfRange && (
                              <div
                                className={`text-[9px] font-sans ${
                                  isActive ? 'text-blue-200' : 'text-amber-800'
                                }`}
                              >
                                {val < 0 ? '음수' : '255 초과'}
                              </div>
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div
              aria-hidden="true"
              className="w-2 border-y-2 border-r-2 border-slate-700 rounded-r-xs my-4"
            />
          </div>
        </div>
      </div>
    </section>
  );
};
