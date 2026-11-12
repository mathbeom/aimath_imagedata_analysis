import React from 'react';
import { Trash2, X } from 'lucide-react';
import {
  ActivityRecord,
  AnyExperimentAnswer,
  Experiment1Answer,
  Experiment2Answer,
  Experiment3Answer,
  Experiment4Answer,
  Experiment5Answer,
  StudentProfile,
} from '../types/lab';

interface ActivityLogModalProps {
  isOpen: boolean;
  student: StudentProfile;
  records: ActivityRecord[];
  onClose: () => void;
  onDeleteRecord: (id: string) => void;
  onClearAll: () => void;
}

function isExp1(ans: AnyExperimentAnswer): ans is Experiment1Answer {
  return 'rMatrix' in ans;
}

function isExp2(ans: AnyExperimentAnswer): ans is Experiment2Answer {
  return 'selectedFormula' in ans;
}

function isExp3(ans: AnyExperimentAnswer): ans is Experiment3Answer {
  return 'maskMatrix4x4' in ans;
}

function isExp4(ans: AnyExperimentAnswer): ans is Experiment4Answer {
  return 'meanOutput3x3' in ans;
}

function isExp5(ans: AnyExperimentAnswer): ans is Experiment5Answer {
  return 'initialDistA' in ans;
}

const MiniMatrixPreview: React.FC<{ label: string; grid: string[][] }> = ({
  label,
  grid,
}) => (
  <div className="p-1.5 bg-slate-50 border border-slate-200 rounded font-mono text-[11px]">
    <div className="font-sans font-semibold text-slate-700 mb-1">{label}</div>
    {grid.map((row, idx) => (
      <div key={idx} className="truncate">
        [{row.map((c) => c || '·').join(', ')}]
      </div>
    ))}
  </div>
);

export const ActivityLogModal: React.FC<ActivityLogModalProps> = ({
  isOpen,
  student,
  records,
  onClose,
  onDeleteRecord,
  onClearAll,
}) => {
  if (!isOpen) return null;

  const studentLabel =
    student.studentId.trim() || student.name.trim()
      ? `${student.studentId.trim() || '학번미입력'} ${student.name.trim() || '이름미입력'}`
      : '임시 작업(학번·이름 미입력)';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="activity-log-title"
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
    >
      <div className="bg-white border border-slate-200 rounded-lg w-full max-w-3xl max-h-[85vh] flex flex-col shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-200">
          <div>
            <h2
              id="activity-log-title"
              className="text-base font-semibold text-slate-900"
            >
              학생 실험 활동 기록 ({records.length}건) — {studentLabel}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              설정한 연산 매개변수, 변환된 결과 이미지, 직접 작성한 답안이 학생별로 분리 보관됩니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {records.length > 0 && (
              <button
                type="button"
                onClick={onClearAll}
                data-testid="clear-all-records-btn"
                className="px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-md transition-colors cursor-pointer whitespace-nowrap"
              >
                전체 기록 삭제
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="활동 기록 창 닫기"
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-5 flex flex-col gap-4">
          {records.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              아직 저장된 실험 기록이 없습니다. 각 실험의 오른쪽 패널에서 답안을 작성한 뒤 기록 저장 버튼을 눌러 보세요.
            </div>
          ) : (
            records.map((rec) => (
              <article
                key={rec.id}
                className="border border-slate-200 rounded-lg p-4 bg-slate-50 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-semibold text-blue-900">
                        {rec.experimentTitle}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">
                        {new Date(rec.timestampIso).toLocaleString('ko-KR')}
                      </span>
                      {rec.resultChecked && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-emerald-700 font-semibold">결과 확인됨</span>
                        </>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 mt-1">
                      {rec.summary}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteRecord(rec.id)}
                    aria-label={`${rec.summary} 기록 삭제`}
                    className="p-1.5 text-slate-400 hover:text-rose-700 hover:bg-white rounded border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[128px_minmax(0,1fr)] gap-4 items-start">
                  {rec.resultImageDataUrl && (
                    <div className="flex flex-col gap-1">
                      <img
                        src={rec.resultImageDataUrl}
                        alt={`${rec.experimentTitle} 결과 스냅샷`}
                        className="w-32 h-32 rounded border border-slate-300 pixelated-canvas bg-white"
                      />
                      <span className="text-[11px] text-slate-500 text-center">
                        저장 시점 결과 이미지
                      </span>
                    </div>
                  )}

                  <div className="flex flex-col gap-2 text-xs bg-white border border-slate-200 rounded p-3">
                    <div className="flex flex-wrap gap-x-4 gap-y-1 pb-2 border-b border-slate-100 font-mono text-[11px] text-slate-600">
                      {Object.entries(rec.parameters).map(([k, v]) => (
                        <span key={k}>
                          {k}: <strong className="text-slate-900">{String(v)}</strong>
                        </span>
                      ))}
                    </div>

                    {isExp1(rec.studentAnswers) && (
                      <div className="flex flex-col gap-1.5 text-slate-700">
                        <div>
                          <span className="font-medium text-slate-900">영역 기준: </span>
                          <span className="font-mono">
                            {rec.studentAnswers.regionCenterText || '(미입력)'}
                          </span>
                        </div>
                        <div className="font-mono text-[11px]">
                          <span className="font-sans font-medium text-slate-900">
                            픽셀 변경 전/후 기록:{' '}
                          </span>
                          ({rec.studentAnswers.targetBeforeRgb.r || '-'},{' '}
                          {rec.studentAnswers.targetBeforeRgb.g || '-'},{' '}
                          {rec.studentAnswers.targetBeforeRgb.b || '-'}) → (
                          {rec.studentAnswers.targetAfterRgb.r || '-'},{' '}
                          {rec.studentAnswers.targetAfterRgb.g || '-'},{' '}
                          {rec.studentAnswers.targetAfterRgb.b || '-'})
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                          <MiniMatrixPreview label="R 행렬 입력값" grid={rec.studentAnswers.rMatrix} />
                          <MiniMatrixPreview label="G 행렬 입력값" grid={rec.studentAnswers.gMatrix} />
                          <MiniMatrixPreview label="B 행렬 입력값" grid={rec.studentAnswers.bMatrix} />
                        </div>
                        {rec.studentAnswers.conditionCountText && (
                          <p className="text-slate-600 pt-1">
                            R &gt; B 픽셀 개수: {rec.studentAnswers.conditionCountText}
                          </p>
                        )}
                      </div>
                    )}

                    {isExp2(rec.studentAnswers) && (
                      <div className="flex flex-col gap-1 text-slate-700">
                        <div className="font-mono text-[11px]">
                          변환식: {rec.studentAnswers.selectedFormula} · s=
                          {rec.studentAnswers.recordedS || '(미입력)'} · t=
                          {rec.studentAnswers.recordedT || '(미입력)'}
                        </div>
                        <div>
                          <span className="font-medium text-slate-900">픽셀 A 과정: </span>
                          <span className="font-mono text-[11px]">
                            {rec.studentAnswers.pixelACalculation || '(미입력)'}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium text-slate-900">픽셀 B 과정: </span>
                          <span className="font-mono text-[11px]">
                            {rec.studentAnswers.pixelBCalculation || '(미입력)'}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium text-slate-900">다른 픽셀: </span>
                          <span className="font-mono text-[11px]">
                            {rec.studentAnswers.otherPixelBeforeAfter || '(미입력)'}
                          </span>
                        </div>
                        {rec.studentAnswers.overflowHandlingNote && (
                          <div>
                            <span className="font-medium text-slate-900">255 초과 처리: </span>
                            <span>{rec.studentAnswers.overflowHandlingNote}</span>
                          </div>
                        )}
                        {rec.studentAnswers.inquiryReflectionNote && (
                          <div>
                            <span className="font-medium text-slate-900">추가 탐구: </span>
                            <span>{rec.studentAnswers.inquiryReflectionNote}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {isExp3(rec.studentAnswers) && (
                      <div className="flex flex-col gap-1.5 text-slate-700">
                        <div>
                          <span className="font-medium text-slate-900">합성식: </span>
                          <span className="font-mono">
                            {rec.studentAnswers.formulaText || '(미입력)'}
                          </span>
                        </div>
                        <MiniMatrixPreview
                          label="4×4 마스크 행렬 P"
                          grid={rec.studentAnswers.maskMatrix4x4}
                        />
                        <div className="font-mono text-[11px]">
                          <span className="font-sans font-medium text-slate-900">
                            지정 픽셀 계산:{' '}
                          </span>
                          ① X=
                          {rec.studentAnswers.samplePixelXRgb || '-'} · Y=
                          {rec.studentAnswers.samplePixelYRgb || '-'} · P=
                          {rec.studentAnswers.samplePixelMaskP || '-'} → Z=
                          {rec.studentAnswers.samplePixelZRgb || '-'} / ② P=
                          {rec.studentAnswers.sample2MaskP || '-'} → Z=
                          {rec.studentAnswers.sample2ZRgb || '-'}
                        </div>
                      </div>
                    )}

                    {isExp4(rec.studentAnswers) && (
                      <div className="flex flex-col gap-1.5 text-slate-700">
                        <div className="font-mono text-[11px]">
                          입력값 x={rec.studentAnswers.recordedX || '(미입력)'} · 계수 k=
                          {rec.studentAnswers.recordedK || '(미입력)'} · 계수 m=
                          {rec.studentAnswers.recordedM || '(미입력)'}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <MiniMatrixPreview
                            label="평균 필터 출력 (3×3)"
                            grid={rec.studentAnswers.meanOutput3x3}
                          />
                          <MiniMatrixPreview
                            label="경계 필터 K₂ (3×3)"
                            grid={rec.studentAnswers.edgeKernel3x3}
                          />
                          <MiniMatrixPreview
                            label="경계 필터 출력 (3×3)"
                            grid={rec.studentAnswers.edgeOutput3x3}
                          />
                        </div>
                        {rec.studentAnswers.meanCalcStep && (
                          <div>
                            <span className="font-medium text-slate-900">평균 계산 과정: </span>
                            <span className="font-mono text-[11px]">
                              {rec.studentAnswers.meanCalcStep}
                            </span>
                          </div>
                        )}
                        {rec.studentAnswers.edgeCalcStep && (
                          <div>
                            <span className="font-medium text-slate-900">경계 계산 과정: </span>
                            <span className="font-mono text-[11px]">
                              {rec.studentAnswers.edgeCalcStep}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {isExp5(rec.studentAnswers) && (
                      <div className="flex flex-col gap-1 text-slate-700">
                        <div className="font-mono text-[11px]">
                          초기 해밍 거리: d(X,A)={rec.studentAnswers.initialDistA || '-'}, d(X,B)=
                          {rec.studentAnswers.initialDistB || '-'}, d(X,C)=
                          {rec.studentAnswers.initialDistC || '-'} · 예측:{' '}
                          {rec.studentAnswers.predictedDigit || '(미입력)'}
                        </div>
                        <div className="font-mono text-[11px]">
                          수정한 픽셀: {rec.studentAnswers.editedCoordsText || '(미입력)'} (
                          {rec.studentAnswers.editCountText || '-'}회) · 수정 후 d(X,B)=
                          {rec.studentAnswers.finalDistB || '-'}
                        </div>
                        {rec.studentAnswers.relationExplanation && (
                          <div>
                            <span className="font-medium text-slate-900">픽셀-거리 관계: </span>
                            <span>{rec.studentAnswers.relationExplanation}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
