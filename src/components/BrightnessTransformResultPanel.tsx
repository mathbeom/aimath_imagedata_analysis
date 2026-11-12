import React, { useState } from 'react';
import { CheckCircle2, CircleDashed, ClipboardCheck, Save } from 'lucide-react';
import {
  ActivityRecord,
  Experiment2Answer,
  ExperimentCheckStatus,
  PixelCoord,
  TransformMode,
  TransformStats,
} from '../types/lab';
import {
  EXP2_ANCHOR_C,
  EXP2_EXPECTED_C,
} from '../data/corridorImage';
import {
  checkExperiment2Targets,
  computePixelTransformDetail,
  getEffectiveParams,
  readPixel,
} from '../engine/imageMath';
import { ResultViewport } from './ResultViewport';
import { ResultConfirmToggle } from './ResultConfirmToggle';

interface BrightnessTransformResultPanelProps {
  originalPixels: Uint8ClampedArray;
  transformedPixels: Uint8ClampedArray;
  stats: TransformStats;
  activeCoord: PixelCoord;
  transformMode: TransformMode;
  sValue: number;
  tValue: number;
  answer: Experiment2Answer;
  onChangeAnswer: (next: Experiment2Answer) => void;
  onSaveRecord: () => void;
  savedCount: number;
  recentRecords: ActivityRecord[];
  onSelectCoord: (coord: PixelCoord) => void;
  resultCheckStatus: ExperimentCheckStatus;
  onToggleResultCheck: (next: boolean) => void;
}

export const BrightnessTransformResultPanel: React.FC<BrightnessTransformResultPanelProps> = ({
  originalPixels,
  transformedPixels,
  stats,
  activeCoord,
  transformMode,
  sValue,
  tValue,
  answer,
  onChangeAnswer,
  onSaveRecord,
  savedCount,
  recentRecords,
  onSelectCoord,
  resultCheckStatus,
  onToggleResultCheck,
}) => {
  const [justSaved, setJustSaved] = useState<boolean>(false);

  const targetStatus = checkExperiment2Targets(
    originalPixels,
    transformMode,
    sValue,
    tValue,
  );

  const { effectiveS, effectiveT } = getEffectiveParams(
    transformMode,
    sValue,
    tValue,
  );

  const activeOrig = readPixel(originalPixels, activeCoord.row, activeCoord.col);
  const activeDetail = computePixelTransformDetail(
    activeOrig,
    transformMode,
    sValue,
    tValue,
  );

  const detailC = computePixelTransformDetail(
    EXP2_EXPECTED_C,
    transformMode,
    sValue,
    tValue,
  );

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveRecord();
    setJustSaved(true);
    window.setTimeout(() => setJustSaved(false), 2400);
  };

  return (
    <section
      aria-label="색상과 밝기 변환 결과 및 답안 기록 영역"
      className="flex flex-col gap-4 bg-white border border-slate-200 rounded-lg p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            3. 결과 분석 · 목표 확인 및 기록
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            전체 이미지 행렬 연산 결과 비교 및 지정 픽셀 검증
          </p>
        </div>
        {targetStatus.allMet ? (
          <span
            data-testid="exp2-condition-status"
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 whitespace-nowrap shrink-0"
          >
            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            <span>조건 충족</span>
          </span>
        ) : (
          <span
            data-testid="exp2-condition-status"
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 whitespace-nowrap shrink-0"
          >
            <CircleDashed className="w-3.5 h-3.5" aria-hidden="true" />
            <span>탐색 중</span>
          </span>
        )}
      </div>

      {/* Large Result Image & Comparison */}
      <ResultViewport
        originalPixels={originalPixels}
        resultPixels={transformedPixels}
        resultLabel="행렬 변환 결과 이미지"
      />

      {/* Target Pixels Evaluation Panel (No Hints, No Auto-Recommend) */}
      <div className="flex flex-col gap-2 p-3 bg-slate-50 border border-slate-200 rounded-md">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold text-slate-900">
            평가 과제 목표 픽셀 변화 확인
          </h3>
          <span className="text-[11px] font-mono text-slate-500">
            적용: s={effectiveS}, t={effectiveT >= 0 ? `+${effectiveT}` : effectiveT}
          </span>
        </div>

        <p className="text-[11px] text-slate-600 leading-relaxed">
          아래 두 목표 RGB 값이 동시에 만들어지도록 연산 종류와 매개변수(s, t)를 직접 조절해 보세요.
        </p>

        <div className="flex flex-col gap-2 font-mono tabular-nums text-xs">
          {[targetStatus.pixelA, targetStatus.pixelB].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => onSelectCoord(item.coord)}
              className="text-left bg-white border border-slate-200 hover:border-blue-300 rounded p-2.5 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-sans font-semibold text-slate-900">
                  {item.label} ({item.coord.row}, {item.coord.col})
                </span>
                <span
                  className={`font-sans text-[11px] font-semibold inline-flex items-center gap-1 ${
                    item.isMet ? 'text-emerald-700' : 'text-slate-500'
                  }`}
                >
                  {item.isMet ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>목표 일치</span>
                    </>
                  ) : (
                    <span>미일치</span>
                  )}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 mt-1.5 text-[11px]">
                <div>
                  <span className="text-slate-400 block font-sans">원본</span>
                  <span className="text-slate-700">
                    ({item.original.r}, {item.original.g}, {item.original.b})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-sans">현재 결과</span>
                  <span
                    className={
                      item.isMet
                        ? 'text-emerald-700 font-semibold'
                        : 'text-blue-900 font-semibold'
                    }
                  >
                    ({item.current.r}, {item.current.g}, {item.current.b})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-sans">제시 목표</span>
                  <span className="text-slate-900 font-semibold">
                    ({item.target.r}, {item.target.g}, {item.target.b})
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Selected Pixel & Overflow/Clamping Statistics */}
      <div className="flex flex-col gap-2 p-3 bg-slate-50 border border-slate-200 rounded-md text-xs">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-900">
            0~255 범위 제한 및 반올림 통계
          </span>
          <span className="font-mono tabular-nums text-[11px] text-slate-500">
            전체 {stats.totalChannels.toLocaleString()}개 성분
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 font-mono tabular-nums">
          <div className="bg-white border border-slate-200 rounded p-2">
            <span className="block font-sans text-[11px] text-slate-500">255 초과→255</span>
            <span className="text-sm font-semibold text-rose-700">
              {stats.clippedHighChannels.toLocaleString()}
            </span>
          </div>
          <div className="bg-white border border-slate-200 rounded p-2">
            <span className="block font-sans text-[11px] text-slate-500">0 미만→0</span>
            <span className="text-sm font-semibold text-blue-700">
              {stats.clippedLowChannels.toLocaleString()}
            </span>
          </div>
          <div className="bg-white border border-slate-200 rounded p-2">
            <span className="block font-sans text-[11px] text-slate-500">소수 반올림</span>
            <span className="text-sm font-semibold text-amber-700">
              {stats.roundedChannels.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded p-2 text-[11px] font-mono tabular-nums text-slate-700">
          <div className="flex items-center justify-between font-sans mb-1">
            <span className="font-medium text-slate-800">
              현재 선택 픽셀 ({activeCoord.row}, {activeCoord.col}) 결과
            </span>
            <span>
              ({activeOrig.r}, {activeOrig.g}, {activeOrig.b}) → ({activeDetail.r.clamped}, {activeDetail.g.clamped}, {activeDetail.b.clamped})
            </span>
          </div>
          <div className="flex items-center justify-between font-sans text-slate-500">
            <button
              type="button"
              onClick={() => onSelectCoord(EXP2_ANCHOR_C)}
              className="text-blue-700 hover:underline cursor-pointer"
            >
              밝은 벽면 픽셀 C ({EXP2_ANCHOR_C.row}, {EXP2_ANCHOR_C.col}) 이동
            </button>
            <span>
              (215, 223, 231) → ({detailC.r.clamped}, {detailC.g.clamped}, {detailC.b.clamped})
            </span>
          </div>
        </div>
      </div>

      {/* Student Worksheet for Experiment 2 */}
      <form
        onSubmit={handleSave}
        className="flex flex-col gap-2.5 pt-2 border-t border-slate-200"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
            <ClipboardCheck className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
            <span>실험 ② 수행평가 답안 입력 (직접 작성)</span>
          </h3>
          <span className="text-[11px] text-slate-500">자동 채움 없음</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <label className="flex flex-col gap-1 text-xs sm:col-span-1">
            <span className="font-medium text-slate-700">사용한 변환식</span>
            <select
              value={answer.selectedFormula}
              onChange={(e) =>
                onChangeAnswer({ ...answer, selectedFormula: e.target.value })
              }
              className="px-2 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-600"
            >
              <option value="A' = A + tJ">A′ = A + tJ</option>
              <option value="A' = sA">A′ = sA</option>
              <option value="A' = sA + tJ">A′ = sA + tJ</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-slate-700">기록한 s 값</span>
            <input
              type="text"
              value={answer.recordedS}
              onChange={(e) =>
                onChangeAnswer({ ...answer, recordedS: e.target.value })
              }
              placeholder="선택한 s 값"
              className="px-2 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-600"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-slate-700">기록한 t 값</span>
            <input
              type="text"
              value={answer.recordedT}
              onChange={(e) =>
                onChangeAnswer({ ...answer, recordedT: e.target.value })
              }
              placeholder="선택한 t 값"
              className="px-2 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-600"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-slate-700">
            목표 픽셀 A (40, 80, 120)의 RGB 계산 과정
          </span>
          <textarea
            rows={2}
            value={answer.pixelACalculation}
            onChange={(e) =>
              onChangeAnswer({ ...answer, pixelACalculation: e.target.value })
            }
            placeholder="R, G, B 각 성분에 s와 t를 대입한 계산 과정을 직접 적으세요."
            className="px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-600 resize-y"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-slate-700">
            목표 픽셀 B (160, 100, 60)의 RGB 계산 과정
          </span>
          <textarea
            rows={2}
            value={answer.pixelBCalculation}
            onChange={(e) =>
              onChangeAnswer({ ...answer, pixelBCalculation: e.target.value })
            }
            placeholder="R, G, B 각 성분에 s와 t를 대입한 계산 과정을 직접 적으세요."
            className="px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-600 resize-y"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-slate-700">
            지정한 다른 픽셀의 변환 전후 RGB 값
          </span>
          <input
            type="text"
            value={answer.otherPixelBeforeAfter}
            onChange={(e) =>
              onChangeAnswer({
                ...answer,
                otherPixelBeforeAfter: e.target.value,
              })
            }
            placeholder="예: (25, 104) 원본 (215, 223, 231) → 변환 후 (255, 255, 255)"
            className="px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-600"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-slate-700">
            255를 초과한 성분의 처리 결과 및 탐구 관찰
          </span>
          <textarea
            rows={2}
            value={answer.overflowHandlingNote}
            onChange={(e) =>
              onChangeAnswer({ ...answer, overflowHandlingNote: e.target.value })
            }
            placeholder="255를 넘긴 픽셀이 어떤 값으로 고정되며, 이미지에서 어떻게 보이는지 적으세요."
            className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-600 resize-y"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-slate-700">
            추가 탐구 메모 (t·s 변화에 따른 밝기와 픽셀 차이 변화)
          </span>
          <textarea
            rows={2}
            value={answer.inquiryReflectionNote}
            onChange={(e) =>
              onChangeAnswer({
                ...answer,
                inquiryReflectionNote: e.target.value,
              })
            }
            placeholder="t를 늘릴 때와 s를 늘릴 때 두 픽셀의 RGB 차이가 어떻게 달라지는지 비교해 적으세요."
            className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-600 resize-y"
          />
        </label>

        <ResultConfirmToggle
          experimentNumber={2}
          status={resultCheckStatus}
          onToggle={onToggleResultCheck}
        />

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-[11px] text-slate-500">
            저장된 실험 기록 {savedCount}건
          </span>
          <button
            type="submit"
            data-testid="exp2-save-record-btn"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-md transition-colors cursor-pointer whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5" aria-hidden="true" />
            <span>실험 ② 기록 저장</span>
          </button>
        </div>

        {justSaved && (
          <div
            role="status"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded"
          >
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>연산 설정값, 결과 이미지, 작성한 답안이 활동 기록에 저장되었습니다.</span>
          </div>
        )}
      </form>

      {/* Inline Recent Records Preview */}
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
