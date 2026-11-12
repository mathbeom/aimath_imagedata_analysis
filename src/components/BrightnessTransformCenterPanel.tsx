import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import {
  ChannelViewMode,
  PixelCoord,
  SelectionSize,
  TransformMode,
} from '../types/lab';
import {
  computePixelTransformDetail,
  extractChannelMatrices,
  formatFormulaText,
  getEffectiveParams,
  readPixel,
} from '../engine/imageMath';
import { MatrixDisplay } from './MatrixDisplay';

interface BrightnessTransformCenterPanelProps {
  originalPixels: Uint8ClampedArray;
  transformedPixels: Uint8ClampedArray;
  activeCoord: PixelCoord;
  regionCenter: PixelCoord;
  selectionSize: SelectionSize;
  channelView: ChannelViewMode;
  transformMode: TransformMode;
  sValue: number;
  tValue: number;
  onChangeChannelView: (mode: ChannelViewMode) => void;
  onChangeTransformMode: (mode: TransformMode) => void;
  onChangeS: (s: number) => void;
  onChangeT: (t: number) => void;
  onResetParams: () => void;
  onSelectCoord: (coord: PixelCoord) => void;
}

const EVAL_S_OPTIONS = [0.5, 1, 1.5, 2];
const EVAL_T_OPTIONS = [-20, -10, 0, 10, 20];

export const BrightnessTransformCenterPanel: React.FC<BrightnessTransformCenterPanelProps> = ({
  originalPixels,
  transformedPixels,
  activeCoord,
  regionCenter,
  selectionSize,
  channelView,
  transformMode,
  sValue,
  tValue,
  onChangeChannelView,
  onChangeTransformMode,
  onChangeS,
  onChangeT,
  onResetParams,
  onSelectCoord,
}) => {
  const [freeExploreRange, setFreeExploreRange] = useState<boolean>(false);

  const { effectiveS, effectiveT } = getEffectiveParams(
    transformMode,
    sValue,
    tValue,
  );
  const formulaDisplay = formatFormulaText(transformMode, effectiveS, effectiveT);

  const origPixel = readPixel(originalPixels, activeCoord.row, activeCoord.col);
  const pixelDetail = computePixelTransformDetail(
    origPixel,
    transformMode,
    sValue,
    tValue,
  );

  const beforeMatrices = extractChannelMatrices(
    originalPixels,
    regionCenter.row,
    regionCenter.col,
    selectionSize,
  );
  const afterMatrices = extractChannelMatrices(
    transformedPixels,
    regionCenter.row,
    regionCenter.col,
    selectionSize,
  );

  const isSLocked = transformMode === 'add';
  const isTLocked = transformMode === 'scale';

  const formatRaw = (val: number) =>
    Number.isInteger(val) ? String(val) : val.toFixed(2).replace(/\.?0+$/, '');

  return (
    <section
      aria-label="색상과 밝기 변환 수학적 연산 영역"
      className="flex flex-col gap-4 bg-white border border-slate-200 rounded-lg p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            2. 수학적 연산 · 행렬 밝기·색상 변환
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            R, G, B 각 채널 행렬에 동일한 일차 변환 적용 (소수 반올림 · 0~255 범위 제한)
          </p>
        </div>
        <button
          type="button"
          onClick={onResetParams}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>매개변수 초기화</span>
        </button>
      </div>

      {/* Operation Formula Selector */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-slate-800">적용할 행렬 연산 선택</span>
        <div
          role="group"
          aria-label="행렬 변환식 선택"
          className="grid grid-cols-1 sm:grid-cols-3 gap-1.5"
        >
          {(
            [
              {
                id: 'add' as const,
                title: '덧셈만 적용',
                formula: 'A′ = A + tJ',
              },
              {
                id: 'scale' as const,
                title: '실수배만 적용',
                formula: 'A′ = sA',
              },
              {
                id: 'combined' as const,
                title: '결합 연산 적용',
                formula: 'A′ = sA + tJ',
              },
            ]
          ).map((op) => (
            <button
              key={op.id}
              type="button"
              onClick={() => onChangeTransformMode(op.id)}
              className={`px-3 py-2 rounded-md border text-left transition-colors cursor-pointer ${
                transformMode === op.id
                  ? 'bg-blue-950 text-white border-blue-950'
                  : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <div className="text-xs font-semibold">{op.title}</div>
              <div
                className={`text-xs font-mono mt-0.5 ${
                  transformMode === op.id ? 'text-blue-200' : 'text-slate-500'
                }`}
              >
                {op.formula}
              </div>
            </button>
          ))}
        </div>

        {/* Active Formula Readout */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-md">
          <div className="text-xs text-slate-600">
            현재 적용 식 <span className="text-slate-400">(J: 모든 성분이 1인 행렬)</span>
          </div>
          <div className="text-sm font-mono font-semibold text-blue-900 tabular-nums">
            {formulaDisplay}
          </div>
        </div>
      </div>

      {/* Parameter Inputs: s and t */}
      <div className="flex flex-col gap-3 p-3 bg-slate-50 border border-slate-200 rounded-md">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-900">
            매개변수 조절 (s: 실수배, t: 밝기 이동)
          </span>
          <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={freeExploreRange}
              onChange={(e) => {
                const nextFree = e.target.checked;
                setFreeExploreRange(nextFree);
                if (!nextFree) {
                  // Snap back to closest evaluation discrete option when returning to evaluation step range
                  const closestS = EVAL_S_OPTIONS.reduce((prev, curr) =>
                    Math.abs(curr - sValue) < Math.abs(prev - sValue) ? curr : prev,
                  );
                  const closestT = EVAL_T_OPTIONS.reduce((prev, curr) =>
                    Math.abs(curr - tValue) < Math.abs(prev - tValue) ? curr : prev,
                  );
                  onChangeS(closestS);
                  onChangeT(closestT);
                }
              }}
              className="rounded border-slate-300 text-blue-700 focus:ring-blue-600"
            />
            <span>자유 범위 확장 탐색</span>
          </label>
        </div>

        {/* Parameter s */}
        <div className={`flex flex-col gap-1.5 ${isSLocked ? 'opacity-60' : ''}`}>
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-800">
              실수배 계수 <span className="font-mono font-semibold">s</span>
              {isSLocked && ' (덧셈 전용 모드에서 s = 1 고정)'}
            </span>
            <span className="font-mono tabular-nums font-semibold text-blue-900">
              {effectiveS} 배
              <span className="text-slate-400 font-normal ml-1.5">
                [{freeExploreRange ? '0.2 ~ 3.0' : '0.5, 1, 1.5, 2'}]
              </span>
            </span>
          </div>

          {!freeExploreRange ? (
            <div className="grid grid-cols-4 gap-1.5">
              {EVAL_S_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  disabled={isSLocked}
                  onClick={() => onChangeS(opt)}
                  className={`py-1.5 text-xs font-mono tabular-nums rounded border transition-colors ${
                    isSLocked
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                      : effectiveS === opt
                        ? 'bg-blue-700 text-white border-blue-700 font-semibold cursor-pointer'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100 cursor-pointer'
                  }`}
                >
                  s = {opt}
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-[minmax(0,1fr)_76px] items-center gap-2">
              <input
                type="range"
                min={0.2}
                max={3.0}
                step={0.1}
                disabled={isSLocked}
                value={effectiveS}
                onChange={(e) => onChangeS(parseFloat(e.target.value))}
                aria-label="실수배 계수 s 슬라이더"
                className="w-full accent-blue-700 cursor-pointer disabled:cursor-not-allowed"
              />
              <input
                type="number"
                min={0.2}
                max={3.0}
                step={0.1}
                disabled={isSLocked}
                value={effectiveS}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!Number.isNaN(v)) onChangeS(Math.max(0.2, Math.min(3.0, v)));
                }}
                aria-label="실수배 계수 s 숫자 입력"
                className="w-full px-2 py-1 text-xs font-mono tabular-nums text-right bg-white border border-slate-300 rounded"
              />
            </div>
          )}
        </div>

        {/* Parameter t */}
        <div className={`flex flex-col gap-1.5 pt-1 border-t border-slate-200 ${isTLocked ? 'opacity-60' : ''}`}>
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-800">
              행렬 덧셈 상수 <span className="font-mono font-semibold">t</span>
              {isTLocked && ' (실수배 전용 모드에서 t = 0 고정)'}
            </span>
            <span className="font-mono tabular-nums font-semibold text-blue-900">
              {effectiveT >= 0 ? `+${effectiveT}` : effectiveT}
              <span className="text-slate-400 font-normal ml-1.5">
                [{freeExploreRange ? '-100 ~ +100' : '-20, -10, 0, 10, 20'}]
              </span>
            </span>
          </div>

          {!freeExploreRange ? (
            <div className="grid grid-cols-5 gap-1.5">
              {EVAL_T_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  disabled={isTLocked}
                  onClick={() => onChangeT(opt)}
                  className={`py-1.5 text-xs font-mono tabular-nums rounded border transition-colors ${
                    isTLocked
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                      : effectiveT === opt
                        ? 'bg-blue-700 text-white border-blue-700 font-semibold cursor-pointer'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100 cursor-pointer'
                  }`}
                >
                  {opt > 0 ? `+${opt}` : opt}
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-[minmax(0,1fr)_76px] items-center gap-2">
              <input
                type="range"
                min={-100}
                max={100}
                step={5}
                disabled={isTLocked}
                value={effectiveT}
                onChange={(e) => onChangeT(parseInt(e.target.value, 10))}
                aria-label="덧셈 상수 t 슬라이더"
                className="w-full accent-blue-700 cursor-pointer disabled:cursor-not-allowed"
              />
              <input
                type="number"
                min={-100}
                max={100}
                step={1}
                disabled={isTLocked}
                value={effectiveT}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!Number.isNaN(v)) onChangeT(Math.max(-100, Math.min(100, v)));
                }}
                aria-label="덧셈 상수 t 숫자 입력"
                className="w-full px-2 py-1 text-xs font-mono tabular-nums text-right bg-white border border-slate-300 rounded"
              />
            </div>
          )}
        </div>
      </div>

      {/* Selected Pixel Step-by-Step Arithmetic Calculation */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs">
          <h3 className="font-semibold text-slate-900">
            선택 픽셀 ({activeCoord.row}, {activeCoord.col}) 연산 과정
          </h3>
          <span className="font-mono tabular-nums text-slate-500">
            ({origPixel.r}, {origPixel.g}, {origPixel.b}) → ({pixelDetail.r.clamped}, {pixelDetail.g.clamped}, {pixelDetail.b.clamped})
          </span>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-md">
          <table className="w-full text-xs font-mono tabular-nums border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px]">
                <th className="py-1.5 px-2 text-left font-medium">채널</th>
                <th className="py-1.5 px-2 text-right font-medium">원본값</th>
                <th className="py-1.5 px-2 text-left font-medium">계산식</th>
                <th className="py-1.5 px-2 text-right font-medium">반올림</th>
                <th className="py-1.5 px-2 text-right font-medium">최종 (0~255)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(
                [
                  { name: 'R', color: 'text-rose-700', d: pixelDetail.r },
                  { name: 'G', color: 'text-emerald-700', d: pixelDetail.g },
                  { name: 'B', color: 'text-blue-700', d: pixelDetail.b },
                ] as const
              ).map(({ name, color, d }) => {
                const expr =
                  transformMode === 'add'
                    ? `${d.original} + (${effectiveT})`
                    : transformMode === 'scale'
                      ? `${effectiveS} × ${d.original}`
                      : `${effectiveS} × ${d.original} + (${effectiveT})`;
                return (
                  <tr key={name} className="bg-white">
                    <td className={`py-1.5 px-2 font-semibold ${color}`}>{name}</td>
                    <td className="py-1.5 px-2 text-right text-slate-700">{d.original}</td>
                    <td className="py-1.5 px-2 text-slate-600">
                      {expr} = <span className="font-semibold text-slate-900">{formatRaw(d.raw)}</span>
                    </td>
                    <td className="py-1.5 px-2 text-right text-slate-700">
                      {d.rounded}
                      {d.wasRounded && (
                        <span className="ml-1 text-[10px] text-amber-700 font-sans">
                          (반올림)
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 px-2 text-right font-semibold text-slate-900">
                      {d.clamped}
                      {d.clampState === 'high' && (
                        <span className="ml-1 text-[10px] text-rose-700 font-sans">
                          (255 상한)
                        </span>
                      )}
                      {d.clampState === 'low' && (
                        <span className="ml-1 text-[10px] text-blue-700 font-sans">
                          (0 하한)
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Before / After Matrix Comparison for Selected Neighborhood */}
      <div className="flex flex-col gap-2.5 pt-1 border-t border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-900">
            선택 영역 ({selectionSize}×{selectionSize}) 변환 전후 행렬 비교
          </span>
        </div>

        <div
          role="group"
          aria-label="변환 행렬 채널 선택"
          className="grid grid-cols-4 gap-1 p-1 bg-slate-100 border border-slate-200 rounded-md"
        >
          {(
            [
              { id: 'r', label: 'R 채널' },
              { id: 'g', label: 'G 채널' },
              { id: 'b', label: 'B 채널' },
              { id: 'all', label: 'RGB 모두' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangeChannelView(tab.id)}
              className={`px-2 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                channelView === tab.id
                  ? 'bg-white text-blue-900 border border-slate-200 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <MatrixDisplay
            matrices={beforeMatrices}
            channelView={channelView}
            activeCoord={activeCoord}
            labelPrefix="변환 전 "
            onSelectCell={onSelectCoord}
          />
          <MatrixDisplay
            matrices={afterMatrices}
            compareMatrices={beforeMatrices}
            channelView={channelView}
            activeCoord={activeCoord}
            labelPrefix="변환 후 "
            symbolSuffix="′"
            onSelectCell={onSelectCoord}
          />
        </div>
      </div>
    </section>
  );
};
