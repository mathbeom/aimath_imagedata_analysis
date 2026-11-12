import React, { useState } from 'react';
import { CheckCircle2, ClipboardCheck, Save } from 'lucide-react';
import {
  ActivityRecord,
  CompositeStats,
  Experiment3Answer,
  ExperimentCheckStatus,
  RectMaskBounds,
} from '../types/lab';
import {
  EXP3_DEFAULT_4X4_ORIGIN,
  EXP3_FORMULA_OPTIONS,
  EXP3_SIGN_RECT,
  EXP3_TARGET_PIXELS,
} from '../data/experimentAssets';
import { ResultViewport } from './ResultViewport';
import { ResultConfirmToggle } from './ResultConfirmToggle';

interface Exp3CompositeResultPanelProps {
  xPixels: Uint8ClampedArray;
  yPixels: Uint8ClampedArray;
  zPixels: Uint8ClampedArray;
  stats: CompositeStats;
  maskBounds: RectMaskBounds;
  answer: Experiment3Answer;
  onChangeAnswer: (next: Experiment3Answer) => void;
  onSaveRecord: () => void;
  savedCount: number;
  recentRecords: ActivityRecord[];
  resultCheckStatus: ExperimentCheckStatus;
  onToggleResultCheck: (next: boolean) => void;
}

export const Exp3CompositeResultPanel: React.FC<Exp3CompositeResultPanelProps> = ({
  xPixels,
  yPixels,
  zPixels,
  stats,
  maskBounds,
  answer,
  onChangeAnswer,
  onSaveRecord,
  savedCount,
  recentRecords,
  resultCheckStatus,
  onToggleResultCheck,
}) => {
  const [compareBaseline, setCompareBaseline] = useState<'x' | 'y'>('x');
  const [justSaved, setJustSaved] = useState<boolean>(false);

  const updateMaskCell = (rIdx: number, cIdx: number, val: string) => {
    const nextGrid = answer.maskMatrix4x4.map((row, r) =>
      r === rIdx ? row.map((cell, c) => (c === cIdx ? val : cell)) : row,
    );
    onChangeAnswer({
      ...answer,
      maskMatrix4x4: nextGrid,
    });
  };

  const updateFormula = (blankX: string, blankY: string) => {
    onChangeAnswer({
      ...answer,
      formulaBlankX: blankX,
      formulaBlankY: blankY,
      formulaText:
        blankX || blankY
          ? `Z = X ⊙ (${blankX || '미선택'}) + Y ⊙ (${blankY || '미선택'})`
          : '',
    });
  };

  const targetMet =
    maskBounds.rowStart === EXP3_SIGN_RECT.rowStart &&
    maskBounds.rowEnd === EXP3_SIGN_RECT.rowEnd &&
    maskBounds.colStart === EXP3_SIGN_RECT.colStart &&
    maskBounds.colEnd === EXP3_SIGN_RECT.colEnd;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveRecord();
    setJustSaved(true);
    window.setTimeout(() => setJustSaved(false), 2400);
  };

  const keepRatioPct = ((stats.keptFromXPixels / stats.totalPixels) * 100).toFixed(1);

  return (
    <section
      aria-label="아다마르 곱 합성 결과 및 답안 기록 영역"
      className="flex flex-col gap-4 bg-white border border-slate-200 rounded-lg p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            3. 합성 결과 Z · 답안 기록
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            마스크 P 변경 시 전체 합성 결과 즉시 재계산
          </p>
        </div>
        <span className="text-xs font-mono tabular-nums text-blue-900 font-semibold whitespace-nowrap shrink-0">
          유지 {keepRatioPct}%
        </span>
      </div>

      {/* Baseline Switch for ResultViewport */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-slate-600">비교 기준 이미지</span>
        <div className="inline-flex p-0.5 bg-slate-100 border border-slate-200 rounded">
          <button
            type="button"
            onClick={() => setCompareBaseline('x')}
            className={`px-2 py-0.5 rounded cursor-pointer whitespace-nowrap ${
              compareBaseline === 'x'
                ? 'bg-white text-blue-900 font-semibold shadow-xs'
                : 'text-slate-600'
            }`}
          >
            원본 X vs Z
          </button>
          <button
            type="button"
            onClick={() => setCompareBaseline('y')}
            className={`px-2 py-0.5 rounded cursor-pointer whitespace-nowrap ${
              compareBaseline === 'y'
                ? 'bg-white text-blue-900 font-semibold shadow-xs'
                : 'text-slate-600'
            }`}
          >
            배경 Y vs Z
          </button>
        </div>
      </div>

      <ResultViewport
        originalPixels={compareBaseline === 'x' ? xPixels : yPixels}
        resultPixels={zPixels}
        resultLabel="합성 결과 이미지 Z"
      />

      {/* Mask Pixel Distribution Summary */}
      <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-md font-mono tabular-nums text-xs">
        <div className="bg-white border border-slate-200 rounded p-2">
          <span className="block font-sans text-[11px] text-slate-500">
            원본 X 유지 (P = 1)
          </span>
          <span className="text-sm font-semibold text-blue-900">
            {stats.keptFromXPixels.toLocaleString()} px
          </span>
        </div>
        <div className="bg-white border border-slate-200 rounded p-2">
          <span className="block font-sans text-[11px] text-slate-500">
            배경 Y 교체 (P = 0)
          </span>
          <span className="text-sm font-semibold text-slate-800">
            {stats.replacedWithYPixels.toLocaleString()} px
          </span>
        </div>
        <div className="col-span-2 text-[11px] text-slate-600 flex items-center justify-between pt-0.5">
          <span className="font-sans">선택 영역 범위</span>
          <span>
            {maskBounds.rowStart}~{maskBounds.rowEnd}행, {maskBounds.colStart}~{maskBounds.colEnd}열
          </span>
        </div>
      </div>

      {/* 목표 조건 카드 (정답 영역 좌표는 공개하지 않음) */}
      <div className="flex flex-col gap-1.5 p-3 bg-slate-50 border border-slate-200 rounded-md text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-slate-900">목표 합성 이미지 조건</span>
          <span
            data-testid="exp3-target-status"
            className={`font-semibold ${targetMet ? 'text-emerald-700' : 'text-slate-500'}`}
          >
            {targetMet ? '목표 일치' : '미일치'}
          </span>
        </div>
        <p className="text-slate-700 leading-relaxed">
          안내 표지판을 <strong>짙은 테두리까지 모두 포함하는 가장 작은 직사각형</strong>만 원본 X에서
          유지하고(P=1), 나머지는 모두 배경 Y로 교체(P=0)합니다.
        </p>
      </div>

      {/* Student Worksheet (Strictly Manual) */}
      <form
        onSubmit={handleSave}
        className="flex flex-col gap-2.5 pt-2 border-t border-slate-200"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
            <ClipboardCheck className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
            <span>실험 ③ 수행평가 답안 입력 (직접 작성)</span>
          </h3>
          <span className="text-[11px] text-slate-500">자동 채움 없음</span>
        </div>

        {/* 합성식 빈칸 선택 (⊙ 기호를 타이핑하지 않아도 됨) */}
        <div className="p-2.5 bg-blue-50 border border-blue-200 rounded text-xs text-blue-950 flex flex-col gap-1.5">
          <span className="font-semibold text-blue-900">
            합성식 완성하기 — 빈칸에 알맞은 행렬을 고르세요
          </span>
          <div className="flex flex-wrap items-center gap-1.5 font-mono font-bold text-blue-900 text-sm">
            <span>Z = X ⊙</span>
            <select
              value={answer.formulaBlankX ?? ''}
              onChange={(e) => updateFormula(e.target.value, answer.formulaBlankY ?? '')}
              aria-label="합성식 첫 번째 빈칸 (X에 곱하는 행렬)"
              className="px-1.5 py-1 text-xs font-mono bg-white border border-blue-300 rounded cursor-pointer"
            >
              <option value="">선택</option>
              {EXP3_FORMULA_OPTIONS.map((opt) => (
                <option key={`fx-${opt}`} value={opt}>{opt}</option>
              ))}
            </select>
            <span>+ Y ⊙</span>
            <select
              value={answer.formulaBlankY ?? ''}
              onChange={(e) => updateFormula(answer.formulaBlankX ?? '', e.target.value)}
              aria-label="합성식 두 번째 빈칸 (Y에 곱하는 행렬)"
              className="px-1.5 py-1 text-xs font-mono bg-white border border-blue-300 rounded cursor-pointer"
            >
              <option value="">선택</option>
              {EXP3_FORMULA_OPTIONS.map((opt) => (
                <option key={`fy-${opt}`} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            P: 마스크 행렬(0 또는 1) · J: 모든 성분이 1인 행렬 · ⊙: 같은 위치 성분끼리의 곱
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-700">
            지정 4×4 영역 ({EXP3_DEFAULT_4X4_ORIGIN.row}~{EXP3_DEFAULT_4X4_ORIGIN.row + 3}행,{' '}
            {EXP3_DEFAULT_4X4_ORIGIN.col}~{EXP3_DEFAULT_4X4_ORIGIN.col + 3}열)의 마스크 행렬 P (0 또는 1 입력)
          </span>
          <div className="grid grid-cols-4 gap-1 bg-slate-50 p-1.5 rounded border border-slate-200">
            {answer.maskMatrix4x4.map((row, rIdx) =>
              row.map((val, cIdx) => (
                <input
                  key={`p4-${rIdx}-${cIdx}`}
                  type="number"
                  min={0}
                  max={1}
                  value={val}
                  onChange={(e) => updateMaskCell(rIdx, cIdx, e.target.value)}
                  aria-label={`4x4 마스크 행렬 P ${rIdx + 1}행 ${cIdx + 1}열`}
                  placeholder="0/1"
                  className="w-full px-1 py-1 text-xs font-mono tabular-nums text-center bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-600"
                />
              )),
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-slate-700">
            목표 이미지를 완성한 뒤, 지정 픽셀 두 곳의 값을 기록하세요
          </span>
          {(
            [
              { n: '①', coord: EXP3_TARGET_PIXELS[0], p: 'samplePixelMaskP', x: 'samplePixelXRgb', y: 'samplePixelYRgb', z: 'samplePixelZRgb' },
              { n: '②', coord: EXP3_TARGET_PIXELS[1], p: 'sample2MaskP', x: 'sample2XRgb', y: 'sample2YRgb', z: 'sample2ZRgb' },
            ] as const
          ).map((px) => (
            <div
              key={px.n}
              className="flex flex-col gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded text-xs"
            >
              <span className="font-semibold text-slate-900">
                지정 픽셀 {px.n}{' '}
                <span className="font-mono tabular-nums text-blue-900">
                  ({px.coord.row}, {px.coord.col})
                </span>
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    { key: px.p, label: '마스크 P 값', ph: '0 또는 1' },
                    { key: px.x, label: 'X의 RGB', ph: '(R, G, B)' },
                    { key: px.y, label: 'Y의 RGB', ph: '(R, G, B)' },
                    { key: px.z, label: '합성 후 Z의 RGB', ph: '(R, G, B)' },
                  ] as const
                ).map((f) => (
                  <label key={f.key} className="flex flex-col gap-0.5">
                    <span className="text-[11px] font-medium text-slate-600">{f.label}</span>
                    <input
                      type="text"
                      value={answer[f.key] ?? ''}
                      onChange={(e) => onChangeAnswer({ ...answer, [f.key]: e.target.value })}
                      placeholder={f.ph}
                      aria-label={`지정 픽셀 ${px.n} ${f.label}`}
                      className="px-2 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-600"
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <ResultConfirmToggle
          experimentNumber={3}
          status={resultCheckStatus}
          onToggle={onToggleResultCheck}
        />

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-[11px] text-slate-500">
            저장된 실험 기록 {savedCount}건
          </span>
          <button
            type="submit"
            data-testid="exp3-save-record-btn"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-md transition-colors cursor-pointer whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5" aria-hidden="true" />
            <span>실험 ③ 기록 저장</span>
          </button>
        </div>

        {justSaved && (
          <div
            role="status"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded"
          >
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>마스크 설정, 합성 결과 Z, 작성한 답안이 활동 기록에 저장되었습니다.</span>
          </div>
        )}
      </form>

      {recentRecords.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-200">
          <span className="text-xs font-semibold text-slate-700">
            최근 저장 기록 ({recentRecords.length}건)
          </span>
          <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
            {recentRecords.slice(0, 3).map((rec) => (
              <div
                key={rec.id}
                className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded text-xs"
              >
                {rec.resultImageDataUrl && (
                  <img
                    src={rec.resultImageDataUrl}
                    alt={`${rec.experimentTitle} 저장 이미지`}
                    className="w-9 h-9 rounded border border-slate-300 pixelated-canvas shrink-0"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-800 truncate">
                    {rec.summary}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500">
                    {new Date(rec.timestampIso).toLocaleTimeString('ko-KR')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
