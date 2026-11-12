import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import {
  ActivityRecord,
  AnchorPreset,
  BinaryEditEntry,
  ChannelViewMode,
  ConvolutionFilterType,
  EdgeDisplayMode,
  Experiment1Answer,
  Experiment2Answer,
  Experiment3Answer,
  Experiment4Answer,
  Experiment5Answer,
  ExperimentTabId,
  ExperimentVerificationMap,
  PixelCoord,
  RectMaskBounds,
  RgbPixel,
  SavedStudentSummary,
  SelectionSize,
  StudentProfile,
  StudentWorkspaceData,
  TransformMode,
} from './types/lab';
import {
  CORRIDOR_HEIGHT,
  CORRIDOR_ORIGINAL_PIXELS,
  CORRIDOR_WIDTH,
  EXP1_ANCHOR,
  EXP1_ANCHOR_PRESETS,
  EXP2_ANCHOR_A,
  EXP2_ANCHOR_PRESETS,
  createCorridorPixelsCopy,
} from './data/corridorImage';
import {
  COMPOSITE_BG_Y_PIXELS,
  CORRIDOR_GRAYSCALE_ORIGINAL,
  EXP3_DEFAULT_4X4_ORIGIN,
  EXP3_INITIAL_RECT,
  EXP4_EVAL_CENTER,
  EXP4_INITIAL_X,
  EXP4_INITIAL_MEAN_K,
  createInitialBinaryX,
} from './data/experimentAssets';
import {
  applyAffineTransform,
  clampCenterCoord,
  formatFormulaText,
  getEffectiveParams,
  readPixel,
  setPixelImmutable,
} from './engine/imageMath';
import {
  applyHadamardComposite,
  buildRectMask,
  extract4x4CompositeData,
} from './engine/compositeMath';
import {
  applyConvolutionToFullGrayscaleImage,
  convolutionRawToRgbaPixels,
  extract5x5GrayscalePatch,
  setGrayscaleCenterXImmutable,
} from './engine/convolutionMath';
import {
  classifyByHammingDistance,
  computeAllDistances,
  formatCoordList,
  toggleBinaryCellImmutable,
} from './engine/hammingMath';
import {
  DRAFT_STUDENT_KEY,
  applyPixelOverrides,
  buildBackupJsonFilename,
  buildBackupPayload,
  createDefaultWorkspace,
  extractPixelOverrides,
  hasExistingStudentWorkspace,
  loadActiveStudentKey,
  loadLegacyV1WorkspaceIfAny,
  loadSavedStudentIndex,
  loadStudentWorkspaceByKey,
  normalizeStudentKey,
  parseAndValidateBackupJson,
  renderBinaryGridToPngDataUrl,
  renderPixelsToPngDataUrl,
  saveActiveStudentKey,
  saveStudentWorkspace,
  switchStudentWorkspace,
} from './utils/storage';
import { AssessmentHeaderBar } from './components/AssessmentHeaderBar';
import { ConfirmDialog, ConfirmDialogState } from './components/ConfirmDialog';
import { FullReportModal } from './components/FullReportModal';
import { PixelCanvasStage } from './components/PixelCanvasStage';
import { RgbAnalysisCenterPanel } from './components/RgbAnalysisCenterPanel';
import { RgbAnalysisResultPanel } from './components/RgbAnalysisResultPanel';
import { BrightnessTransformCenterPanel } from './components/BrightnessTransformCenterPanel';
import { BrightnessTransformResultPanel } from './components/BrightnessTransformResultPanel';
import { Exp3CompositeLeftPanel } from './components/Exp3CompositeLeftPanel';
import { Exp3CompositeCenterPanel } from './components/Exp3CompositeCenterPanel';
import { Exp3CompositeResultPanel } from './components/Exp3CompositeResultPanel';
import { Exp4ConvolutionLeftPanel } from './components/Exp4ConvolutionLeftPanel';
import { Exp4ConvolutionCenterPanel } from './components/Exp4ConvolutionCenterPanel';
import { Exp4ConvolutionResultPanel } from './components/Exp4ConvolutionResultPanel';
import { Exp5ClassificationLeftPanel } from './components/Exp5ClassificationLeftPanel';
import { Exp5ClassificationCenterPanel } from './components/Exp5ClassificationCenterPanel';
import { Exp5ClassificationResultPanel } from './components/Exp5ClassificationResultPanel';
import { ActivityLogModal } from './components/ActivityLogModal';

interface ExperimentTabMeta {
  id: ExperimentTabId;
  label: string;
  subtitle: string;
  datasetTag: string;
}

const EXPERIMENT_TABS: ExperimentTabMeta[] = [
  {
    id: 'rgb-analysis',
    label: '1. RGB 데이터 분석',
    subtitle: '목표: 컬러 이미지가 R·G·B 세 채널의 숫자 행렬로 표현되는 이유를 이해한다.',
    datasetTag: '공통 평가 이미지: 학교 복도 안내 표지판 (64×64 RGB)',
  },
  {
    id: 'color-brightness',
    label: '2. 색상·밝기 변환',
    subtitle: '목표: 행렬의 덧셈(A+tJ)과 실수배(sA) 연산으로 밝기와 색상이 변하는 원리를 이해한다.',
    datasetTag: '공통 평가 이미지: 학교 복도 안내 표지판 (64×64 RGB)',
  },
  {
    id: 'image-composite',
    label: '3. 이미지 합성',
    subtitle: '목표: 아다마르 곱과 이진 마스크 행렬 P로 원하는 영역만 선택해 두 이미지를 합성한다.',
    datasetTag: '고정 데이터: 복도 표지판 X · 노을 배경 Y (64×64 RGB)',
  },
  {
    id: 'convolution-filter',
    label: '4. 합성곱 필터',
    subtitle: '목표: 주변 픽셀값과 필터 행렬을 이용해 흐림과 경계 강조가 발생함을 이해한다.',
    datasetTag: '고정 데이터: 학교 복도 흑백 행렬 (64×64)',
  },
  {
    id: 'image-classification',
    label: '5. 이미지 분류',
    subtitle: '목표: 이진 이미지의 해밍 거리로 차이를 수치화하고 가장 가까운 숫자 행렬로 분류한다.',
    datasetTag: '고정 데이터: 8×8 이진 숫자 행렬 A·B·C 및 입력 X',
  },
];

function loadInitialBootstrap(): { key: string; workspace: StudentWorkspaceData } {
  const initialKey = loadActiveStudentKey();
  if (hasExistingStudentWorkspace(initialKey)) {
    return {
      key: initialKey,
      workspace: loadStudentWorkspaceByKey(initialKey),
    };
  }
  if (initialKey === DRAFT_STUDENT_KEY) {
    const migrated = loadLegacyV1WorkspaceIfAny();
    if (migrated) {
      return { key: DRAFT_STUDENT_KEY, workspace: migrated };
    }
  }
  return {
    key: DRAFT_STUDENT_KEY,
    workspace: createDefaultWorkspace(),
  };
}

export default function App() {
  const initialBootstrap = useMemo(() => loadInitialBootstrap(), []);

  // Student isolation identity
  const [activeStudentKey, setActiveStudentKey] = useState<string>(
    initialBootstrap.key,
  );
  const [draftStudent, setDraftStudent] = useState<StudentProfile>(
    initialBootstrap.workspace.student,
  );
  const [committedStudent, setCommittedStudent] = useState<StudentProfile>(
    initialBootstrap.workspace.student,
  );
  const [assessmentDate, setAssessmentDate] = useState<string>(
    initialBootstrap.workspace.assessmentDate,
  );
  const [savedStudents, setSavedStudents] = useState<SavedStudentSummary[]>(() =>
    loadSavedStudentIndex(),
  );

  // Active tab
  const [activeTab, setActiveTab] = useState<ExperimentTabId>(
    initialBootstrap.workspace.experimentStates.activeTab,
  );

  // Shared immutable reference image (never mutated)
  const originalPixels = CORRIDOR_ORIGINAL_PIXELS;

  // Experiment 1 state
  const [exp1WorkingPixels, setExp1WorkingPixels] = useState<Uint8ClampedArray>(() =>
    applyPixelOverrides(
      CORRIDOR_ORIGINAL_PIXELS,
      initialBootstrap.workspace.experimentStates.exp1.pixelOverrides,
    ),
  );
  const [exp1ActiveCoord, setExp1ActiveCoord] = useState<PixelCoord>(
    initialBootstrap.workspace.experimentStates.exp1.activeCoord,
  );
  const [exp1SelectionSize, setExp1SelectionSize] = useState<SelectionSize>(
    initialBootstrap.workspace.experimentStates.exp1.selectionSize,
  );
  const [exp1ChannelView, setExp1ChannelView] = useState<ChannelViewMode>(
    initialBootstrap.workspace.experimentStates.exp1.channelView,
  );
  const [exp1Answer, setExp1Answer] = useState<Experiment1Answer>(
    initialBootstrap.workspace.answers.exp1,
  );

  // Experiment 2 state
  const [exp2ActiveCoord, setExp2ActiveCoord] = useState<PixelCoord>(
    initialBootstrap.workspace.experimentStates.exp2.activeCoord,
  );
  const [exp2SelectionSize, setExp2SelectionSize] = useState<SelectionSize>(
    initialBootstrap.workspace.experimentStates.exp2.selectionSize,
  );
  const [exp2ChannelView, setExp2ChannelView] = useState<ChannelViewMode>(
    initialBootstrap.workspace.experimentStates.exp2.channelView,
  );
  const [transformMode, setTransformMode] = useState<TransformMode>(
    initialBootstrap.workspace.experimentStates.exp2.transformMode,
  );
  const [sValue, setSValue] = useState<number>(
    initialBootstrap.workspace.experimentStates.exp2.sValue,
  );
  const [tValue, setTValue] = useState<number>(
    initialBootstrap.workspace.experimentStates.exp2.tValue,
  );
  const [exp2Answer, setExp2Answer] = useState<Experiment2Answer>(
    initialBootstrap.workspace.answers.exp2,
  );

  // Experiment 3 state
  const [exp3MaskBounds, setExp3MaskBounds] = useState<RectMaskBounds>(
    initialBootstrap.workspace.experimentStates.exp3.maskBounds,
  );
  const [exp3InspectOrigin, setExp3InspectOrigin] = useState<PixelCoord>(
    initialBootstrap.workspace.experimentStates.exp3.inspectOrigin,
  );
  const [exp3ActiveCoord, setExp3ActiveCoord] = useState<PixelCoord>(
    initialBootstrap.workspace.experimentStates.exp3.activeCoord,
  );
  const [exp3ChannelView, setExp3ChannelView] = useState<ChannelViewMode>(
    initialBootstrap.workspace.experimentStates.exp3.channelView,
  );
  const [exp3Answer, setExp3Answer] = useState<Experiment3Answer>(
    initialBootstrap.workspace.answers.exp3,
  );

  // Experiment 4 state
  const [exp4XValue, setExp4XValue] = useState<number>(
    initialBootstrap.workspace.experimentStates.exp4.xValue,
  );
  const [exp4PatchCenter, setExp4PatchCenter] = useState<PixelCoord>(
    initialBootstrap.workspace.experimentStates.exp4.patchCenter,
  );
  const [exp4FilterType, setExp4FilterType] = useState<ConvolutionFilterType>(
    initialBootstrap.workspace.experimentStates.exp4.filterType,
  );
  const [exp4MeanK, setExp4MeanK] = useState<number>(
    initialBootstrap.workspace.experimentStates.exp4.meanK,
  );
  const [exp4EdgeM, setExp4EdgeM] = useState<number>(
    initialBootstrap.workspace.experimentStates.exp4.edgeM,
  );
  const [exp4OutRow, setExp4OutRow] = useState<number>(
    initialBootstrap.workspace.experimentStates.exp4.outRow,
  );
  const [exp4OutCol, setExp4OutCol] = useState<number>(
    initialBootstrap.workspace.experimentStates.exp4.outCol,
  );
  const [exp4DisplayMode, setExp4DisplayMode] = useState<EdgeDisplayMode>(
    initialBootstrap.workspace.experimentStates.exp4.displayMode,
  );
  const [exp4Answer, setExp4Answer] = useState<Experiment4Answer>(
    initialBootstrap.workspace.answers.exp4,
  );

  // Experiment 5 state
  const [exp5XGrid, setExp5XGrid] = useState<number[][]>(
    initialBootstrap.workspace.experimentStates.exp5.xGrid,
  );
  const [exp5EditLog, setExp5EditLog] = useState<BinaryEditEntry[]>(
    initialBootstrap.workspace.experimentStates.exp5.editLog,
  );
  const [exp5HasVerifiedDistances, setExp5HasVerifiedDistances] = useState<boolean>(
    initialBootstrap.workspace.experimentStates.exp5.hasVerifiedDistances,
  );
  const [exp5Answer, setExp5Answer] = useState<Experiment5Answer>(
    initialBootstrap.workspace.answers.exp5,
  );

  // Verification status (resultChecked per experiment — no auto-scoring or deduction!)
  const [verificationStatus, setVerificationStatus] =
    useState<ExperimentVerificationMap>(
      initialBootstrap.workspace.verificationStatus,
    );

  // Activity Log & Modals
  const [activityLog, setActivityLog] = useState<ActivityRecord[]>(
    initialBootstrap.workspace.activityLog,
  );
  const [isLogOpen, setIsLogOpen] = useState<boolean>(false);
  const [isReportOpen, setIsReportOpen] = useState<boolean>(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(
    null,
  );
  const [backupNotice, setBackupNotice] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Sparse overrides memo for lightweight localStorage persistence
  const exp1PixelOverrides = useMemo(
    () => extractPixelOverrides(originalPixels, exp1WorkingPixels),
    [originalPixels, exp1WorkingPixels],
  );

  // Unified snapshot of current student workspace for auto-save, backup, and report
  const currentWorkspace: StudentWorkspaceData = useMemo(
    () => ({
      schemaVersion: 2,
      student: committedStudent,
      assessmentDate,
      updatedAtIso: new Date().toISOString(),
      experimentStates: {
        activeTab,
        exp1: {
          pixelOverrides: exp1PixelOverrides,
          activeCoord: exp1ActiveCoord,
          selectionSize: exp1SelectionSize,
          channelView: exp1ChannelView,
        },
        exp2: {
          activeCoord: exp2ActiveCoord,
          selectionSize: exp2SelectionSize,
          channelView: exp2ChannelView,
          transformMode,
          sValue,
          tValue,
        },
        exp3: {
          maskBounds: exp3MaskBounds,
          inspectOrigin: exp3InspectOrigin,
          activeCoord: exp3ActiveCoord,
          channelView: exp3ChannelView,
        },
        exp4: {
          xValue: exp4XValue,
          patchCenter: exp4PatchCenter,
          filterType: exp4FilterType,
          meanK: exp4MeanK,
          edgeM: exp4EdgeM,
          outRow: exp4OutRow,
          outCol: exp4OutCol,
          displayMode: exp4DisplayMode,
        },
        exp5: {
          xGrid: exp5XGrid,
          editLog: exp5EditLog,
          hasVerifiedDistances: exp5HasVerifiedDistances,
        },
      },
      answers: {
        exp1: exp1Answer,
        exp2: exp2Answer,
        exp3: exp3Answer,
        exp4: exp4Answer,
        exp5: exp5Answer,
      },
      verificationStatus,
      activityLog,
    }),
    [
      committedStudent,
      assessmentDate,
      activeTab,
      exp1PixelOverrides,
      exp1ActiveCoord,
      exp1SelectionSize,
      exp1ChannelView,
      exp2ActiveCoord,
      exp2SelectionSize,
      exp2ChannelView,
      transformMode,
      sValue,
      tValue,
      exp3MaskBounds,
      exp3InspectOrigin,
      exp3ActiveCoord,
      exp3ChannelView,
      exp4XValue,
      exp4PatchCenter,
      exp4FilterType,
      exp4MeanK,
      exp4EdgeM,
      exp4OutRow,
      exp4OutCol,
      exp4DisplayMode,
      exp5XGrid,
      exp5EditLog,
      exp5HasVerifiedDistances,
      exp1Answer,
      exp2Answer,
      exp3Answer,
      exp4Answer,
      exp5Answer,
      verificationStatus,
      activityLog,
    ],
  );

  // Automatic localStorage persistence whenever any experiment state, answer, check status, or log changes
  useEffect(() => {
    saveStudentWorkspace(currentWorkspace);
    setSavedStudents(loadSavedStudentIndex());
  }, [currentWorkspace]);

  const applyWorkspaceToState = (nextKey: string, ws: StudentWorkspaceData) => {
    setActiveStudentKey(nextKey);
    setDraftStudent(ws.student);
    setCommittedStudent(ws.student);
    setAssessmentDate(ws.assessmentDate);
    setActiveTab(ws.experimentStates.activeTab);

    setExp1WorkingPixels(
      applyPixelOverrides(
        CORRIDOR_ORIGINAL_PIXELS,
        ws.experimentStates.exp1.pixelOverrides,
      ),
    );
    setExp1ActiveCoord(ws.experimentStates.exp1.activeCoord);
    setExp1SelectionSize(ws.experimentStates.exp1.selectionSize);
    setExp1ChannelView(ws.experimentStates.exp1.channelView);
    setExp1Answer(ws.answers.exp1);

    setExp2ActiveCoord(ws.experimentStates.exp2.activeCoord);
    setExp2SelectionSize(ws.experimentStates.exp2.selectionSize);
    setExp2ChannelView(ws.experimentStates.exp2.channelView);
    setTransformMode(ws.experimentStates.exp2.transformMode);
    setSValue(ws.experimentStates.exp2.sValue);
    setTValue(ws.experimentStates.exp2.tValue);
    setExp2Answer(ws.answers.exp2);

    setExp3MaskBounds(ws.experimentStates.exp3.maskBounds);
    setExp3InspectOrigin(ws.experimentStates.exp3.inspectOrigin);
    setExp3ActiveCoord(ws.experimentStates.exp3.activeCoord);
    setExp3ChannelView(ws.experimentStates.exp3.channelView);
    setExp3Answer(ws.answers.exp3);

    setExp4XValue(ws.experimentStates.exp4.xValue);
    setExp4PatchCenter(ws.experimentStates.exp4.patchCenter);
    setExp4FilterType(ws.experimentStates.exp4.filterType);
    setExp4MeanK(ws.experimentStates.exp4.meanK);
    setExp4EdgeM(ws.experimentStates.exp4.edgeM);
    setExp4OutRow(ws.experimentStates.exp4.outRow);
    setExp4OutCol(ws.experimentStates.exp4.outCol);
    setExp4DisplayMode(ws.experimentStates.exp4.displayMode);
    setExp4Answer(ws.answers.exp4);

    setExp5XGrid(ws.experimentStates.exp5.xGrid);
    setExp5EditLog(ws.experimentStates.exp5.editLog);
    setExp5HasVerifiedDistances(ws.experimentStates.exp5.hasVerifiedDistances);
    setExp5Answer(ws.answers.exp5);

    setVerificationStatus(ws.verificationStatus);
    setActivityLog(ws.activityLog);
    saveActiveStudentKey(nextKey);
    setSavedStudents(loadSavedStudentIndex());
  };

  // Helper returning the latest workspace immediately if draftStudent was typed but not yet committed
  const commitStudentProfileNow = (
    targetProfile: StudentProfile = draftStudent,
  ): StudentWorkspaceData => {
    const cleanTarget: StudentProfile = {
      studentId: targetProfile.studentId.trim(),
      name: targetProfile.name.trim(),
    };
    const targetKey = normalizeStudentKey(cleanTarget.studentId, cleanTarget.name);
    if (targetKey === activeStudentKey) {
      return currentWorkspace;
    }
    const { nextKey, nextWorkspace } = switchStudentWorkspace(
      activeStudentKey,
      currentWorkspace,
      cleanTarget,
    );
    applyWorkspaceToState(nextKey, nextWorkspace);
    return nextWorkspace;
  };

  const handleStartNewStudent = () => {
    saveStudentWorkspace(currentWorkspace);
    const blank = createDefaultWorkspace({ studentId: '', name: '' });
    applyWorkspaceToState(DRAFT_STUDENT_KEY, blank);
    saveStudentWorkspace(blank);
    setBackupNotice({
      type: 'success',
      message: '이전 학생 기록을 분리 저장하고, 새 학생 입력 화면으로 전환했습니다.',
    });
  };

  const handleSwitchSavedStudent = (targetKey: string) => {
    saveStudentWorkspace(currentWorkspace);
    const targetWs = loadStudentWorkspaceByKey(targetKey);
    applyWorkspaceToState(targetKey, targetWs);
    setBackupNotice({
      type: 'success',
      message: `${targetWs.student.studentId} ${targetWs.student.name} 학생의 저장된 실험 기록을 불러왔습니다.`,
    });
  };

  // Verification status setter
  const setExperimentChecked = (
    expId: ExperimentTabId,
    checked: boolean,
    checkNote?: string,
  ) => {
    setVerificationStatus((prev) => ({
      ...prev,
      [expId]: {
        resultChecked: checked,
        checkedAtIso: checked ? new Date().toISOString() : undefined,
        checkNote,
      },
    }));
  };

  // Derived computations
  const exp1RegionCenter = useMemo(
    () =>
      clampCenterCoord(
        exp1ActiveCoord.row,
        exp1ActiveCoord.col,
        exp1SelectionSize,
      ),
    [exp1ActiveCoord, exp1SelectionSize],
  );

  const exp2RegionCenter = useMemo(
    () =>
      clampCenterCoord(
        exp2ActiveCoord.row,
        exp2ActiveCoord.col,
        exp2SelectionSize,
      ),
    [exp2ActiveCoord, exp2SelectionSize],
  );

  const exp2Computed = useMemo(
    () => applyAffineTransform(originalPixels, transformMode, sValue, tValue),
    [originalPixels, transformMode, sValue, tValue],
  );

  const exp3Mask = useMemo(() => buildRectMask(exp3MaskBounds), [exp3MaskBounds]);

  const exp3Composite = useMemo(
    () =>
      applyHadamardComposite(
        originalPixels,
        COMPOSITE_BG_Y_PIXELS,
        exp3Mask,
      ),
    [originalPixels, exp3Mask],
  );

  const exp3Inspection = useMemo(
    () =>
      extract4x4CompositeData(
        originalPixels,
        COMPOSITE_BG_Y_PIXELS,
        exp3Mask,
        exp3Composite.pixels,
        exp3InspectOrigin,
      ),
    [originalPixels, exp3Mask, exp3Composite.pixels, exp3InspectOrigin],
  );

  const exp4Grayscale = useMemo(
    () =>
      setGrayscaleCenterXImmutable(
        CORRIDOR_GRAYSCALE_ORIGINAL,
        exp4XValue,
        EXP4_EVAL_CENTER,
      ),
    [exp4XValue],
  );

  const exp4Patch = useMemo(
    () =>
      extract5x5GrayscalePatch(
        exp4Grayscale,
        exp4PatchCenter.row,
        exp4PatchCenter.col,
      ),
    [exp4Grayscale, exp4PatchCenter],
  );

  const exp4MeanFull = useMemo(
    () => applyConvolutionToFullGrayscaleImage(exp4Grayscale, 'mean', exp4MeanK),
    [exp4Grayscale, exp4MeanK],
  );

  const exp4EdgeFull = useMemo(
    () => applyConvolutionToFullGrayscaleImage(exp4Grayscale, 'edge', exp4EdgeM),
    [exp4Grayscale, exp4EdgeM],
  );

  const exp4ActiveFull = exp4FilterType === 'mean' ? exp4MeanFull : exp4EdgeFull;

  const exp5InitialDistances = useMemo(
    () => computeAllDistances(createInitialBinaryX()),
    [],
  );

  const exp5CurrentDistances = useMemo(
    () => computeAllDistances(exp5XGrid),
    [exp5XGrid],
  );

  const exp5Classification = useMemo(
    () => classifyByHammingDistance(exp5XGrid),
    [exp5XGrid],
  );

  // Exp 1 handlers (confirmed reset keeps answers & logs safe)
  const handleExp1UpdatePixel = (coord: PixelCoord, nextRgb: RgbPixel) => {
    setExp1WorkingPixels((prev) =>
      setPixelImmutable(prev, coord.row, coord.col, nextRgb),
    );
  };

  const handleExp1ResetPixel = (coord: PixelCoord) => {
    const orig = readPixel(originalPixels, coord.row, coord.col);
    setExp1WorkingPixels((prev) =>
      setPixelImmutable(prev, coord.row, coord.col, orig),
    );
  };

  const requestResetExp1 = () => {
    setConfirmDialog({
      isOpen: true,
      title: '실험 ① 현재 상태 초기화',
      description:
        '실험 1 (RGB 데이터 분석)에서 수정한 픽셀과 선택 좌표를 처음 상태로 되돌립니다.\n작성한 답안, 저장된 활동 기록, 다른 실험(2~5)의 데이터는 그대로 유지됩니다.',
      confirmLabel: '실험 ① 상태 초기화',
      tone: 'warning',
      onConfirm: () => {
        setExp1WorkingPixels(createCorridorPixelsCopy());
        setExp1ActiveCoord(EXP1_ANCHOR);
        setExp1SelectionSize(3);
      },
    });
  };

  // Exp 2 confirmed reset
  const requestResetExp2 = () => {
    setConfirmDialog({
      isOpen: true,
      title: '실험 ② 매개변수 초기화',
      description:
        '실험 2 (색상·밝기 변환)의 s, t 매개변수와 연산 종류를 초기값(s=1, t=0)으로 되돌립니다.\n작성한 답안과 저장된 활동 기록은 그대로 유지됩니다.',
      confirmLabel: '실험 ② 매개변수 초기화',
      tone: 'warning',
      onConfirm: () => {
        setTransformMode('combined');
        setSValue(1);
        setTValue(0);
      },
    });
  };

  // Exp 3 handlers & confirmed reset
  const handleExp3ChangeInspectOrigin = (nextOrigin: PixelCoord) => {
    setExp3InspectOrigin(nextOrigin);
    setExp3ActiveCoord({ row: nextOrigin.row + 1, col: nextOrigin.col + 1 });
  };

  const requestResetExp3 = () => {
    setConfirmDialog({
      isOpen: true,
      title: '실험 ③ 마스크 영역 초기화',
      description:
        '실험 3 (이미지 합성)의 마스크 P 사각형 영역과 4×4 확대 관찰 좌표를 초기 상태로 되돌립니다.\n작성한 답안과 저장된 활동 기록은 그대로 유지됩니다.',
      confirmLabel: '실험 ③ 상태 초기화',
      tone: 'warning',
      onConfirm: () => {
        setExp3MaskBounds(EXP3_INITIAL_RECT);
        setExp3InspectOrigin(EXP3_DEFAULT_4X4_ORIGIN);
        setExp3ActiveCoord({ row: 39, col: 51 });
      },
    });
  };

  // Exp 4 confirmed reset
  const requestResetExp4 = () => {
    setConfirmDialog({
      isOpen: true,
      title: '실험 ④ 합성곱 설정 초기화',
      description:
        '실험 4 (합성곱 필터)의 중앙 픽셀 x, 필터 계수 k·m, 선택 영역을 초기 상태로 되돌립니다.\n작성한 답안과 저장된 활동 기록은 그대로 유지됩니다.',
      confirmLabel: '실험 ④ 상태 초기화',
      tone: 'warning',
      onConfirm: () => {
        setExp4XValue(EXP4_INITIAL_X);
        setExp4PatchCenter(EXP4_EVAL_CENTER);
        setExp4FilterType('mean');
        setExp4MeanK(EXP4_INITIAL_MEAN_K);
        setExp4EdgeM(1);
        setExp4OutRow(1);
        setExp4OutCol(1);
        setExp4DisplayMode('clamp');
      },
    });
  };

  // Exp 5 handlers & confirmed reset
  const handleToggleExp5Cell = (coord: PixelCoord) => {
    const r0 = coord.row - 1;
    const c0 = coord.col - 1;
    const fromVal = (exp5XGrid[r0][c0] === 1 ? 1 : 0) as 0 | 1;
    const toVal = (fromVal === 1 ? 0 : 1) as 0 | 1;
    const nextGrid = toggleBinaryCellImmutable(exp5XGrid, coord.row, coord.col);
    const distancesAfter = computeAllDistances(nextGrid);

    setExp5XGrid(nextGrid);
    setExp5EditLog((prev) => [
      ...prev,
      {
        step: prev.length + 1,
        coord,
        fromValue: fromVal,
        toValue: toVal,
        distancesAfter,
      },
    ]);
  };

  const requestResetExp5 = () => {
    setConfirmDialog({
      isOpen: true,
      title: '실험 ⑤ 입력 X 초기화',
      description:
        '실험 5 (이미지 분류)의 입력 이미지 X 수정 내역과 픽셀 반전을 초기 상태로 되돌립니다.\n작성한 답안과 저장된 활동 기록은 그대로 유지됩니다.',
      confirmLabel: '실험 ⑤ 입력 초기화',
      tone: 'warning',
      onConfirm: () => {
        setExp5XGrid(createInitialBinaryX());
        setExp5EditLog([]);
      },
    });
  };

  // Save Activity Records (also marks experiment resultChecked = true cleanly without grading)
  const appendActivityRecord = (record: ActivityRecord) => {
    commitStudentProfileNow();
    setActivityLog((prev) => [record, ...prev]);
    setExperimentChecked(record.experimentId, true, '기록 저장 시 결과 확인 완료');
  };

  const handleSaveExp1Record = () => {
    const currRgb = readPixel(
      exp1WorkingPixels,
      exp1ActiveCoord.row,
      exp1ActiveCoord.col,
    );
    appendActivityRecord({
      id: `rec-${Date.now()}`,
      timestampIso: new Date().toISOString(),
      experimentId: 'rgb-analysis',
      experimentTitle: '1. RGB 데이터 분석',
      summary: `선택 픽셀 (${exp1ActiveCoord.row}, ${exp1ActiveCoord.col}) RGB(${currRgb.r}, ${currRgb.g}, ${currRgb.b}) 분석 기록`,
      parameters: {
        영역크기: `${exp1SelectionSize}×${exp1SelectionSize}`,
        선택좌표: `(${exp1ActiveCoord.row}, ${exp1ActiveCoord.col})`,
        현재RGB: `(${currRgb.r}, ${currRgb.g}, ${currRgb.b})`,
      },
      resultImageDataUrl: renderPixelsToPngDataUrl(
        exp1WorkingPixels,
        CORRIDOR_WIDTH,
        CORRIDOR_HEIGHT,
      ),
      studentAnswers: exp1Answer,
      resultChecked: true,
    });
  };

  const handleSaveExp2Record = () => {
    const { effectiveS, effectiveT } = getEffectiveParams(
      transformMode,
      sValue,
      tValue,
    );
    const formula = formatFormulaText(transformMode, effectiveS, effectiveT);
    appendActivityRecord({
      id: `rec-${Date.now()}`,
      timestampIso: new Date().toISOString(),
      experimentId: 'color-brightness',
      experimentTitle: '2. 색상·밝기 변환',
      summary: `연산 ${formula} 적용 실험 기록`,
      parameters: {
        변환식: formula,
        s: effectiveS,
        t: effectiveT,
        초과제한성분: exp2Computed.stats.clippedHighChannels,
      },
      resultImageDataUrl: renderPixelsToPngDataUrl(
        exp2Computed.pixels,
        CORRIDOR_WIDTH,
        CORRIDOR_HEIGHT,
      ),
      studentAnswers: exp2Answer,
      resultChecked: true,
    });
  };

  const handleSaveExp3Record = () => {
    appendActivityRecord({
      id: `rec-${Date.now()}`,
      timestampIso: new Date().toISOString(),
      experimentId: 'image-composite',
      experimentTitle: '3. 아다마르 곱과 이미지 합성',
      summary: `마스크 영역 (${exp3MaskBounds.rowStart}~${exp3MaskBounds.rowEnd}행, ${exp3MaskBounds.colStart}~${exp3MaskBounds.colEnd}열) 합성 Z 기록`,
      parameters: {
        '유지 영역': `${exp3MaskBounds.rowStart}~${exp3MaskBounds.rowEnd}행, ${exp3MaskBounds.colStart}~${exp3MaskBounds.colEnd}열`,
        '유지 픽셀 수': exp3Composite.stats.keptFromXPixels,
        '확대 4×4 시작': `(${exp3InspectOrigin.row}, ${exp3InspectOrigin.col})`,
      },
      resultImageDataUrl: renderPixelsToPngDataUrl(
        exp3Composite.pixels,
        CORRIDOR_WIDTH,
        CORRIDOR_HEIGHT,
      ),
      studentAnswers: exp3Answer,
      resultChecked: true,
    });
  };

  const handleSaveExp4Record = () => {
    const rgbaResult = convolutionRawToRgbaPixels(
      exp4ActiveFull.rawValues,
      exp4DisplayMode,
    );
    appendActivityRecord({
      id: `rec-${Date.now()}`,
      timestampIso: new Date().toISOString(),
      experimentId: 'convolution-filter',
      experimentTitle: '4. 합성곱 필터와 이미지 변화',
      summary: `${exp4FilterType === 'mean' ? `평균 필터 K₁ (k=${exp4MeanK})` : `경계 필터 K₂ (m=${exp4EdgeM})`} · x=${exp4XValue} 실험 기록`,
      parameters: {
        '활성 필터': exp4FilterType === 'mean' ? `평균 K₁ (k=${exp4MeanK})` : `경계 K₂ (m=${exp4EdgeM})`,
        '평균 필터 계수 k': exp4MeanK,
        '경계 필터 계수 m': exp4EdgeM,
        '중앙 픽셀 x': exp4XValue,
        '표시 변환': exp4DisplayMode === 'clamp' ? '0~255 제한' : '절댓값 |값|',
      },
      resultImageDataUrl: renderPixelsToPngDataUrl(
        rgbaResult,
        CORRIDOR_WIDTH,
        CORRIDOR_HEIGHT,
      ),
      studentAnswers: exp4Answer,
      resultChecked: true,
    });
  };

  const handleSaveExp5Record = () => {
    appendActivityRecord({
      id: `rec-${Date.now()}`,
      timestampIso: new Date().toISOString(),
      experimentId: 'image-classification',
      experimentTitle: '5. 해밍 거리와 이미지 분류',
      summary: `입력 X (${exp5EditLog.length}회 수정) → 분류 ${exp5Classification.predictedDigitLabel}`,
      parameters: {
        '분류 결과': exp5Classification.predictedDigitLabel,
        '수정 횟수': exp5EditLog.length,
        '수정 좌표': formatCoordList(exp5EditLog),
        '현재 해밍 거리': `A:${exp5CurrentDistances.A}, B:${exp5CurrentDistances.B}, C:${exp5CurrentDistances.C}`,
      },
      resultImageDataUrl: renderBinaryGridToPngDataUrl(exp5XGrid),
      studentAnswers: exp5Answer,
      resultChecked: true,
    });
  };

  const handleDeleteRecord = (id: string) => {
    setActivityLog((prev) => prev.filter((item) => item.id !== id));
  };

  const requestClearAllLog = () => {
    const label =
      committedStudent.studentId || committedStudent.name
        ? `${committedStudent.studentId} ${committedStudent.name}`
        : '현재 학생';
    setConfirmDialog({
      isOpen: true,
      title: '현재 학생 전체 기록 삭제',
      description: `${label}의 저장된 활동 기록(${activityLog.length}건)을 모두 삭제하시겠습니까?\n(현재 실험 화면의 매개변수와 입력란 내용은 유지되지만, 저장 목록에서 삭제된 기록은 복구할 수 없습니다.)`,
      confirmLabel: '전체 기록 삭제',
      tone: 'danger',
      onConfirm: () => {
        setActivityLog([]);
      },
    });
  };

  const handleOpenReport = () => {
    commitStudentProfileNow();
    setIsReportOpen(true);
  };

  const handleExportBackup = () => {
    const ws = commitStudentProfileNow();
    const payload = buildBackupPayload(ws);
    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const filename = buildBackupJsonFilename(ws.student, ws.assessmentDate);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    setBackupNotice({
      type: 'success',
      message: `${filename} 백업 파일이 저장되었습니다.`,
    });
  };

  const handleImportBackupFile = async (file: File) => {
    try {
      const raw = await file.text();
      const result = parseAndValidateBackupJson(raw);
      if (!result.ok) {
        setBackupNotice({ type: 'error', message: result.error });
        return;
      }

      const restored = result.workspace;
      const targetKey = normalizeStudentKey(
        restored.student.studentId,
        restored.student.name,
      );
      const studentDisplay =
        restored.student.studentId || restored.student.name
          ? `${restored.student.studentId} ${restored.student.name}`.trim()
          : '학번·이름 미입력';

      setConfirmDialog({
        isOpen: true,
        title: '백업 파일 복원 확인',
        description: `백업 파일의 학생 정보(${studentDisplay}, 저장 기록 ${restored.activityLog.length}건)를 불러와 작업 공간에 적용하시겠습니까?\n기존 학생 기록은 별도로 유지되거나 해당 학생 슬롯으로 복원됩니다.`,
        confirmLabel: '백업 불러오기',
        tone: 'warning',
        onConfirm: () => {
          saveStudentWorkspace(currentWorkspace);
          applyWorkspaceToState(targetKey, restored);
          saveStudentWorkspace(restored);
          setBackupNotice({
            type: 'success',
            message: `${studentDisplay} 학생의 백업 데이터를 성공적으로 복원했습니다.`,
          });
        },
      });
    } catch {
      setBackupNotice({
        type: 'error',
        message: '백업 파일을 읽는 중 오류가 발생했습니다.',
      });
    }
  };

  const handleSelectPreset = (
    setter: React.Dispatch<React.SetStateAction<PixelCoord>>,
    preset: AnchorPreset,
  ) => {
    setter(preset.coord);
  };

  const currentTabMeta = EXPERIMENT_TABS.find((t) => t.id === activeTab)!;

  return (
    <>
      <div className="no-print min-h-screen flex flex-col bg-slate-50 text-slate-900">
        {/* Top Laboratory Header */}
        <header className="bg-white border-b border-slate-200">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap truncate">
                이미지 데이터 처리 실험실
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                픽셀에서 행렬로, 행렬에서 이미지로 · 오류고등학교 인공지능수학 수행평가
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsLogOpen(true)}
              data-testid="open-activity-log-btn"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ClipboardList className="w-4 h-4 text-blue-800" aria-hidden="true" />
              <span>활동 기록 ({activityLog.length})</span>
            </button>
          </div>

          {/* 5 Experiment Navigation Tabs */}
          <div className="border-t border-slate-200 bg-slate-50">
            <div className="max-w-[1440px] mx-auto px-4 sm:px-6">
              <nav
                role="tablist"
                aria-label="인공지능수학 이미지 처리 실험 탭"
                className="flex items-center gap-1 overflow-x-auto py-1.5"
              >
                {EXPERIMENT_TABS.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => {
                        commitStudentProfileNow();
                        setActiveTab(tab.id);
                      }}
                      className={`px-3.5 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        isActive
                          ? 'bg-blue-950 text-white font-semibold'
                          : 'text-slate-700 hover:bg-slate-200/70 hover:text-slate-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        </header>

        {/* Main Experiment Workspace */}
        <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-3.5 flex flex-col gap-3.5">
          {/* First-Screen Student Identity, Assessment Overview, Backup & Full Report Bar */}
          <AssessmentHeaderBar
            draftStudent={draftStudent}
            committedStudent={committedStudent}
            assessmentDate={assessmentDate}
            verificationStatus={verificationStatus}
            savedStudents={savedStudents}
            activeStudentKey={activeStudentKey}
            backupNotice={backupNotice}
            onChangeDraftStudent={setDraftStudent}
            onCommitStudentProfile={() => commitStudentProfileNow()}
            onStartNewStudent={handleStartNewStudent}
            onSwitchSavedStudent={handleSwitchSavedStudent}
            onSelectTab={(t) => {
              commitStudentProfileNow();
              setActiveTab(t);
            }}
            onOpenReport={handleOpenReport}
            onExportBackup={handleExportBackup}
            onImportBackupFile={handleImportBackupFile}
          />

          {/* Experiment Objective Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-xs">
            <div className="flex flex-wrap items-center gap-2 text-slate-800">
              <span className="font-semibold text-blue-950 whitespace-nowrap">
                {currentTabMeta.label}
              </span>
              <span className="text-slate-300" aria-hidden="true">|</span>
              <span>{currentTabMeta.subtitle}</span>
            </div>
            <span className="text-slate-500 font-mono text-[11px] whitespace-nowrap">
              {currentTabMeta.datasetTag}
            </span>
          </div>

          {/* Experiment 1: RGB Analysis */}
          {activeTab === 'rgb-analysis' && (
            <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)_400px] gap-4 items-start">
              <PixelCanvasStage
                imageLabel="학교 복도 안내 표지판 (원본 이미지)"
                pixels={originalPixels}
                alternatePixels={exp1WorkingPixels}
                activeCoord={exp1ActiveCoord}
                regionCenter={exp1RegionCenter}
                selectionSize={exp1SelectionSize}
                presets={EXP1_ANCHOR_PRESETS}
                onSelectCoord={setExp1ActiveCoord}
                onChangeSelectionSize={setExp1SelectionSize}
                onSelectPreset={(p) => handleSelectPreset(setExp1ActiveCoord, p)}
                onResetAll={requestResetExp1}
              />

              <RgbAnalysisCenterPanel
                originalPixels={originalPixels}
                workingPixels={exp1WorkingPixels}
                activeCoord={exp1ActiveCoord}
                regionCenter={exp1RegionCenter}
                selectionSize={exp1SelectionSize}
                channelView={exp1ChannelView}
                onChangeChannelView={setExp1ChannelView}
                onSelectCoord={setExp1ActiveCoord}
                onUpdatePixel={handleExp1UpdatePixel}
                onResetPixel={handleExp1ResetPixel}
                onResetAll={requestResetExp1}
              />

              <RgbAnalysisResultPanel
                originalPixels={originalPixels}
                workingPixels={exp1WorkingPixels}
                activeCoord={exp1ActiveCoord}
                regionCenter={exp1RegionCenter}
                answer={exp1Answer}
                onChangeAnswer={setExp1Answer}
                onSaveRecord={handleSaveExp1Record}
                savedCount={activityLog.length}
                recentRecords={activityLog.filter(
                  (r) => r.experimentId === 'rgb-analysis',
                )}
                resultCheckStatus={verificationStatus['rgb-analysis']}
                onToggleResultCheck={(next) =>
                  setExperimentChecked('rgb-analysis', next, '직접 결과 확인 체크')
                }
              />
            </div>
          )}

          {/* Experiment 2: Brightness & Color Transform */}
          {activeTab === 'color-brightness' && (
            <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)_400px] gap-4 items-start">
              <PixelCanvasStage
                imageLabel="학교 복도 안내 표지판 (원본 이미지)"
                pixels={originalPixels}
                alternatePixels={exp2Computed.pixels}
                activeCoord={exp2ActiveCoord}
                regionCenter={exp2RegionCenter}
                selectionSize={exp2SelectionSize}
                presets={EXP2_ANCHOR_PRESETS}
                onSelectCoord={setExp2ActiveCoord}
                onChangeSelectionSize={setExp2SelectionSize}
                onSelectPreset={(p) => handleSelectPreset(setExp2ActiveCoord, p)}
                onResetAll={requestResetExp2}
                resetLabel="연산 초기화"
              />

              <BrightnessTransformCenterPanel
                originalPixels={originalPixels}
                transformedPixels={exp2Computed.pixels}
                activeCoord={exp2ActiveCoord}
                regionCenter={exp2RegionCenter}
                selectionSize={exp2SelectionSize}
                channelView={exp2ChannelView}
                transformMode={transformMode}
                sValue={sValue}
                tValue={tValue}
                onChangeChannelView={setExp2ChannelView}
                onChangeTransformMode={setTransformMode}
                onChangeS={setSValue}
                onChangeT={setTValue}
                onResetParams={requestResetExp2}
                onSelectCoord={setExp2ActiveCoord}
              />

              <BrightnessTransformResultPanel
                originalPixels={originalPixels}
                transformedPixels={exp2Computed.pixels}
                stats={exp2Computed.stats}
                activeCoord={exp2ActiveCoord}
                transformMode={transformMode}
                sValue={sValue}
                tValue={tValue}
                answer={exp2Answer}
                onChangeAnswer={setExp2Answer}
                onSaveRecord={handleSaveExp2Record}
                savedCount={activityLog.length}
                recentRecords={activityLog.filter(
                  (r) => r.experimentId === 'color-brightness',
                )}
                onSelectCoord={setExp2ActiveCoord}
                resultCheckStatus={verificationStatus['color-brightness']}
                onToggleResultCheck={(next) =>
                  setExperimentChecked('color-brightness', next, '직접 결과 확인 체크')
                }
              />
            </div>
          )}

          {/* Experiment 3: Hadamard Composite */}
          {activeTab === 'image-composite' && (
            <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)_400px] gap-4 items-start">
              <Exp3CompositeLeftPanel
                xPixels={originalPixels}
                yPixels={COMPOSITE_BG_Y_PIXELS}
                mask={exp3Mask}
                maskBounds={exp3MaskBounds}
                inspectOrigin={exp3InspectOrigin}
                onChangeMaskBounds={setExp3MaskBounds}
                onChangeInspectOrigin={handleExp3ChangeInspectOrigin}
                onResetMask={requestResetExp3}
              />

              <Exp3CompositeCenterPanel
                inspection={exp3Inspection}
                activeCoord={exp3ActiveCoord}
                channelView={exp3ChannelView}
                onChangeChannelView={setExp3ChannelView}
                onSelectCoord={setExp3ActiveCoord}
              />

              <Exp3CompositeResultPanel
                xPixels={originalPixels}
                yPixels={COMPOSITE_BG_Y_PIXELS}
                zPixels={exp3Composite.pixels}
                stats={exp3Composite.stats}
                maskBounds={exp3MaskBounds}
                answer={exp3Answer}
                onChangeAnswer={setExp3Answer}
                onSaveRecord={handleSaveExp3Record}
                savedCount={activityLog.length}
                recentRecords={activityLog.filter(
                  (r) => r.experimentId === 'image-composite',
                )}
                resultCheckStatus={verificationStatus['image-composite']}
                onToggleResultCheck={(next) =>
                  setExperimentChecked('image-composite', next, '직접 결과 확인 체크')
                }
              />
            </div>
          )}

          {/* Experiment 4: Convolution Filter */}
          {activeTab === 'convolution-filter' && (
            <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)_400px] gap-4 items-start">
              <Exp4ConvolutionLeftPanel
                grayscale={exp4Grayscale}
                patch={exp4Patch}
                xValue={exp4XValue}
                selectedOutRow={exp4OutRow}
                selectedOutCol={exp4OutCol}
                onSelectPatchCenter={setExp4PatchCenter}
                onChangeXValue={setExp4XValue}
                onResetAll={requestResetExp4}
              />

              <Exp4ConvolutionCenterPanel
                patch={exp4Patch}
                filterType={exp4FilterType}
                meanK={exp4MeanK}
                edgeM={exp4EdgeM}
                selectedOutRow={exp4OutRow}
                selectedOutCol={exp4OutCol}
                onChangeFilterType={setExp4FilterType}
                onChangeMeanK={setExp4MeanK}
                onChangeEdgeM={setExp4EdgeM}
                onSelectOutCell={(r, c) => {
                  setExp4OutRow(r);
                  setExp4OutCol(c);
                }}
              />

              <Exp4ConvolutionResultPanel
                grayscale={exp4Grayscale}
                activeRawValues={exp4ActiveFull.rawValues}
                activeStats={exp4ActiveFull.stats}
                meanRawValues={exp4MeanFull.rawValues}
                edgeRawValues={exp4EdgeFull.rawValues}
                filterType={exp4FilterType}
                meanK={exp4MeanK}
                edgeM={exp4EdgeM}
                edgeDisplayMode={exp4DisplayMode}
                onChangeEdgeDisplayMode={setExp4DisplayMode}
                answer={exp4Answer}
                onChangeAnswer={setExp4Answer}
                onSaveRecord={handleSaveExp4Record}
                savedCount={activityLog.length}
                recentRecords={activityLog.filter(
                  (r) => r.experimentId === 'convolution-filter',
                )}
                resultCheckStatus={verificationStatus['convolution-filter']}
                onToggleResultCheck={(next) =>
                  setExperimentChecked('convolution-filter', next, '직접 결과 확인 체크')
                }
              />
            </div>
          )}

          {/* Experiment 5: Hamming Distance & Classification */}
          {activeTab === 'image-classification' && (
            <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)_400px] gap-4 items-start">
              <Exp5ClassificationLeftPanel
                xGrid={exp5XGrid}
                editLog={exp5EditLog}
                onToggleXCell={handleToggleExp5Cell}
                onResetX={requestResetExp5}
              />

              <Exp5ClassificationCenterPanel
                xGrid={exp5XGrid}
                initialDistances={exp5InitialDistances}
                currentDistances={exp5CurrentDistances}
                editLog={exp5EditLog}
                answer={exp5Answer}
                onChangeAnswer={setExp5Answer}
                onVerifyDistances={() => {
                  setExp5HasVerifiedDistances(true);
                  setExperimentChecked(
                    'image-classification',
                    true,
                    '해밍 거리 계산 결과 확인',
                  );
                }}
              />

              <Exp5ClassificationResultPanel
                classification={exp5Classification}
                editLog={exp5EditLog}
                answer={exp5Answer}
                onChangeAnswer={setExp5Answer}
                onSaveRecord={handleSaveExp5Record}
                savedCount={activityLog.length}
                recentRecords={activityLog.filter(
                  (r) => r.experimentId === 'image-classification',
                )}
                resultCheckStatus={verificationStatus['image-classification']}
                onToggleResultCheck={(next) =>
                  setExperimentChecked('image-classification', next, '직접 결과 확인 체크')
                }
              />
            </div>
          )}
        </main>

        <ActivityLogModal
          isOpen={isLogOpen}
          student={committedStudent}
          records={activityLog}
          onClose={() => setIsLogOpen(false)}
          onDeleteRecord={handleDeleteRecord}
          onClearAll={requestClearAllLog}
        />
      </div>

      <FullReportModal
        isOpen={isReportOpen}
        workspace={currentWorkspace}
        onClose={() => setIsReportOpen(false)}
      />

      <ConfirmDialog
        dialog={confirmDialog}
        onCancel={() => setConfirmDialog(null)}
      />
    </>
  );
}
