import React, { useRef, useState } from 'react';
import {
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDashed,
  Download,
  FileText,
  Upload,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import {
  ASSESSMENT_META,
  ExperimentTabId,
  ExperimentVerificationMap,
  SavedStudentSummary,
  StudentProfile,
} from '../types/lab';

interface AssessmentHeaderBarProps {
  draftStudent: StudentProfile;
  committedStudent: StudentProfile;
  assessmentDate: string;
  verificationStatus: ExperimentVerificationMap;
  savedStudents: SavedStudentSummary[];
  activeStudentKey: string;
  backupNotice: { type: 'success' | 'error'; message: string } | null;
  onChangeDraftStudent: (next: StudentProfile) => void;
  onCommitStudentProfile: () => void;
  onStartNewStudent: () => void;
  onSwitchSavedStudent: (studentKey: string) => void;
  onSelectTab: (tab: ExperimentTabId) => void;
  onOpenReport: () => void;
  onExportBackup: () => void;
  onImportBackupFile: (file: File) => void;
}

export const AssessmentHeaderBar: React.FC<AssessmentHeaderBarProps> = ({
  draftStudent,
  committedStudent,
  assessmentDate,
  verificationStatus,
  savedStudents,
  activeStudentKey,
  backupNotice,
  onChangeDraftStudent,
  onCommitStudentProfile,
  onStartNewStudent,
  onSwitchSavedStudent,
  onSelectTab,
  onOpenReport,
  onExportBackup,
  onImportBackupFile,
}) => {
  const [showRubric, setShowRubric] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const checkedCount = Object.values(verificationStatus).filter(
    (s) => s.resultChecked,
  ).length;
  const hasCommittedIdentity =
    committedStudent.studentId.trim().length > 0 &&
    committedStudent.name.trim().length > 0;
  const isDirtyStudent =
    draftStudent.studentId.trim() !== committedStudent.studentId.trim() ||
    draftStudent.name.trim() !== committedStudent.name.trim();

  const handleGroupBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      if (draftStudent.studentId.trim() && draftStudent.name.trim()) {
        onCommitStudentProfile();
      }
    }
  };

  return (
    <section
      aria-label="수행평가 정보 및 학생 정보 입력"
      className="no-print bg-white border border-slate-200 rounded-lg p-3 sm:p-4 flex flex-col gap-3"
    >
      {/* Top Row: Student Inputs + Primary Report / JSON Backup Buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        {/* Student Identity Controls (First Screen Required Inputs: 학번, 이름) */}
        <div
          onBlur={handleGroupBlur}
          className="flex flex-wrap items-center gap-2 sm:gap-2.5"
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-950 whitespace-nowrap">
            <UserCheck className="w-4 h-4 text-blue-800" aria-hidden="true" />
            <span>응시 학생</span>
          </div>

          <label className="inline-flex items-center gap-1.5 text-xs">
            <span className="font-medium text-slate-700 whitespace-nowrap">학번</span>
            <input
              type="text"
              value={draftStudent.studentId}
              onChange={(e) =>
                onChangeDraftStudent({
                  ...draftStudent,
                  studentId: e.target.value,
                })
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onCommitStudentProfile();
                }
              }}
              data-testid="student-id-input"
              aria-label="학생 학번 입력"
              placeholder="예: 20101"
              className="w-24 sm:w-28 px-2.5 py-1.5 text-xs font-mono tabular-nums bg-slate-50 focus:bg-white border border-slate-300 rounded-md focus:outline-none focus:border-blue-700"
            />
          </label>

          <label className="inline-flex items-center gap-1.5 text-xs">
            <span className="font-medium text-slate-700 whitespace-nowrap">이름</span>
            <input
              type="text"
              value={draftStudent.name}
              onChange={(e) =>
                onChangeDraftStudent({
                  ...draftStudent,
                  name: e.target.value,
                })
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onCommitStudentProfile();
                }
              }}
              data-testid="student-name-input"
              aria-label="학생 이름 입력"
              placeholder="이름 입력"
              className="w-24 sm:w-28 px-2.5 py-1.5 text-xs bg-slate-50 focus:bg-white border border-slate-300 rounded-md focus:outline-none focus:border-blue-700"
            />
          </label>

          {(isDirtyStudent || !hasCommittedIdentity) &&
            draftStudent.studentId.trim() &&
            draftStudent.name.trim() && (
              <button
                type="button"
                onClick={onCommitStudentProfile}
                data-testid="student-apply-btn"
                className="px-2.5 py-1.5 text-xs font-semibold text-white bg-blue-800 hover:bg-blue-900 rounded-md transition-colors cursor-pointer whitespace-nowrap"
              >
                학생 적용
              </button>
            )}

          {hasCommittedIdentity && (
            <button
              type="button"
              onClick={onStartNewStudent}
              data-testid="student-new-btn"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md transition-colors cursor-pointer whitespace-nowrap"
              title="현재 학생 기록은 안전하게 분리 저장한 뒤 다른 학생으로 전환합니다."
            >
              <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>새 학생 전환</span>
            </button>
          )}

          {savedStudents.length > 0 && (
            <select
              aria-label="저장된 다른 학생 기록 불러오기"
              data-testid="saved-student-select"
              value={
                savedStudents.some((s) => s.studentKey === activeStudentKey)
                  ? activeStudentKey
                  : ''
              }
              onChange={(e) => {
                if (e.target.value) {
                  onSwitchSavedStudent(e.target.value);
                }
              }}
              className="px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-md text-slate-700 focus:outline-none focus:border-blue-700 max-w-[180px]"
            >
              <option value="">저장된 학생 ({savedStudents.length}명)</option>
              {savedStudents.map((s) => (
                <option key={s.studentKey} value={s.studentKey}>
                  {s.student.studentId} {s.student.name} ({s.checkedCount}/5 확인)
                </option>
              ))}
            </select>
          )}

          <span className="text-[11px] font-mono tabular-nums text-slate-500 whitespace-nowrap">
            실시일 {assessmentDate}
          </span>
        </div>

        {/* Right Actions: Report Preview + JSON Backup */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onExportBackup}
            data-testid="json-export-btn"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
            <span>JSON 백업</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            data-testid="json-import-btn"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md transition-colors cursor-pointer whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
            <span>백업 불러오기</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            data-testid="json-import-input"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                onImportBackupFile(f);
              }
              e.target.value = '';
            }}
          />

          <button
            type="button"
            onClick={onOpenReport}
            data-testid="open-full-report-btn"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-950 hover:bg-blue-900 rounded-md transition-colors cursor-pointer whitespace-nowrap"
          >
            <FileText className="w-3.5 h-3.5" aria-hidden="true" />
            <span>전체 실험 보고서 보기</span>
          </button>
        </div>
      </div>

      {/* Assessment Overview, Progress Chips (No Auto-Grading!), and Classroom Notice */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-700">
            <span className="font-semibold text-slate-900">
              {ASSESSMENT_META.title}
            </span>
            <span className="text-slate-300" aria-hidden="true">|</span>
            <span className="font-mono text-[11px] text-slate-600">
              {ASSESSMENT_META.school} · {ASSESSMENT_META.subject} · 총 {ASSESSMENT_META.totalPoints}점 (교사 확인)
            </span>
            <button
              type="button"
              onClick={() => setShowRubric((p) => !p)}
              data-testid="toggle-rubric-btn"
              className="inline-flex items-center gap-0.5 text-[11px] font-medium text-blue-800 hover:underline cursor-pointer whitespace-nowrap"
            >
              <span>평가요소·배점표</span>
              {showRubric ? (
                <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
              )}
            </button>
          </div>

          {/* Neutral Experiment Result Confirmation Checklist (NO Scores/Deductions) */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="text-slate-500 mr-0.5">
              결과 확인 ({checkedCount}/5):
            </span>
            {ASSESSMENT_META.elements.map((el) => {
              const checked = verificationStatus[el.id]?.resultChecked;
              return (
                <button
                  key={el.id}
                  type="button"
                  onClick={() => onSelectTab(el.id)}
                  title={`${el.title} (${el.points}점) — ${checked ? '결과 확인 완료' : '미확인'}`}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border font-mono cursor-pointer transition-colors ${
                    checked
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold'
                      : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {checked ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-700" aria-hidden="true" />
                  ) : (
                    <CircleDashed className="w-3 h-3 text-slate-400" aria-hidden="true" />
                  )}
                  <span>실험{el.order}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Expandable Rubric Details Table */}
        {showRubric && (
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="font-semibold text-slate-900">
                수행평가 요소 및 배점 기준 (총점 {ASSESSMENT_META.totalPoints}점)
              </span>
              <span className="text-[11px] text-slate-600">
                앱은 학생의 점수를 자동 확정하거나 감점하지 않으며, 모든 과정은 교사가 확인합니다.
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-1.5">
              {ASSESSMENT_META.elements.map((el) => (
                <div
                  key={el.id}
                  className="bg-white border border-slate-200 rounded p-2 flex flex-col justify-between gap-1"
                >
                  <div className="font-semibold text-blue-950 text-[11px]">
                    {el.order}. {el.elementName}
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-600">
                    <span>배점 {el.points}점</span>
                    <span
                      className={
                        verificationStatus[el.id]?.resultChecked
                          ? 'text-emerald-700 font-semibold'
                          : 'text-slate-400'
                      }
                    >
                      {verificationStatus[el.id]?.resultChecked ? '확인됨' : '미확인'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Static Google Classroom Guidance Notice (NEVER shows '클래스룸 제출 완료') */}
        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-blue-50/70 border border-blue-200 rounded text-[11px] sm:text-xs text-blue-950">
          <BookOpenCheck className="w-3.5 h-3.5 text-blue-800 shrink-0" aria-hidden="true" />
          <span>{ASSESSMENT_META.classroomNotice}</span>
        </div>

        {backupNotice && (
          <div
            role="status"
            data-testid="backup-status-banner"
            className={`px-2.5 py-1.5 rounded border text-xs ${
              backupNotice.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {backupNotice.message}
          </div>
        )}
      </div>
    </section>
  );
};
