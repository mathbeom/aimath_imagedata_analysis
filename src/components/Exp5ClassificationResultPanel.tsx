import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, ClipboardCheck, Save } from 'lucide-react';
import {
  ClassificationResult,
  formatCoordList,
} from '../engine/hammingMath';
import {
  ActivityRecord,
  BinaryEditEntry,
  Experiment5Answer,
  ExperimentCheckStatus,
} from '../types/lab';
import { ResultConfirmToggle } from './ResultConfirmToggle';

interface Exp5ClassificationResultPanelProps {
  classification: ClassificationResult;
  editLog: BinaryEditEntry[];
  answer: Experiment5Answer;
  onChangeAnswer: (next: Experiment5Answer) => void;
  onSaveRecord: () => void;
  savedCount: number;
  recentRecords: ActivityRecord[];
  resultCheckStatus: ExperimentCheckStatus;
  onToggleResultCheck: (next: boolean) => void;
}

export const Exp5ClassificationResultPanel: React.FC<Exp5ClassificationResultPanelProps> = ({
  classification,
  editLog,
  answer,
  onChangeAnswer,
  onSaveRecord,
  savedCount,
  recentRecords,
  resultCheckStatus,
  onToggleResultCheck,
}) => {
  const [justSaved, setJustSaved] = useState<boolean>(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveRecord();
    setJustSaved(true);
    window.setTimeout(() => setJustSaved(false), 2400);
  };

  return (
    <section
      aria-label="해밍 거리 기반 분류 결과, 수정 기록 및 답안 작성 영역"
      className="flex flex-col gap-4 bg-white border border-slate-200 rounded-lg p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            3. 최소 거리 분류 · 답안 기록
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            해밍 거리 최솟값 기준 분류 및 픽셀 수정 이력 확인
          </p>
        </div>
        <span
          data-testid="exp5-predicted-badge"
          className="text-xs font-mono font-semibold text-blue-900 whitespace-nowrap shrink-0"
        >
          분류: {classification.predictedDigitLabel}
        </span>
      </div>

      {/* Classification Readout with Explicit Non-AI Mathematical Disclaimer */}
      <div className="flex flex-col gap-2 p-3 bg-slate-50 border border-slate-200 rounded-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-900">
            현재 입력 X의 해밍 거리 분류 결과
          </span>
          <span className="text-xs font-mono tabular-nums font-semibold text-blue-900">
            최소 거리 = {classification.minDistance}
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded p-2.5 flex flex-col gap-1">
          <div className="text-sm font-semibold text-slate-900">
            가장 가까운 기준 이미지: {classification.predictedDigitLabel}
          </div>
          <div className="text-xs font-mono tabular-nums text-slate-600">
            d(X, A)={classification.distances.A} · d(X, B)={classification.distances.B} · d(X, C)=
            {classification.distances.C}
          </div>
        </div>

        <div className="flex items-start gap-1.5 text-[11px] text-slate-600 leading-relaxed pt-0.5">
          <AlertCircle className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            주의: 이 분류기는 글자의 의미를 이해하는 인공지능이 아니라, 64개 픽셀 중 서로 다른 칸의 개수(해밍 거리)가 가장 작은 기준 행렬을 고르는 단순 수학적 거리 비교 모델입니다.
          </span>
        </div>
      </div>

      {/* Live Pixel Edit Counter & Coordinates Log */}
      <div className="flex flex-col gap-2 p-3 bg-slate-50 border border-slate-200 rounded-md text-xs">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-900">
            입력 X 픽셀 수정 기록
          </span>
          <span
            data-testid="exp5-edit-count"
            className="font-mono tabular-nums font-semibold text-blue-900"
          >
            총 {editLog.length}회 수정
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded p-2 font-mono text-[11px] text-slate-700">
          <span className="font-sans text-slate-500 block mb-0.5">수정한 좌표 목록</span>
          <span data-testid="exp5-edit-coords">{formatCoordList(editLog)}</span>
        </div>

        {editLog.length > 0 && (
          <div className="flex flex-col gap-1 max-h-28 overflow-y-auto font-mono tabular-nums text-[11px]">
            {editLog.map((entry) => (
              <div
                key={entry.step}
                className="flex items-center justify-between px-2 py-1 bg-white border border-slate-200 rounded"
              >
                <span>
                  #{entry.step} ({entry.coord.row}, {entry.coord.col}): {entry.fromValue} → {entry.toValue}
                </span>
                <span className="text-slate-500">
                  d(X,B)={entry.distancesAfter.B}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Student Worksheet (Strictly Manual, No Auto-Fill) */}
      <form
        onSubmit={handleSave}
        className="flex flex-col gap-2.5 pt-2 border-t border-slate-200"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
            <ClipboardCheck className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
            <span>실험 ⑤ 수행평가 답안 입력 (직접 작성)</span>
          </h3>
          <span className="text-[11px] text-slate-500">자동 채움 없음</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <label className="flex flex-col gap-1">
            <span className="font-medium text-slate-700">초기 X가 분류된 숫자</span>
            <input
              type="text"
              value={answer.predictedDigit}
              onChange={(e) =>
                onChangeAnswer({ ...answer, predictedDigit: e.target.value })
              }
              placeholder="A(0), B(1), C(7) 중 입력"
              className="px-2 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-600"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium text-slate-700">B와 같게 만든 수정 횟수</span>
            <input
              type="text"
              value={answer.editCountText}
              onChange={(e) =>
                onChangeAnswer({ ...answer, editCountText: e.target.value })
              }
              placeholder="정수 입력"
              className="px-2 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-600"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <label className="flex flex-col gap-1">
            <span className="font-medium text-slate-700">수정한 픽셀 좌표</span>
            <input
              type="text"
              value={answer.editedCoordsText}
              onChange={(e) =>
                onChangeAnswer({ ...answer, editedCoordsText: e.target.value })
              }
              placeholder="예: (행, 열), (행, 열)"
              className="px-2 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-600"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium text-slate-700">수정 후 d(X, B) 값</span>
            <input
              type="text"
              value={answer.finalDistB}
              onChange={(e) =>
                onChangeAnswer({ ...answer, finalDistB: e.target.value })
              }
              placeholder="정수 입력"
              className="px-2 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-600"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-slate-700">
            수정한 픽셀과 해밍 거리의 관계 설명
          </span>
          <textarea
            rows={2}
            value={answer.relationExplanation}
            onChange={(e) =>
              onChangeAnswer({ ...answer, relationExplanation: e.target.value })
            }
            placeholder="기준 B와 다른 픽셀을 반전시킬 때 해밍 거리가 어떻게 변하는지 수학적으로 서술하세요."
            className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-600 resize-y"
          />
        </label>

        <ResultConfirmToggle
          experimentNumber={5}
          status={resultCheckStatus}
          onToggle={onToggleResultCheck}
        />

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-[11px] text-slate-500">
            저장된 실험 기록 {savedCount}건
          </span>
          <button
            type="submit"
            data-testid="exp5-save-record-btn"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-md transition-colors cursor-pointer whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5" aria-hidden="true" />
            <span>실험 ⑤ 기록 저장</span>
          </button>
        </div>

        {justSaved && (
          <div
            role="status"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded"
          >
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>입력 이미지 X, 수정 이력, 작성한 답안이 활동 기록에 저장되었습니다.</span>
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
