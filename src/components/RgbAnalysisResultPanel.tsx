import React, { useState } from 'react';
import { CheckCircle2, ClipboardCheck, Save } from 'lucide-react';
import {
  ActivityRecord,
  Experiment1Answer,
  ExperimentCheckStatus,
  PixelCoord,
} from '../types/lab';
import {
  countModifiedPixels,
  readPixel,
} from '../engine/imageMath';
import { EXP1_ANCHOR } from '../data/corridorImage';
import { EXP1_EDIT_DELTA_B } from '../data/experimentAssets';
import { ResultViewport } from './ResultViewport';
import { ResultConfirmToggle } from './ResultConfirmToggle';

interface RgbAnalysisResultPanelProps {
  originalPixels: Uint8ClampedArray;
  workingPixels: Uint8ClampedArray;
  activeCoord: PixelCoord;
  regionCenter: PixelCoord;
  answer: Experiment1Answer;
  onChangeAnswer: (next: Experiment1Answer) => void;
  onSaveRecord: () => void;
  savedCount: number;
  recentRecords: ActivityRecord[];
  resultCheckStatus: ExperimentCheckStatus;
  onToggleResultCheck: (next: boolean) => void;
}

export const RgbAnalysisResultPanel: React.FC<RgbAnalysisResultPanelProps> = ({
  originalPixels,
  workingPixels,
  activeCoord,
  regionCenter,
  answer,
  onChangeAnswer,
  onSaveRecord,
  savedCount,
  recentRecords,
  resultCheckStatus,
  onToggleResultCheck,
}) => {
  const [justSaved, setJustSaved] = useState<boolean>(false);

  const origPixel = readPixel(originalPixels, activeCoord.row, activeCoord.col);
  const currPixel = readPixel(workingPixels, activeCoord.row, activeCoord.col);
  const modifiedCount = countModifiedPixels(originalPixels, workingPixels);

  const deltaR = currPixel.r - origPixel.r;
  const deltaG = currPixel.g - origPixel.g;
  const deltaB = currPixel.b - origPixel.b;

  const updateMatrixCell = (
    channel: 'rMatrix' | 'gMatrix' | 'bMatrix',
    rIdx: number,
    cIdx: number,
    val: string,
  ) => {
    const nextGrid = answer[channel].map((row, r) =>
      r === rIdx ? row.map((cell, c) => (c === cIdx ? val : cell)) : row,
    );
    onChangeAnswer({
      ...answer,
      [channel]: nextGrid,
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
      aria-label="RGB 데이터 분석 결과 및 답안 기록 영역"
      className="flex flex-col gap-4 bg-white border border-slate-200 rounded-lg p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            3. 결과 분석 · 답안 기록
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            수정된 이미지 비교, 지정 픽셀 변화 계측, 학생 관찰 기록
          </p>
        </div>
        <span className="text-xs font-mono tabular-nums text-slate-500 whitespace-nowrap shrink-0">
          수정 픽셀 {modifiedCount}개
        </span>
      </div>

      {/* Result Canvas & Comparison */}
      <ResultViewport
        originalPixels={originalPixels}
        resultPixels={workingPixels}
        resultLabel="수정된 작업 이미지"
      />

      {/* Selected Pixel Change Summary */}
      <div className="flex flex-col gap-2 p-3 bg-slate-50 border border-slate-200 rounded-md">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-900">
            지정 픽셀 ({activeCoord.row}, {activeCoord.col}) 변화
          </span>
          <span className="font-mono tabular-nums text-slate-500">
            선택 영역 중심 ({regionCenter.row}, {regionCenter.col})
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 font-mono tabular-nums text-xs">
          {(
            [
              { label: 'R', before: origPixel.r, after: currPixel.r, delta: deltaR, color: 'text-rose-700' },
              { label: 'G', before: origPixel.g, after: currPixel.g, delta: deltaG, color: 'text-emerald-700' },
              { label: 'B', before: origPixel.b, after: currPixel.b, delta: deltaB, color: 'text-blue-700' },
            ] as const
          ).map((item) => (
            <div
              key={item.label}
              className="bg-white border border-slate-200 rounded p-2 flex flex-col gap-0.5"
            >
              <span className={`font-semibold ${item.color}`}>{item.label} 채널</span>
              <span className="text-slate-800">
                {item.before} → {item.after}
              </span>
              <span className="text-[11px] text-slate-500">
                Δ {item.delta >= 0 ? `+${item.delta}` : item.delta}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Student Worksheet (No Auto-Fill, Strictly Manual Input) */}
      <form
        onSubmit={handleSave}
        className="flex flex-col gap-3 pt-2 border-t border-slate-200"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
            <ClipboardCheck className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
            <span>실험 ① 수행평가 답안 입력 (직접 작성)</span>
          </h3>
          <span className="text-[11px] text-slate-500">자동 채움 없음</span>
        </div>

        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-slate-700">관찰한 3×3 영역 기준 좌표</span>
          <input
            type="text"
            value={answer.regionCenterText}
            onChange={(e) =>
              onChangeAnswer({ ...answer, regionCenterText: e.target.value })
            }
            placeholder="중심 (행, 열)"
            className="px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-600"
          />
        </label>

        {/* Manual 3x3 Matrix Inputs for R, G, B */}
        <div className="flex flex-col gap-2.5">
          {(
            [
              { key: 'rMatrix' as const, label: '직접 작성한 R 행렬 (3×3)', color: 'text-rose-700' },
              { key: 'gMatrix' as const, label: '직접 작성한 G 행렬 (3×3)', color: 'text-emerald-700' },
              { key: 'bMatrix' as const, label: '직접 작성한 B 행렬 (3×3)', color: 'text-blue-700' },
            ]
          ).map((mat) => (
            <div key={mat.key} className="flex flex-col gap-1">
              <span className={`text-xs font-medium ${mat.color}`}>{mat.label}</span>
              <div className="grid grid-cols-3 gap-1 bg-slate-50 p-1.5 rounded border border-slate-200">
                {answer[mat.key].map((row, rIdx) =>
                  row.map((val, cIdx) => (
                    <input
                      key={`${mat.key}-${rIdx}-${cIdx}`}
                      type="number"
                      min={0}
                      max={255}
                      value={val}
                      onChange={(e) =>
                        updateMatrixCell(mat.key, rIdx, cIdx, e.target.value)
                      }
                      aria-label={`${mat.label} ${rIdx + 1}행 ${cIdx + 1}열`}
                      placeholder="0~255"
                      className="w-full px-1.5 py-1 text-xs font-mono tabular-nums text-center bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-600"
                    />
                  )),
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="px-2.5 py-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-950 leading-relaxed">
          <strong>픽셀 수정 과제</strong> · 지정 픽셀{' '}
          <span className="font-mono tabular-nums font-semibold">
            ({EXP1_ANCHOR.row}, {EXP1_ANCHOR.col})
          </span>
          의 <strong>B 성분만 {EXP1_EDIT_DELTA_B}만큼 크게</strong> 수정하고, 수정 전과 후의 RGB 값을
          기록하세요.
        </div>

        {/* Target Pixel Before & After Student Input */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-700">
              지정 픽셀 수정 전 RGB 값
            </span>
            <div className="grid grid-cols-3 gap-1">
              {(['r', 'g', 'b'] as const).map((ch) => (
                <input
                  key={`before-${ch}`}
                  type="number"
                  min={0}
                  max={255}
                  value={answer.targetBeforeRgb[ch]}
                  onChange={(e) =>
                    onChangeAnswer({
                      ...answer,
                      targetBeforeRgb: {
                        ...answer.targetBeforeRgb,
                        [ch]: e.target.value,
                      },
                    })
                  }
                  placeholder={ch.toUpperCase()}
                  aria-label={`수정 전 픽셀 ${ch.toUpperCase()} 값`}
                  className="px-1.5 py-1 text-xs font-mono tabular-nums text-center bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-600"
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-700">
              지정 픽셀 수정 후 RGB 값
            </span>
            <div className="grid grid-cols-3 gap-1">
              {(['r', 'g', 'b'] as const).map((ch) => (
                <input
                  key={`after-${ch}`}
                  type="number"
                  min={0}
                  max={255}
                  value={answer.targetAfterRgb[ch]}
                  onChange={(e) =>
                    onChangeAnswer({
                      ...answer,
                      targetAfterRgb: {
                        ...answer.targetAfterRgb,
                        [ch]: e.target.value,
                      },
                    })
                  }
                  placeholder={ch.toUpperCase()}
                  aria-label={`수정 후 픽셀 ${ch.toUpperCase()} 값`}
                  className="px-1.5 py-1 text-xs font-mono tabular-nums text-center bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-600"
                />
              ))}
            </div>
          </div>
        </div>

        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-slate-700">
            지정 3×3 영역(수정 전 원본)에서 R 성분이 B 성분보다 큰 픽셀의 개수
          </span>
          <input
            type="text"
            value={answer.conditionCountText ?? ''}
            onChange={(e) =>
              onChangeAnswer({ ...answer, conditionCountText: e.target.value })
            }
            placeholder="개수 (정수)"
            aria-label="R 성분이 B 성분보다 큰 픽셀의 개수"
            className="px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-600"
          />
        </label>

        <ResultConfirmToggle
          experimentNumber={1}
          status={resultCheckStatus}
          onToggle={onToggleResultCheck}
        />

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-[11px] text-slate-500">
            저장된 실험 기록 {savedCount}건
          </span>
          <button
            type="submit"
            data-testid="exp1-save-record-btn"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-md transition-colors cursor-pointer whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5" aria-hidden="true" />
            <span>실험 ① 기록 저장</span>
          </button>
        </div>

        {justSaved && (
          <div
            role="status"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded"
          >
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>현재 작업 이미지와 답안이 활동 기록에 저장되었습니다.</span>
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
