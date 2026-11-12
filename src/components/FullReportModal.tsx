import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpenCheck,
  CheckCircle2,
  CircleDashed,
  Download,
  FileText,
  Printer,
  X,
} from 'lucide-react';
import {
  CORRIDOR_ORIGINAL_PIXELS,
} from '../data/corridorImage';
import {
  COMPOSITE_BG_Y_PIXELS,
  CORRIDOR_GRAYSCALE_ORIGINAL,
} from '../data/experimentAssets';
import { EXP3_TARGET_PIXELS } from '../data/experimentAssets';
import { buildReportSnapshot } from '../engine/reportBuilder';
import { renderReportToPdfBlob } from '../utils/pdfExport';
import { buildReportPdfFilename } from '../utils/storage';
import { ASSESSMENT_META, StudentWorkspaceData } from '../types/lab';

interface FullReportModalProps {
  isOpen: boolean;
  workspace: StudentWorkspaceData;
  onClose: () => void;
}

const MatrixTable: React.FC<{
  title: string;
  matrix: Array<Array<string | number>>;
  emptyChar?: string;
}> = ({ title, matrix, emptyChar = '·' }) => (
  <div className="bg-slate-50 border border-slate-200 rounded p-2">
    <div className="text-[11px] font-semibold text-slate-800 mb-1">{title}</div>
    <table className="w-full border-collapse font-mono tabular-nums text-[11px] text-center">
      <tbody>
        {matrix.map((row, rIdx) => (
          <tr key={rIdx}>
            {row.map((cell, cIdx) => {
              const display =
                typeof cell === 'number'
                  ? String(cell)
                  : cell.trim() || emptyChar;
              return (
                <td
                  key={cIdx}
                  className="border border-slate-300 bg-white px-1 py-0.5 text-slate-900"
                >
                  {display}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const ReportStatusBadge: React.FC<{ checked: boolean; recordCount: number }> = ({
  checked,
  recordCount,
}) => (
  <span
    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-semibold whitespace-nowrap ${
      checked
        ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
        : 'bg-slate-100 border-slate-300 text-slate-600'
    }`}
  >
    {checked ? (
      <CheckCircle2 className="w-3 h-3 text-emerald-700" aria-hidden="true" />
    ) : (
      <CircleDashed className="w-3 h-3 text-slate-400" aria-hidden="true" />
    )}
    <span>
      {checked ? '결과 확인 완료' : '결과 미확인'} · 저장 {recordCount}건
    </span>
  </span>
);

const AnswerFieldBox: React.FC<{
  label: string;
  value: string;
  mono?: boolean;
}> = ({ label, value, mono = false }) => {
  const hasVal = value.trim().length > 0;
  return (
    <div className="bg-white border border-slate-200 rounded p-2 text-xs">
      <div className="text-[11px] font-semibold text-blue-950 mb-0.5">{label}</div>
      <div
        className={`whitespace-pre-wrap break-words ${
          mono ? 'font-mono tabular-nums text-[11px]' : ''
        } ${hasVal ? 'text-slate-900' : 'text-slate-400 italic'}`}
      >
        {hasVal ? value : '(학생 미입력)'}
      </div>
    </div>
  );
};

const SheetStudentMetaStrip: React.FC<{
  studentId: string;
  studentName: string;
  pageNumber: number;
}> = ({ studentId, studentName, pageNumber }) => (
  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 border-b border-slate-100 pb-1.5">
    <span>
      {ASSESSMENT_META.school} · {ASSESSMENT_META.subject} 수행평가
    </span>
    <span className="font-mono">
      {studentId.trim() || '학번미입력'} {studentName.trim() || '이름미입력'} · {pageNumber} / 6쪽
    </span>
  </div>
);

const SheetTeacherFooter: React.FC<{
  label: string;
  points: number;
}> = ({ label, points }) => (
  <div className="mt-auto pt-2.5 border-t border-slate-200 flex items-center justify-between gap-2 text-xs bg-slate-50 px-3 py-2 rounded border">
    <span className="text-slate-600">
      {label} 교사 최종 확인 (앱 자동 채점·감점 없음)
    </span>
    <span className="font-mono font-semibold text-slate-900 whitespace-nowrap">
      교사 확인 점수: ( &nbsp;&nbsp;&nbsp; ) / {points}점
    </span>
  </div>
);

export const FullReportModal: React.FC<FullReportModalProps> = ({
  isOpen,
  workspace,
  onClose,
}) => {
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [pdfNotice, setPdfNotice] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Guard reference unused unused constants cleanly by passing workspace directly
  void CORRIDOR_ORIGINAL_PIXELS;
  void COMPOSITE_BG_Y_PIXELS;
  void CORRIDOR_GRAYSCALE_ORIGINAL;

  const report = useMemo(() => {
    if (!isOpen) return null;
    return buildReportSnapshot(workspace);
  }, [isOpen, workspace]);

  if (!isOpen || !report) return null;

  const pdfFilename = buildReportPdfFilename(report.student);
  const missingIdentity =
    !report.student.studentId.trim() || !report.student.name.trim();

  const handlePrintPdf = () => {
    const previousTitle = document.title;
    document.title = pdfFilename.replace(/\.pdf$/i, '');
    const restoreTitle = () => {
      document.title = previousTitle;
      window.removeEventListener('afterprint', restoreTitle);
    };
    window.addEventListener('afterprint', restoreTitle);
    window.setTimeout(restoreTitle, 3000);
    window.print();
  };

  const handleDownloadDirectPdf = async () => {
    setIsExportingPdf(true);
    setPdfNotice(null);
    try {
      const blob = await renderReportToPdfBlob(report);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = pdfFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
      setPdfNotice({
        type: 'success',
        message: `${pdfFilename} 파일이 저장되었습니다. Google Classroom 과제에 첨부하여 제출하세요.`,
      });
    } catch {
      setPdfNotice({
        type: 'error',
        message: '직접 PDF 생성 중 문제가 발생했습니다. 브라우저 인쇄 / PDF 저장을 이용해 주세요.',
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="full-report-modal-title"
      data-testid="full-report-modal"
      className="print-report-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-2 sm:p-4"
    >
      <div className="print-report-shell bg-slate-100 border border-slate-300 rounded-lg w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Top Modal Action Bar (hidden during @media print) */}
        <div className="no-print bg-white border-b border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-blue-900 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <h2
                id="full-report-modal-title"
                className="text-sm sm:text-base font-bold text-slate-900 truncate"
              >
                전체 실험 보고서 미리보기 (A4 세로형)
              </h2>
              <p className="text-[11px] font-mono text-slate-500 truncate">
                저장 파일명: {pdfFilename}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isExportingPdf}
              onClick={handleDownloadDirectPdf}
              data-testid="download-direct-pdf-btn"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-950 hover:bg-blue-900 disabled:opacity-60 rounded-md transition-colors cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{isExportingPdf ? 'PDF 생성 중...' : 'PDF 파일 바로 저장'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrintPdf}
              data-testid="print-report-btn"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-950 bg-blue-50 hover:bg-blue-100 border border-blue-300 rounded-md transition-colors cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" aria-hidden="true" />
              <span>인쇄 · 브라우저 PDF 저장</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="전체 실험 보고서 닫기"
              data-testid="close-report-btn"
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Notices inside Preview Chrome */}
        <div className="no-print bg-white border-b border-slate-200 px-4 py-2 flex flex-col gap-1.5">
          {missingIdentity && (
            <div className="flex items-center gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>
                첫 화면에서 학번과 이름을 입력하면 보고서 표지와 PDF 파일명({ASSESSMENT_META.reportFileSuffix}.pdf)에 자동 반영됩니다.
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs text-blue-950 bg-blue-50/70 border border-blue-200 rounded px-2.5 py-1.5">
            <BookOpenCheck className="w-3.5 h-3.5 text-blue-800 shrink-0" aria-hidden="true" />
            <span>{ASSESSMENT_META.classroomNotice}</span>
          </div>
          {pdfNotice && (
            <div
              role="status"
              data-testid="pdf-export-status"
              className={`text-xs px-2.5 py-1.5 rounded border ${
                pdfNotice.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {pdfNotice.message}
            </div>
          )}
        </div>

        {/* A4 Printable Preview Pages */}
        <div
          id="printable-report-root"
          className="print-report-scroll flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col items-center gap-6"
        >
          {/* ========== PAGE 1: COVER ========== */}
          <article
            data-testid="report-page-cover"
            className="report-sheet w-full max-w-[794px] bg-white border border-slate-300 shadow-sm rounded-sm p-6 sm:p-8 flex flex-col gap-5"
          >
            <div className="bg-slate-900 text-white p-6 rounded">
              <p className="text-xs font-semibold text-blue-300 tracking-wide">
                {ASSESSMENT_META.school} · 2026학년도 2학년 「{ASSESSMENT_META.subject}」 수행평가
              </p>
              <h1 className="text-xl sm:text-2xl font-bold mt-2 tracking-tight">
                {ASSESSMENT_META.title}
              </h1>
              <p className="text-xs text-slate-300 mt-1.5">
                이미지 데이터 처리 실험실 전체 활동 및 수학적 계산 결과 보고서
              </p>
            </div>

            {/* Student Info Card */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 border border-slate-200 rounded">
              <div>
                <div className="text-[11px] text-slate-500">학번</div>
                <div className="text-base font-bold font-mono text-slate-900 mt-0.5">
                  {report.student.studentId.trim() || '(미입력)'}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500">이름</div>
                <div className="text-base font-bold text-slate-900 mt-0.5">
                  {report.student.name.trim() || '(미입력)'}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500">실험 실시일</div>
                <div className="text-base font-bold font-mono text-slate-900 mt-0.5">
                  {report.assessmentDate}
                </div>
              </div>
            </div>

            {/* Rubric & Completion Status Table (No Auto Scoring!) */}
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  수행평가 요소 및 배점 기준 (총점 {ASSESSMENT_META.totalPoints}점)
                </h3>
                <span className="text-[11px] text-slate-500">
                  자동 채점·감점 없음 · 교사 최종 확인용
                </span>
              </div>

              <div className="overflow-x-auto border border-slate-300 rounded">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-blue-950 text-white text-left">
                      <th className="py-2 px-3 font-semibold">실험 및 평가요소</th>
                      <th className="py-2 px-3 font-semibold text-center whitespace-nowrap">배점</th>
                      <th className="py-2 px-3 font-semibold text-center whitespace-nowrap">실험 결과 확인 여부</th>
                      <th className="py-2 px-3 font-semibold text-center whitespace-nowrap">교사 확인란</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {[
                      { meta: report.exp1.meta, ver: report.exp1.verification, rec: report.exp1.savedRecordCount },
                      { meta: report.exp2.meta, ver: report.exp2.verification, rec: report.exp2.savedRecordCount },
                      { meta: report.exp3.meta, ver: report.exp3.verification, rec: report.exp3.savedRecordCount },
                      { meta: report.exp4.meta, ver: report.exp4.verification, rec: report.exp4.savedRecordCount },
                      { meta: report.exp5.meta, ver: report.exp5.verification, rec: report.exp5.savedRecordCount },
                    ].map((row) => (
                      <tr key={row.meta.id} className="bg-white">
                        <td className="py-2 px-3">
                          <div className="font-semibold text-slate-900">{row.meta.title}</div>
                          <div className="text-[11px] text-slate-500">{row.meta.elementName}</div>
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-semibold text-slate-800 whitespace-nowrap">
                          {row.meta.points}점
                        </td>
                        <td className="py-2 px-3 text-center">
                          <ReportStatusBadge
                            checked={row.ver.resultChecked}
                            recordCount={row.rec}
                          />
                        </td>
                        <td className="py-2 px-3 text-center font-mono text-slate-600 whitespace-nowrap">
                          ( &nbsp;&nbsp;&nbsp; ) / {row.meta.points}점
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-blue-50 font-semibold text-blue-950">
                      <td className="py-2 px-3">
                        합계 (결과 확인 {report.checkedExperimentCount}/5개 · 저장 기록 {report.totalRecordCount}건)
                      </td>
                      <td className="py-2 px-3 text-center font-mono">
                        {ASSESSMENT_META.totalPoints}점
                      </td>
                      <td className="py-2 px-3 text-center text-[11px]">
                        교사 직접 채점
                      </td>
                      <td className="py-2 px-3 text-center font-mono whitespace-nowrap">
                        총 ( &nbsp;&nbsp;&nbsp; ) / {ASSESSMENT_META.totalPoints}점
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 leading-relaxed flex flex-col gap-1">
              <div className="font-semibold text-slate-900">평가 운영 및 제출 안내</div>
              <div>
                • 본 보고서는 학생이 실험 중 조작한 행렬 매개변수, 변환 이미지, 수학적 계산 기록을 그대로 기록한 자료이며 점수를 자동 확정하거나 감점하지 않습니다.
              </div>
              <div className="font-semibold text-blue-950">
                • {ASSESSMENT_META.classroomNotice}
              </div>
            </div>
          </article>

          {/* ========== PAGE 2: EXPERIMENT 1 ========== */}
          <article
            data-testid="report-page-exp1"
            className="report-sheet w-full max-w-[794px] bg-white border border-slate-300 shadow-sm rounded-sm p-6 sm:p-8 flex flex-col gap-3.5"
          >
            <SheetStudentMetaStrip
              studentId={report.student.studentId}
              studentName={report.student.name}
              pageNumber={2}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b-2 border-blue-950">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {report.exp1.meta.title} ({report.exp1.meta.points}점)
                </h3>
                <p className="text-[11px] text-slate-500">
                  평가요소: {report.exp1.meta.elementName}
                </p>
              </div>
              <ReportStatusBadge
                checked={report.exp1.verification.resultChecked}
                recordCount={report.exp1.savedRecordCount}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[auto_minmax(0,1fr)] gap-4 items-start">
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-1">
                  <img
                    src={report.exp1.origImageUrl}
                    alt="실험 1 원본 이미지"
                    className="w-28 h-28 border border-slate-300 rounded pixelated-canvas bg-white"
                  />
                  <span className="text-[11px] text-slate-600">원본 이미지</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <img
                    src={report.exp1.workingImageUrl}
                    alt="실험 1 작업 수정 이미지"
                    className="w-28 h-28 border border-slate-300 rounded pixelated-canvas bg-white"
                  />
                  <span className="text-[11px] text-slate-600">수정 후 이미지</span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs font-mono flex flex-col gap-1">
                <div>
                  선택 픽셀: <strong>({report.exp1.activeCoord.row}, {report.exp1.activeCoord.col})</strong> · 영역 크기:{' '}
                  <strong>{report.exp1.selectionSize}×{report.exp1.selectionSize}</strong> (중심 {report.exp1.regionCenter.row}, {report.exp1.regionCenter.col})
                </div>
                <div>
                  픽셀 변화: ({report.exp1.origPixel.r}, {report.exp1.origPixel.g}, {report.exp1.origPixel.b}) →{' '}
                  <strong>
                    ({report.exp1.currPixel.r}, {report.exp1.currPixel.g}, {report.exp1.currPixel.b})
                  </strong>{' '}
                  (총 {report.exp1.modifiedCount}개 수정)
                </div>
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  <MatrixTable title="계측 R 행렬" matrix={report.exp1.workingMatrices.r} />
                  <MatrixTable title="계측 G 행렬" matrix={report.exp1.workingMatrices.g} />
                  <MatrixTable title="계측 B 행렬" matrix={report.exp1.workingMatrices.b} />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-slate-200">
              <div className="text-xs font-bold text-slate-900">학생 작성 계산 및 기록</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <AnswerFieldBox
                  label="관찰한 3×3 영역 기준 좌표"
                  value={report.exp1.answer.regionCenterText}
                  mono
                />
                <AnswerFieldBox
                  label="지정 픽셀 수정 전/후 RGB (B 성분 +40 과제)"
                  value={`(${report.exp1.answer.targetBeforeRgb.r || '-'}, ${report.exp1.answer.targetBeforeRgb.g || '-'}, ${report.exp1.answer.targetBeforeRgb.b || '-'}) → (${report.exp1.answer.targetAfterRgb.r || '-'}, ${report.exp1.answer.targetAfterRgb.g || '-'}, ${report.exp1.answer.targetAfterRgb.b || '-'})`}
                  mono
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <MatrixTable title="학생 작성 R 행렬" matrix={report.exp1.answer.rMatrix} />
                <MatrixTable title="학생 작성 G 행렬" matrix={report.exp1.answer.gMatrix} />
                <MatrixTable title="학생 작성 B 행렬" matrix={report.exp1.answer.bMatrix} />
              </div>
              <AnswerFieldBox
                label="지정 3×3 영역에서 R 성분이 B 성분보다 큰 픽셀의 개수"
                value={report.exp1.answer.conditionCountText ?? ''}
                mono
              />
            </div>
            <SheetTeacherFooter label="실험 1" points={report.exp1.meta.points} />
          </article>

          {/* ========== PAGE 3: EXPERIMENT 2 ========== */}
          <article
            data-testid="report-page-exp2"
            className="report-sheet w-full max-w-[794px] bg-white border border-slate-300 shadow-sm rounded-sm p-6 sm:p-8 flex flex-col gap-3.5"
          >
            <SheetStudentMetaStrip
              studentId={report.student.studentId}
              studentName={report.student.name}
              pageNumber={3}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b-2 border-blue-950">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {report.exp2.meta.title} ({report.exp2.meta.points}점)
                </h3>
                <p className="text-[11px] text-slate-500">
                  평가요소: {report.exp2.meta.elementName}
                </p>
              </div>
              <ReportStatusBadge
                checked={report.exp2.verification.resultChecked}
                recordCount={report.exp2.savedRecordCount}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[auto_minmax(0,1fr)] gap-4 items-start">
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-1">
                  <img
                    src={report.exp2.origImageUrl}
                    alt="실험 2 원본 이미지"
                    className="w-28 h-28 border border-slate-300 rounded pixelated-canvas bg-white"
                  />
                  <span className="text-[11px] text-slate-600">원본 이미지 A</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <img
                    src={report.exp2.transformedImageUrl}
                    alt="실험 2 변환 이미지"
                    className="w-28 h-28 border border-slate-300 rounded pixelated-canvas bg-white"
                  />
                  <span className="text-[11px] text-slate-600">변환 이미지 A′</span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs font-mono flex flex-col gap-1.5">
                <div>
                  적용 연산식: <strong className="text-blue-950">{report.exp2.formula}</strong>{' '}
                  (s = {report.exp2.effectiveS}, t = {report.exp2.effectiveT >= 0 ? `+${report.exp2.effectiveT}` : report.exp2.effectiveT})
                </div>
                <div className="text-[11px] text-slate-600">
                  255 초과 포화: {report.exp2.stats.clippedHighChannels.toLocaleString()} · 0 미만:{' '}
                  {report.exp2.stats.clippedLowChannels.toLocaleString()} · 반올림:{' '}
                  {report.exp2.stats.roundedChannels.toLocaleString()}
                </div>
                <div className="grid grid-cols-1 gap-1 text-[11px] bg-white border border-slate-200 rounded p-2">
                  <div>
                    픽셀 A ({report.exp2.pixelA.coord.row},{report.exp2.pixelA.coord.col}): ({report.exp2.pixelA.original.r},{report.exp2.pixelA.original.g},{report.exp2.pixelA.original.b}) →{' '}
                    <strong>
                      ({report.exp2.pixelA.current.r},{report.exp2.pixelA.current.g},{report.exp2.pixelA.current.b})
                    </strong>
                  </div>
                  <div>
                    픽셀 B ({report.exp2.pixelB.coord.row},{report.exp2.pixelB.coord.col}): ({report.exp2.pixelB.original.r},{report.exp2.pixelB.original.g},{report.exp2.pixelB.original.b}) →{' '}
                    <strong>
                      ({report.exp2.pixelB.current.r},{report.exp2.pixelB.current.g},{report.exp2.pixelB.current.b})
                    </strong>
                  </div>
                  <div>
                    픽셀 C ({report.exp2.pixelCCoord.row},{report.exp2.pixelCCoord.col}): ({report.exp2.pixelCBefore.r},{report.exp2.pixelCBefore.g},{report.exp2.pixelCBefore.b}) →{' '}
                    <strong>
                      ({report.exp2.pixelCAfter.r},{report.exp2.pixelCAfter.g},{report.exp2.pixelCAfter.b})
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-slate-200">
              <div className="text-xs font-bold text-slate-900">학생 작성 계산 과정 및 답안</div>
              <AnswerFieldBox
                label="사용한 행렬 연산식 및 설정값 s, t"
                value={`${report.exp2.answer.selectedFormula}  |  s = ${report.exp2.answer.recordedS || '(미입력)'}  |  t = ${report.exp2.answer.recordedT || '(미입력)'}`}
                mono
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <AnswerFieldBox
                  label="목표 픽셀 A 계산 과정"
                  value={report.exp2.answer.pixelACalculation}
                  mono
                />
                <AnswerFieldBox
                  label="목표 픽셀 B 계산 과정"
                  value={report.exp2.answer.pixelBCalculation}
                  mono
                />
              </div>
              <AnswerFieldBox
                label="지정한 다른 픽셀의 변환 전후 RGB 값"
                value={report.exp2.answer.otherPixelBeforeAfter}
                mono
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <AnswerFieldBox
                  label="255 초과 성분 처리 결과"
                  value={report.exp2.answer.overflowHandlingNote}
                />
                <AnswerFieldBox
                  label="추가 탐구 메모"
                  value={report.exp2.answer.inquiryReflectionNote}
                />
              </div>
            </div>
            <SheetTeacherFooter label="실험 2" points={report.exp2.meta.points} />
          </article>

          {/* ========== PAGE 4: EXPERIMENT 3 ========== */}
          <article
            data-testid="report-page-exp3"
            className="report-sheet w-full max-w-[794px] bg-white border border-slate-300 shadow-sm rounded-sm p-6 sm:p-8 flex flex-col gap-3.5"
          >
            <SheetStudentMetaStrip
              studentId={report.student.studentId}
              studentName={report.student.name}
              pageNumber={4}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b-2 border-blue-950">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {report.exp3.meta.title} ({report.exp3.meta.points}점)
                </h3>
                <p className="text-[11px] text-slate-500">
                  평가요소: {report.exp3.meta.elementName}
                </p>
              </div>
              <ReportStatusBadge
                checked={report.exp3.verification.resultChecked}
                recordCount={report.exp3.savedRecordCount}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: '원본 이미지 X', src: report.exp3.xImageUrl },
                { label: '배경 이미지 Y', src: report.exp3.yImageUrl },
                { label: '이진 마스크 P', src: report.exp3.maskImageUrl },
                { label: '합성 결과 Z', src: report.exp3.zImageUrl },
              ].map((img) => (
                <div key={img.label} className="flex flex-col items-center gap-1 p-2 bg-slate-50 border border-slate-200 rounded">
                  <img
                    src={img.src}
                    alt={img.label}
                    className="w-24 h-24 border border-slate-300 rounded pixelated-canvas bg-white"
                  />
                  <span className="text-[11px] font-medium text-slate-700">{img.label}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_220px] gap-3 items-start">
              <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs font-mono flex flex-col gap-1">
                <div>
                  목표 영역 일치 여부: <strong className="text-blue-950">{report.exp3.targetMet ? '목표 일치' : '미일치'}</strong>
                </div>
                <div>
                  선택 유지 영역 (P = 1): {report.exp3.maskBounds.rowStart}~{report.exp3.maskBounds.rowEnd}행,{' '}
                  {report.exp3.maskBounds.colStart}~{report.exp3.maskBounds.colEnd}열
                </div>
                <div>
                  유지 픽셀: {report.exp3.keptFromXPixels.toLocaleString()}px · 교체 픽셀:{' '}
                  {report.exp3.replacedWithYPixels.toLocaleString()}px
                </div>
                <div>
                  확대 4×4 시작 좌표: ({report.exp3.inspectOrigin.row}, {report.exp3.inspectOrigin.col})
                </div>
              </div>
              <MatrixTable
                title="실제 4×4 마스크 행렬 P"
                matrix={report.exp3.pMatrix4x4}
              />
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-slate-200">
              <div className="text-xs font-bold text-slate-900">학생 작성 아다마르 곱 기록</div>
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded text-xs text-blue-950 flex flex-col gap-1">
                <div className="font-semibold text-blue-900">
                  학생이 완성한 합성식: <span className="font-mono font-bold">{report.exp3.answer.formulaText || '(미선택)'}</span>
                </div>
                <div className="text-[11px] text-slate-600">
                  (P: 마스크 행렬, J: 모든 성분이 1인 행렬, ⊙: 성분별 곱)
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <MatrixTable
                  title="학생 작성 4×4 마스크 행렬 P"
                  matrix={report.exp3.answer.maskMatrix4x4}
                />
                <AnswerFieldBox
                  label="지정 픽셀 ①·② 의 P, X, Y → Z 기록"
                  value={`① (${EXP3_TARGET_PIXELS[0].row}, ${EXP3_TARGET_PIXELS[0].col})  P=${report.exp3.answer.samplePixelMaskP || '-'}\n   X=${report.exp3.answer.samplePixelXRgb || '-'} | Y=${report.exp3.answer.samplePixelYRgb || '-'}\n   Z=${report.exp3.answer.samplePixelZRgb || '-'}\n② (${EXP3_TARGET_PIXELS[1].row}, ${EXP3_TARGET_PIXELS[1].col})  P=${report.exp3.answer.sample2MaskP || '-'}\n   X=${report.exp3.answer.sample2XRgb || '-'} | Y=${report.exp3.answer.sample2YRgb || '-'}\n   Z=${report.exp3.answer.sample2ZRgb || '-'}`}
                  mono
                />
              </div>
            </div>
            <SheetTeacherFooter label="실험 3" points={report.exp3.meta.points} />
          </article>

          {/* ========== PAGE 5: EXPERIMENT 4 ========== */}
          <article
            data-testid="report-page-exp4"
            className="report-sheet w-full max-w-[794px] bg-white border border-slate-300 shadow-sm rounded-sm p-6 sm:p-8 flex flex-col gap-3.5"
          >
            <SheetStudentMetaStrip
              studentId={report.student.studentId}
              studentName={report.student.name}
              pageNumber={5}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b-2 border-blue-950">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {report.exp4.meta.title} ({report.exp4.meta.points}점)
                </h3>
                <p className="text-[11px] text-slate-500">
                  평가요소: {report.exp4.meta.elementName}
                </p>
              </div>
              <ReportStatusBadge
                checked={report.exp4.verification.resultChecked}
                recordCount={report.exp4.savedRecordCount}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: '원본 흑백 이미지', src: report.exp4.grayOrigImageUrl },
                { label: `평균 필터 K₁ (k=${report.exp4.meanK}) 결과`, src: report.exp4.meanImageUrl },
                { label: `경계 필터 K₂ (m=${report.exp4.edgeM}) 결과`, src: report.exp4.edgeImageUrl },
              ].map((img) => (
                <div key={img.label} className="flex flex-col items-center gap-1 p-2 bg-slate-50 border border-slate-200 rounded">
                  <img
                    src={img.src}
                    alt={img.label}
                    className="w-24 h-24 border border-slate-300 rounded pixelated-canvas bg-white"
                  />
                  <span className="text-[11px] font-medium text-slate-700 text-center">{img.label}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <MatrixTable
                title={`지정 5×5 영역 (중심 ${report.exp4.patchCenter.row},${report.exp4.patchCenter.col} · x=${report.exp4.xValue})`}
                matrix={report.exp4.patch5x5Values}
              />
              <MatrixTable
                title={`평균 필터 K₁(k=${report.exp4.meanK}) 실제 3×3 출력`}
                matrix={report.exp4.meanOutput3x3}
              />
              <MatrixTable
                title={`경계 필터 K₂(m=${report.exp4.edgeM}) 실제 3×3 출력`}
                matrix={report.exp4.edgeOutput3x3}
              />
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-slate-200">
              <div className="text-xs font-bold text-slate-900">학생 작성 합성곱 계산 과정 및 답안</div>
              <AnswerFieldBox
                label="구한 중앙 픽셀 x 및 필터 계수 k, m"
                value={`x = ${report.exp4.answer.recordedX || '(미입력)'}   |   k = ${report.exp4.answer.recordedK || '(미입력)'}   |   m = ${report.exp4.answer.recordedM || '(미입력)'}   (화면 표시 모드: ${report.exp4.displayMode === 'abs' ? '절댓값 |값|' : '0~255 제한'})`}
                mono
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <MatrixTable
                  title="학생 작성 평균 필터 출력 (3×3)"
                  matrix={report.exp4.answer.meanOutput3x3}
                />
                <AnswerFieldBox
                  label="학생 작성 평균 필터 계산 과정"
                  value={report.exp4.answer.meanCalcStep}
                  mono
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <MatrixTable
                  title="학생 작성 경계 필터 K₂ (3×3)"
                  matrix={report.exp4.answer.edgeKernel3x3}
                />
                <MatrixTable
                  title="학생 작성 경계 필터 출력 (3×3)"
                  matrix={report.exp4.answer.edgeOutput3x3}
                />
              </div>
              <AnswerFieldBox
                label="학생 작성 경계 필터 계산 과정"
                value={report.exp4.answer.edgeCalcStep}
                mono
              />
            </div>
            <SheetTeacherFooter label="실험 4" points={report.exp4.meta.points} />
          </article>

          {/* ========== PAGE 6: EXPERIMENT 5 ========== */}
          <article
            data-testid="report-page-exp5"
            className="report-sheet w-full max-w-[794px] bg-white border border-slate-300 shadow-sm rounded-sm p-6 sm:p-8 flex flex-col gap-3.5"
          >
            <SheetStudentMetaStrip
              studentId={report.student.studentId}
              studentName={report.student.name}
              pageNumber={6}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b-2 border-blue-950">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {report.exp5.meta.title} ({report.exp5.meta.points}점)
                </h3>
                <p className="text-[11px] text-slate-500">
                  평가요소: {report.exp5.meta.elementName}
                </p>
              </div>
              <ReportStatusBadge
                checked={report.exp5.verification.resultChecked}
                recordCount={report.exp5.savedRecordCount}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {[
                { label: '기준 A (숫자 0)', src: report.exp5.refAImageUrl },
                { label: '기준 B (숫자 1)', src: report.exp5.refBImageUrl },
                { label: '기준 C (숫자 7)', src: report.exp5.refCImageUrl },
                { label: '초기 입력 X₀', src: report.exp5.xInitialImageUrl },
                { label: '수정 후 입력 X', src: report.exp5.xCurrentImageUrl },
              ].map((img) => (
                <div key={img.label} className="flex flex-col items-center gap-1 p-2 bg-slate-50 border border-slate-200 rounded">
                  <img
                    src={img.src}
                    alt={img.label}
                    className="w-20 h-20 border border-slate-300 rounded pixelated-canvas bg-white"
                  />
                  <span className="text-[11px] font-medium text-slate-700 text-center">{img.label}</span>
                </div>
              ))}
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs font-mono flex flex-col gap-1.5">
              <div>
                수정 전 초기 X₀ 해밍 거리: d(X₀, A)={report.exp5.initialDistances.A}, d(X₀, B)=
                {report.exp5.initialDistances.B}, d(X₀, C)={report.exp5.initialDistances.C} → 초기 분류:{' '}
                <strong>{report.exp5.initialClassification.predictedDigitLabel}</strong>
              </div>
              <div>
                수정 후 현재 X 해밍 거리: d(X, A)={report.exp5.currentDistances.A}, d(X, B)=
                {report.exp5.currentDistances.B}, d(X, C)={report.exp5.currentDistances.C} → 현재 분류:{' '}
                <strong className="text-blue-950">{report.exp5.currentClassification.predictedDigitLabel}</strong>
              </div>
              <div>
                수정한 픽셀 좌표 ({report.exp5.editLog.length}회): {report.exp5.editedCoordsSummary}
              </div>
              <div className="font-sans text-[11px] text-slate-600 pt-1 border-t border-slate-200">
                ※ 이 분류 결과는 인공지능의 의미 이해가 아니라 두 이진 행렬에서 서로 다른 픽셀 수(해밍 거리)가 최소인 기준을 선택한 수학적 계산 결과입니다.
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-slate-200">
              <div className="text-xs font-bold text-slate-900">학생 작성 해밍 거리 분석 및 설명</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <AnswerFieldBox
                  label="초기 해밍 거리 및 분류 결과 기록"
                  value={`d(X,A)=${report.exp5.answer.initialDistA || '-'}, d(X,B)=${report.exp5.answer.initialDistB || '-'}, d(X,C)=${report.exp5.answer.initialDistC || '-'}  |  예측: ${report.exp5.answer.predictedDigit || '-'}`}
                  mono
                />
                <AnswerFieldBox
                  label="수정한 픽셀 좌표 · 횟수 · 수정 후 d(X, B)"
                  value={`좌표: ${report.exp5.answer.editedCoordsText || '-'}  (${report.exp5.answer.editCountText || '-'}회)  |  수정 후 d(X,B)=${report.exp5.answer.finalDistB || '-'}`}
                  mono
                />
              </div>
              <AnswerFieldBox
                label="수정한 픽셀과 해밍 거리의 관계 설명"
                value={report.exp5.answer.relationExplanation}
              />
            </div>
            <SheetTeacherFooter label="실험 5" points={report.exp5.meta.points} />
          </article>
        </div>
      </div>
    </div>
  );
};
