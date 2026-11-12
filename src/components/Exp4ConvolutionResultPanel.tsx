import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, CircleDashed, ClipboardCheck, Save } from 'lucide-react';
import {
  CORRIDOR_HEIGHT,
  CORRIDOR_WIDTH,
} from '../data/corridorImage';
import {
  checkExp4Targets,
  convolutionRawToRgbaPixels,
  FullConvolutionStats,
  grayscaleToRgbaPixels,
} from '../engine/convolutionMath';
import { EXP4_EVAL_CENTER } from '../data/experimentAssets';
import {
  ActivityRecord,
  ConvolutionFilterType,
  EdgeDisplayMode,
  Experiment4Answer,
  ExperimentCheckStatus,
} from '../types/lab';
import { ResultViewport } from './ResultViewport';
import { ResultConfirmToggle } from './ResultConfirmToggle';

interface Exp4ConvolutionResultPanelProps {
  grayscale: Uint8Array;
  activeRawValues: Float32Array;
  activeStats: FullConvolutionStats;
  meanRawValues: Float32Array;
  edgeRawValues: Float32Array;
  filterType: ConvolutionFilterType;
  meanK: number;
  edgeM: number;
  edgeDisplayMode: EdgeDisplayMode;
  onChangeEdgeDisplayMode: (mode: EdgeDisplayMode) => void;
  answer: Experiment4Answer;
  onChangeAnswer: (next: Experiment4Answer) => void;
  onSaveRecord: () => void;
  savedCount: number;
  recentRecords: ActivityRecord[];
  resultCheckStatus: ExperimentCheckStatus;
  onToggleResultCheck: (next: boolean) => void;
}

export const Exp4ConvolutionResultPanel: React.FC<Exp4ConvolutionResultPanelProps> = ({
  grayscale,
  activeRawValues,
  activeStats,
  meanRawValues,
  edgeRawValues,
  filterType,
  meanK,
  edgeM,
  edgeDisplayMode,
  onChangeEdgeDisplayMode,
  answer,
  onChangeAnswer,
  onSaveRecord,
  savedCount,
  recentRecords,
  resultCheckStatus,
  onToggleResultCheck,
}) => {
  const [compareView, setCompareView] = useState<'active' | 'mean-vs-edge'>('active');
  const [justSaved, setJustSaved] = useState<boolean>(false);

  const meanCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const edgeCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const origRgba = grayscaleToRgbaPixels(grayscale);
  const activeResultRgba = convolutionRawToRgbaPixels(activeRawValues, edgeDisplayMode);

  useEffect(() => {
    if (compareView !== 'mean-vs-edge') return;
    if (meanCanvasRef.current) {
      const ctx = meanCanvasRef.current.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        const meanRgba = convolutionRawToRgbaPixels(meanRawValues, 'clamp');
        ctx.putImageData(
          new ImageData(new Uint8ClampedArray(meanRgba), CORRIDOR_WIDTH, CORRIDOR_HEIGHT),
          0,
          0,
        );
      }
    }
    if (edgeCanvasRef.current) {
      const ctx = edgeCanvasRef.current.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        const edgeRgba = convolutionRawToRgbaPixels(edgeRawValues, edgeDisplayMode);
        ctx.putImageData(
          new ImageData(new Uint8ClampedArray(edgeRgba), CORRIDOR_WIDTH, CORRIDOR_HEIGHT),
          0,
          0,
        );
      }
    }
  }, [compareView, meanRawValues, edgeRawValues, edgeDisplayMode]);

  const targetStatus = checkExp4Targets(grayscale, edgeM, meanK);

  const updateMatrixField = (
    field: 'meanOutput3x3' | 'edgeKernel3x3' | 'edgeOutput3x3',
    rIdx: number,
    cIdx: number,
    val: string,
  ) => {
    const nextGrid = answer[field].map((row, r) =>
      r === rIdx ? row.map((cell, c) => (c === cIdx ? val : cell)) : row,
    );
    onChangeAnswer({
      ...answer,
      [field]: nextGrid,
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveRecord();
    setJustSaved(true);
    window.setTimeout(() => setJustSaved(false), 2400);
  };

  return (
    <section
      aria-label="전체 이미지 필터 변환 결과 및 답안 기록 영역"
      className="flex flex-col gap-4 bg-white border border-slate-200 rounded-lg p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            3. 전체 필터 결과 · 답안 기록
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            64×64 합성곱 연산 비교 및 목표 확인
          </p>
        </div>
        {targetStatus.allMet ? (
          <span
            data-testid="exp4-condition-status"
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 whitespace-nowrap shrink-0"
          >
            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            <span>실험 A·B 조건 충족</span>
          </span>
        ) : (
          <span
            data-testid="exp4-condition-status"
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 whitespace-nowrap shrink-0"
          >
            <CircleDashed className="w-3.5 h-3.5" aria-hidden="true" />
            <span>탐색 중</span>
          </span>
        )}
      </div>

      {/* View Switch: Active Filter Result vs Mean/Edge Direct Comparison */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-slate-600 font-medium">전체 결과 비교 방식</span>
        <div className="inline-flex p-0.5 bg-slate-100 border border-slate-200 rounded">
          <button
            type="button"
            onClick={() => setCompareView('active')}
            className={`px-2 py-0.5 rounded cursor-pointer whitespace-nowrap ${
              compareView === 'active'
                ? 'bg-white text-blue-900 font-semibold shadow-xs'
                : 'text-slate-600'
            }`}
          >
            원본 vs {filterType === 'mean' ? '평균 K₁' : '경계 K₂'}
          </button>
          <button
            type="button"
            onClick={() => setCompareView('mean-vs-edge')}
            className={`px-2 py-0.5 rounded cursor-pointer whitespace-nowrap ${
              compareView === 'mean-vs-edge'
                ? 'bg-white text-blue-900 font-semibold shadow-xs'
                : 'text-slate-600'
            }`}
          >
            평균 K₁ vs 경계 K₂
          </button>
        </div>
      </div>

      {compareView === 'active' ? (
        <ResultViewport
          originalPixels={origRgba}
          resultPixels={activeResultRgba}
          resultLabel={
            filterType === 'mean'
              ? `평균 필터 K₁ (k=${meanK}) 적용 결과`
              : `경계 필터 K₂ (m=${edgeM}) 적용 결과`
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-slate-700 text-center">
              평균 필터 K₁ (k={meanK})
            </span>
            <div className="aspect-square bg-slate-200 border-2 border-slate-300 rounded overflow-hidden">
              <canvas
                ref={meanCanvasRef}
                width={CORRIDOR_WIDTH}
                height={CORRIDOR_HEIGHT}
                className="w-full h-full block pixelated-canvas"
                aria-label="평균 필터 K1 적용 결과 캔버스"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-blue-900 text-center">
              경계 필터 K₂ (m={edgeM})
            </span>
            <div className="aspect-square bg-slate-200 border-2 border-blue-400 rounded overflow-hidden">
              <canvas
                ref={edgeCanvasRef}
                width={CORRIDOR_WIDTH}
                height={CORRIDOR_HEIGHT}
                className="w-full h-full block pixelated-canvas"
                aria-label="경계 필터 K2 적용 결과 캔버스"
              />
            </div>
          </div>
        </div>
      )}

      {/* Display Mapping Clarification Control (Separate from math values) */}
      <div className="flex flex-col gap-1.5 p-2.5 bg-slate-50 border border-slate-200 rounded-md text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold text-slate-900">
            화면 표시용 변환 (수학적 계산 행렬과 분리)
          </span>
          <div className="inline-flex p-0.5 bg-white border border-slate-200 rounded text-[11px]">
            <button
              type="button"
              onClick={() => onChangeEdgeDisplayMode('clamp')}
              className={`px-2 py-0.5 rounded cursor-pointer whitespace-nowrap ${
                edgeDisplayMode === 'clamp'
                  ? 'bg-blue-900 text-white font-semibold'
                  : 'text-slate-600'
              }`}
            >
              0~255 제한
            </button>
            <button
              type="button"
              onClick={() => onChangeEdgeDisplayMode('abs')}
              className={`px-2 py-0.5 rounded cursor-pointer whitespace-nowrap ${
                edgeDisplayMode === 'abs'
                  ? 'bg-blue-900 text-white font-semibold'
                  : 'text-slate-600'
              }`}
            >
              절댓값 |값| 표시
            </button>
          </div>
        </div>
        <p className="text-[11px] text-slate-600 leading-relaxed">
          가운데 3×3 출력 행렬은 음수·255 초과 값을 그대로 유지하며, 위 이미지 화면을 그릴 때만 선택한 방식으로 0~255 밝기로 변환합니다.
        </p>
        <div className="grid grid-cols-3 gap-1.5 pt-0.5 font-mono tabular-nums text-[11px]">
          <div className="bg-white border border-slate-200 rounded px-2 py-1">
            <span className="text-slate-400 block font-sans">최소~최대</span>
            <span className="font-semibold text-slate-800">
              {activeStats.minRaw}~{activeStats.maxRaw}
            </span>
          </div>
          <div className="bg-white border border-slate-200 rounded px-2 py-1">
            <span className="text-slate-400 block font-sans">음수 픽셀</span>
            <span className="font-semibold text-rose-700">
              {activeStats.negativePixelCount.toLocaleString()}개
            </span>
          </div>
          <div className="bg-white border border-slate-200 rounded px-2 py-1">
            <span className="text-slate-400 block font-sans">255 초과</span>
            <span className="font-semibold text-amber-700">
              {activeStats.over255PixelCount.toLocaleString()}개
            </span>
          </div>
        </div>
      </div>

      {/* Experiment A & B Target Verification Card (Zero Hints for x, k or m) */}
      <div className="flex flex-col gap-2 p-3 bg-slate-50 border border-slate-200 rounded-md text-xs">
        <span className="font-semibold text-slate-900">
          평가 목표 출력 행렬 일치 여부 (좌표 {EXP4_EVAL_CENTER.row}, {EXP4_EVAL_CENTER.col} 기준)
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono tabular-nums text-[11px]">
          <div className="bg-white border border-slate-200 rounded p-2">
            <div className="flex items-center justify-between font-sans mb-1">
              <span className="font-semibold text-slate-900">실험 A (평균 K₁)</span>
              <span
                className={`font-semibold ${
                  targetStatus.meanMet ? 'text-emerald-700' : 'text-slate-500'
                }`}
              >
                {targetStatus.meanMet ? '목표 일치' : '미일치'}
              </span>
            </div>
            <div className="text-slate-500 font-sans text-[10px] mb-0.5">
              제시 목표: [30, 70, 110] 반복
            </div>
            <div className="text-slate-800">
              현재 1행: [{targetStatus.meanMatrix[0].join(', ')}]
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded p-2">
            <div className="flex items-center justify-between font-sans mb-1">
              <span className="font-semibold text-slate-900">실험 B (경계 K₂)</span>
              <span
                className={`font-semibold ${
                  targetStatus.edgeMet ? 'text-emerald-700' : 'text-slate-500'
                }`}
              >
                {targetStatus.edgeMet ? '목표 일치' : '미일치'}
              </span>
            </div>
            <div className="text-slate-500 font-sans text-[10px] mb-0.5">
              제시 목표: [60, 240, 180] 반복
            </div>
            <div className="text-slate-800">
              현재 1행: [{targetStatus.edgeMatrix[0].join(', ')}]
            </div>
          </div>
        </div>
      </div>

      {/* Student Worksheet (Strictly Manual, No Auto-Fill, No Vague Reflection) */}
      <form
        onSubmit={handleSave}
        className="flex flex-col gap-2.5 pt-2 border-t border-slate-200"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
            <ClipboardCheck className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
            <span>실험 ④ 수행평가 답안 입력 (직접 작성)</span>
          </h3>
          <span className="text-[11px] text-slate-500">자동 채움 없음</span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <label className="flex flex-col gap-1">
            <span className="font-medium text-slate-700">구한 픽셀 x 값</span>
            <input
              type="text"
              value={answer.recordedX}
              onChange={(e) =>
                onChangeAnswer({ ...answer, recordedX: e.target.value })
              }
              placeholder="정수 입력"
              className="px-2 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-600"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium text-slate-700">구한 계수 k 값</span>
            <input
              type="text"
              value={answer.recordedK ?? ''}
              onChange={(e) =>
                onChangeAnswer({ ...answer, recordedK: e.target.value })
              }
              placeholder="1, 2, 3 중"
              aria-label="구한 평균 필터 계수 k 값"
              className="px-2 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-600"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium text-slate-700">구한 계수 m 값</span>
            <input
              type="text"
              value={answer.recordedM}
              onChange={(e) =>
                onChangeAnswer({ ...answer, recordedM: e.target.value })
              }
              placeholder="1, 2, 3 중"
              className="px-2 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-600"
            />
          </label>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-700">
            실험 A · 평균 필터 K₁ 적용 3×3 출력 행렬
          </span>
          <div className="grid grid-cols-3 gap-1 bg-slate-50 p-1.5 rounded border border-slate-200">
            {answer.meanOutput3x3.map((row, rIdx) =>
              row.map((val, cIdx) => (
                <input
                  key={`m3-${rIdx}-${cIdx}`}
                  type="text"
                  value={val}
                  onChange={(e) =>
                    updateMatrixField('meanOutput3x3', rIdx, cIdx, e.target.value)
                  }
                  aria-label={`평균 필터 3x3 출력 ${rIdx + 1}행 ${cIdx + 1}열`}
                  placeholder="값"
                  className="w-full px-1.5 py-1 text-xs font-mono tabular-nums text-center bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-600"
                />
              )),
            )}
          </div>
        </div>

        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-slate-700">평균 필터 계산 과정</span>
          <textarea
            rows={2}
            value={answer.meanCalcStep}
            onChange={(e) =>
              onChangeAnswer({ ...answer, meanCalcStep: e.target.value })
            }
            placeholder="원본 3×3 영역과 k/9의 대응 곱을 더해 출력값을 구한 과정을 적으세요."
            className="px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-600 resize-y"
          />
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-700">
            실험 B · 구한 m을 대입한 경계 필터 행렬 K₂ (3×3)
          </span>
          <div className="grid grid-cols-3 gap-1 bg-slate-50 p-1.5 rounded border border-slate-200">
            {answer.edgeKernel3x3.map((row, rIdx) =>
              row.map((val, cIdx) => (
                <input
                  key={`ek-${rIdx}-${cIdx}`}
                  type="text"
                  value={val}
                  onChange={(e) =>
                    updateMatrixField('edgeKernel3x3', rIdx, cIdx, e.target.value)
                  }
                  aria-label={`경계 필터 행렬 K2 ${rIdx + 1}행 ${cIdx + 1}열`}
                  placeholder="분수/정수"
                  className="w-full px-1.5 py-1 text-xs font-mono tabular-nums text-center bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-600"
                />
              )),
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-700">
            실험 B · 경계 필터 K₂ 적용 3×3 출력 행렬
          </span>
          <div className="grid grid-cols-3 gap-1 bg-slate-50 p-1.5 rounded border border-slate-200">
            {answer.edgeOutput3x3.map((row, rIdx) =>
              row.map((val, cIdx) => (
                <input
                  key={`eo-${rIdx}-${cIdx}`}
                  type="text"
                  value={val}
                  onChange={(e) =>
                    updateMatrixField('edgeOutput3x3', rIdx, cIdx, e.target.value)
                  }
                  aria-label={`경계 필터 3x3 출력 ${rIdx + 1}행 ${cIdx + 1}열`}
                  placeholder="값"
                  className="w-full px-1.5 py-1 text-xs font-mono tabular-nums text-center bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-600"
                />
              )),
            )}
          </div>
        </div>

        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-slate-700">경계 필터 계산 과정</span>
          <textarea
            rows={2}
            value={answer.edgeCalcStep}
            onChange={(e) =>
              onChangeAnswer({ ...answer, edgeCalcStep: e.target.value })
            }
            placeholder="경계 필터 행렬 K₂의 성분을 대응 곱하여 출력값을 구한 과정을 적으세요."
            className="px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-600 resize-y"
          />
        </label>

        <ResultConfirmToggle
          experimentNumber={4}
          status={resultCheckStatus}
          onToggle={onToggleResultCheck}
        />

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-[11px] text-slate-500">
            저장된 실험 기록 {savedCount}건
          </span>
          <button
            type="submit"
            data-testid="exp4-save-record-btn"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-md transition-colors cursor-pointer whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5" aria-hidden="true" />
            <span>실험 ④ 기록 저장</span>
          </button>
        </div>

        {justSaved && (
          <div
            role="status"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded"
          >
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>합성곱 필터 설정, 결과 이미지, 작성한 답안이 활동 기록에 저장되었습니다.</span>
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
