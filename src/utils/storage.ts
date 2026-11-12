import {
  ASSESSMENT_META,
  ActivityRecord,
  AllExperimentAnswers,
  AllExperimentStates,
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
  LabBackupPayload,
  PixelRgbOverride,
  SavedStudentSummary,
  SelectionSize,
  StudentProfile,
  StudentWorkspaceData,
  TransformMode,
} from '../types/lab';
import {
  CORRIDOR_HEIGHT,
  CORRIDOR_WIDTH,
  EXP1_ANCHOR,
  EXP2_ANCHOR_A,
} from '../data/corridorImage';
import {
  EXP3_DEFAULT_4X4_ORIGIN,
  EXP3_INITIAL_RECT,
  EXP4_EVAL_CENTER,
  EXP4_INITIAL_X,
  EXP4_INITIAL_MEAN_K,
  createInitialBinaryX,
} from '../data/experimentAssets';
import { clampCenterCoord, clampCoord, readPixel, setPixelImmutable } from '../engine/imageMath';
import { clamp4x4Origin, clampRectBounds } from '../engine/compositeMath';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function resolveStorage(customStorage?: StorageLike): StorageLike | undefined {
  if (customStorage) return customStorage;
  try {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
      return globalThis.localStorage;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export const DRAFT_STUDENT_KEY = '__draft__';
const ACTIVE_STUDENT_POINTER_KEY = 'ai_math_lab_active_student_v2';
const STUDENT_INDEX_KEY = 'ai_math_lab_student_index_v2';
const WORKSPACE_KEY_PREFIX = 'ai_math_lab_workspace_v2::';

// Legacy v1 keys kept only for safe fallback detection if needed
const STORAGE_KEY_EXP1_V1 = 'ai_math_lab_exp1_answer_v1';
const STORAGE_KEY_EXP2_V1 = 'ai_math_lab_exp2_answer_v1';
const STORAGE_KEY_EXP3_V1 = 'ai_math_lab_exp3_answer_v1';
const STORAGE_KEY_EXP4_V1 = 'ai_math_lab_exp4_answer_v1';
const STORAGE_KEY_EXP5_V1 = 'ai_math_lab_exp5_answer_v1';
const STORAGE_KEY_LOG_V1 = 'ai_math_lab_activity_log_v1';

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function sanitizeFilenameSegment(raw: string, fallback: string): string {
  const cleaned = raw
    .trim()
    .replace(/[\\/:*?"<>|\r\n]+/g, '')
    .replace(/\s+/g, '_');
  return cleaned.length > 0 ? cleaned : fallback;
}

export function buildReportPdfFilename(student: StudentProfile): string {
  const idPart = sanitizeFilenameSegment(student.studentId, '학번미입력');
  const namePart = sanitizeFilenameSegment(student.name, '이름미입력');
  return `${idPart}_${namePart}_${ASSESSMENT_META.reportFileSuffix}.pdf`;
}

export function buildBackupJsonFilename(
  student: StudentProfile,
  dateStr: string = getTodayDateString(),
): string {
  const idPart = sanitizeFilenameSegment(student.studentId, '학번미입력');
  const namePart = sanitizeFilenameSegment(student.name, '이름미입력');
  return `${idPart}_${namePart}_실험백업_${dateStr}.json`;
}

export function normalizeStudentKey(studentId: string, name: string): string {
  const idNorm = studentId.trim().replace(/\s+/g, '');
  const nameNorm = name.trim().replace(/\s+/g, '');
  if (!idNorm && !nameNorm) return DRAFT_STUDENT_KEY;
  return `${idNorm || 'noid'}__${nameNorm || 'noname'}`;
}

export function createEmptyMatrix(size: 3 | 4 | 5 = 3): string[][] {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => ''));
}

export function createDefaultExp1Answer(): Experiment1Answer {
  return {
    regionCenterText: '',
    rMatrix: createEmptyMatrix(3),
    gMatrix: createEmptyMatrix(3),
    bMatrix: createEmptyMatrix(3),
    targetBeforeRgb: { r: '', g: '', b: '' },
    targetAfterRgb: { r: '', g: '', b: '' },
    observationNote: '',
    conditionCountText: '',
  };
}

export function createDefaultExp2Answer(): Experiment2Answer {
  return {
    selectedFormula: "A' = sA + tJ",
    recordedS: '',
    recordedT: '',
    pixelACalculation: '',
    pixelBCalculation: '',
    otherPixelBeforeAfter: '',
    overflowHandlingNote: '',
    inquiryReflectionNote: '',
  };
}

export function createDefaultExp3Answer(): Experiment3Answer {
  return {
    formulaText: '',
    selectedRectText: '',
    maskMatrix4x4: createEmptyMatrix(4),
    samplePixelCoord: '',
    samplePixelXRgb: '',
    samplePixelYRgb: '',
    samplePixelMaskP: '',
    samplePixelZRgb: '',
    formulaBlankX: '',
    formulaBlankY: '',
    sample2XRgb: '',
    sample2YRgb: '',
    sample2MaskP: '',
    sample2ZRgb: '',
  };
}

export function createDefaultExp4Answer(): Experiment4Answer {
  return {
    recordedX: '',
    recordedK: '',
    recordedM: '',
    meanOutput3x3: createEmptyMatrix(3),
    meanCalcStep: '',
    edgeKernel3x3: createEmptyMatrix(3),
    edgeOutput3x3: createEmptyMatrix(3),
    edgeCalcStep: '',
  };
}

export function createDefaultExp5Answer(): Experiment5Answer {
  return {
    initialDistA: '',
    initialDistB: '',
    initialDistC: '',
    predictedDigit: '',
    editedCoordsText: '',
    editCountText: '',
    finalDistB: '',
    relationExplanation: '',
  };
}

export function createDefaultAnswers(): AllExperimentAnswers {
  return {
    exp1: createDefaultExp1Answer(),
    exp2: createDefaultExp2Answer(),
    exp3: createDefaultExp3Answer(),
    exp4: createDefaultExp4Answer(),
    exp5: createDefaultExp5Answer(),
  };
}

export function createDefaultExperimentStates(): AllExperimentStates {
  return {
    activeTab: 'rgb-analysis',
    exp1: {
      pixelOverrides: [],
      activeCoord: { ...EXP1_ANCHOR },
      selectionSize: 3,
      channelView: 'all',
    },
    exp2: {
      activeCoord: { ...EXP2_ANCHOR_A },
      selectionSize: 3,
      channelView: 'r',
      transformMode: 'combined',
      sValue: 1,
      tValue: 0,
    },
    exp3: {
      maskBounds: { ...EXP3_INITIAL_RECT },
      inspectOrigin: { ...EXP3_DEFAULT_4X4_ORIGIN },
      activeCoord: { ...EXP1_ANCHOR },
      channelView: 'all',
    },
    exp4: {
      xValue: EXP4_INITIAL_X,
      patchCenter: { ...EXP4_EVAL_CENTER },
      filterType: 'mean',
      meanK: EXP4_INITIAL_MEAN_K,
      edgeM: 1,
      outRow: 1,
      outCol: 1,
      displayMode: 'clamp',
    },
    exp5: {
      xGrid: createInitialBinaryX(),
      editLog: [],
      hasVerifiedDistances: false,
    },
  };
}

export function createDefaultVerificationMap(): ExperimentVerificationMap {
  return {
    'rgb-analysis': { resultChecked: false },
    'color-brightness': { resultChecked: false },
    'image-composite': { resultChecked: false },
    'convolution-filter': { resultChecked: false },
    'image-classification': { resultChecked: false },
  };
}

export function createDefaultWorkspace(
  student: StudentProfile = { studentId: '', name: '' },
  assessmentDate: string = getTodayDateString(),
): StudentWorkspaceData {
  return {
    schemaVersion: 2,
    student: {
      studentId: student.studentId.trim(),
      name: student.name.trim(),
    },
    assessmentDate,
    updatedAtIso: new Date().toISOString(),
    experimentStates: createDefaultExperimentStates(),
    answers: createDefaultAnswers(),
    verificationStatus: createDefaultVerificationMap(),
    activityLog: [],
  };
}

export function extractPixelOverrides(
  original: Uint8ClampedArray,
  working: Uint8ClampedArray,
  width: number = CORRIDOR_WIDTH,
  height: number = CORRIDOR_HEIGHT,
): PixelRgbOverride[] {
  const overrides: PixelRgbOverride[] = [];
  for (let row = 1; row <= height; row += 1) {
    for (let col = 1; col <= width; col += 1) {
      const idx = ((row - 1) * width + (col - 1)) * 4;
      if (
        original[idx] !== working[idx] ||
        original[idx + 1] !== working[idx + 1] ||
        original[idx + 2] !== working[idx + 2]
      ) {
        overrides.push({
          row,
          col,
          r: working[idx],
          g: working[idx + 1],
          b: working[idx + 2],
        });
      }
    }
  }
  return overrides;
}

export function applyPixelOverrides(
  original: Uint8ClampedArray,
  overrides: PixelRgbOverride[],
  width: number = CORRIDOR_WIDTH,
  height: number = CORRIDOR_HEIGHT,
): Uint8ClampedArray {
  let buf: Uint8ClampedArray = new Uint8ClampedArray(original);
  for (const ov of overrides) {
    buf = setPixelImmutable(buf, ov.row, ov.col, { r: ov.r, g: ov.g, b: ov.b }, width, height);
  }
  return buf;
}

function normalizeStringMatrix(
  raw: unknown,
  size: 3 | 4 | 5,
): string[][] {
  const empty = createEmptyMatrix(size);
  if (!Array.isArray(raw)) return empty;
  return empty.map((emptyRow, r) => {
    const rawRow = Array.isArray(raw[r]) ? raw[r] : [];
    return emptyRow.map((_, c) =>
      typeof rawRow[c] === 'string' ? rawRow[c] : '',
    );
  });
}

function normalizeBinaryGrid8x8(raw: unknown): number[][] {
  const fallback = createInitialBinaryX();
  if (!Array.isArray(raw) || raw.length !== 8) return fallback;
  const normalized: number[][] = [];
  for (let r = 0; r < 8; r += 1) {
    const row = raw[r];
    if (!Array.isArray(row) || row.length !== 8) return fallback;
    normalized.push(row.map((cell) => (cell === 1 ? 1 : 0)));
  }
  return normalized;
}

const VALID_TABS: ExperimentTabId[] = [
  'rgb-analysis',
  'color-brightness',
  'image-composite',
  'convolution-filter',
  'image-classification',
];

const VALID_CHANNELS: ChannelViewMode[] = ['all', 'r', 'g', 'b'];
const VALID_TRANSFORM_MODES: TransformMode[] = ['add', 'scale', 'combined'];
const VALID_FILTER_TYPES: ConvolutionFilterType[] = ['mean', 'edge'];
const VALID_EDGE_DISPLAY: EdgeDisplayMode[] = ['clamp', 'abs'];

export function normalizeWorkspaceData(
  raw: Partial<StudentWorkspaceData> | null | undefined,
  fallbackStudent?: StudentProfile,
): StudentWorkspaceData {
  const base = createDefaultWorkspace(fallbackStudent);
  if (!raw || typeof raw !== 'object') return base;

  const studentObj = raw.student && typeof raw.student === 'object' ? raw.student : base.student;
  const student: StudentProfile = {
    studentId:
      typeof studentObj.studentId === 'string'
        ? studentObj.studentId
        : base.student.studentId,
    name: typeof studentObj.name === 'string' ? studentObj.name : base.student.name,
  };

  const statesRaw = (raw.experimentStates ?? {}) as Partial<AllExperimentStates>;
  const exp1Raw = (statesRaw.exp1 ?? {}) as Partial<AllExperimentStates['exp1']>;
  const exp2Raw = (statesRaw.exp2 ?? {}) as Partial<AllExperimentStates['exp2']>;
  const exp3Raw = (statesRaw.exp3 ?? {}) as Partial<AllExperimentStates['exp3']>;
  const exp4Raw = (statesRaw.exp4 ?? {}) as Partial<AllExperimentStates['exp4']>;
  const exp5Raw = (statesRaw.exp5 ?? {}) as Partial<AllExperimentStates['exp5']>;

  const activeTab: ExperimentTabId = VALID_TABS.includes(statesRaw.activeTab as ExperimentTabId)
    ? (statesRaw.activeTab as ExperimentTabId)
    : base.experimentStates.activeTab;

  const exp1Overrides: PixelRgbOverride[] = Array.isArray(exp1Raw.pixelOverrides)
    ? exp1Raw.pixelOverrides
        .filter(
          (o): o is PixelRgbOverride =>
            Boolean(o) &&
            typeof o.row === 'number' &&
            typeof o.col === 'number' &&
            typeof o.r === 'number' &&
            typeof o.g === 'number' &&
            typeof o.b === 'number',
        )
        .map((o) => {
          const coord = clampCoord(o.row, o.col);
          return {
            row: coord.row,
            col: coord.col,
            r: Math.max(0, Math.min(255, Math.round(o.r))),
            g: Math.max(0, Math.min(255, Math.round(o.g))),
            b: Math.max(0, Math.min(255, Math.round(o.b))),
          };
        })
    : [];

  const exp1SelSize: SelectionSize = exp1Raw.selectionSize === 5 ? 5 : 3;
  const exp2SelSize: SelectionSize = exp2Raw.selectionSize === 5 ? 5 : 3;

  const exp1ActiveCoord = exp1Raw.activeCoord
    ? clampCoord(exp1Raw.activeCoord.row, exp1Raw.activeCoord.col)
    : base.experimentStates.exp1.activeCoord;
  const exp2ActiveCoord = exp2Raw.activeCoord
    ? clampCoord(exp2Raw.activeCoord.row, exp2Raw.activeCoord.col)
    : base.experimentStates.exp2.activeCoord;
  const exp3ActiveCoord = exp3Raw.activeCoord
    ? clampCoord(exp3Raw.activeCoord.row, exp3Raw.activeCoord.col)
    : base.experimentStates.exp3.activeCoord;

  const exp3MaskBounds = exp3Raw.maskBounds
    ? clampRectBounds(exp3Raw.maskBounds)
    : base.experimentStates.exp3.maskBounds;
  const exp3InspectOrigin = exp3Raw.inspectOrigin
    ? clamp4x4Origin(exp3Raw.inspectOrigin)
    : base.experimentStates.exp3.inspectOrigin;

  const exp4PatchCenter = exp4Raw.patchCenter
    ? clampCenterCoord(exp4Raw.patchCenter.row, exp4Raw.patchCenter.col, 5)
    : base.experimentStates.exp4.patchCenter;

  const ansRaw = (raw.answers ?? {}) as Partial<AllExperimentAnswers>;
  const a1 = { ...createDefaultExp1Answer(), ...(ansRaw.exp1 ?? {}) };
  a1.rMatrix = normalizeStringMatrix(a1.rMatrix, 3);
  a1.gMatrix = normalizeStringMatrix(a1.gMatrix, 3);
  a1.bMatrix = normalizeStringMatrix(a1.bMatrix, 3);

  const a2 = { ...createDefaultExp2Answer(), ...(ansRaw.exp2 ?? {}) };
  const a3 = { ...createDefaultExp3Answer(), ...(ansRaw.exp3 ?? {}) };
  a3.maskMatrix4x4 = normalizeStringMatrix(a3.maskMatrix4x4, 4);

  const a4 = { ...createDefaultExp4Answer(), ...(ansRaw.exp4 ?? {}) };
  a4.recordedK = typeof a4.recordedK === 'string' ? a4.recordedK : '';
  a4.meanOutput3x3 = normalizeStringMatrix(a4.meanOutput3x3, 3);
  a4.edgeKernel3x3 = normalizeStringMatrix(a4.edgeKernel3x3, 3);
  a4.edgeOutput3x3 = normalizeStringMatrix(a4.edgeOutput3x3, 3);

  const a5 = { ...createDefaultExp5Answer(), ...(ansRaw.exp5 ?? {}) };

  const defaultVer = createDefaultVerificationMap();
  const verRaw = (raw.verificationStatus ?? {}) as Partial<ExperimentVerificationMap>;
  const verificationStatus: ExperimentVerificationMap = {
    'rgb-analysis': { ...defaultVer['rgb-analysis'], ...(verRaw['rgb-analysis'] ?? {}) },
    'color-brightness': { ...defaultVer['color-brightness'], ...(verRaw['color-brightness'] ?? {}) },
    'image-composite': { ...defaultVer['image-composite'], ...(verRaw['image-composite'] ?? {}) },
    'convolution-filter': { ...defaultVer['convolution-filter'], ...(verRaw['convolution-filter'] ?? {}) },
    'image-classification': { ...defaultVer['image-classification'], ...(verRaw['image-classification'] ?? {}) },
  };

  return {
    schemaVersion: 2,
    student,
    assessmentDate:
      typeof raw.assessmentDate === 'string' && raw.assessmentDate.trim()
        ? raw.assessmentDate.trim()
        : base.assessmentDate,
    updatedAtIso:
      typeof raw.updatedAtIso === 'string' ? raw.updatedAtIso : new Date().toISOString(),
    experimentStates: {
      activeTab,
      exp1: {
        pixelOverrides: exp1Overrides,
        activeCoord: exp1ActiveCoord,
        selectionSize: exp1SelSize,
        channelView: VALID_CHANNELS.includes(exp1Raw.channelView as ChannelViewMode)
          ? (exp1Raw.channelView as ChannelViewMode)
          : base.experimentStates.exp1.channelView,
      },
      exp2: {
        activeCoord: exp2ActiveCoord,
        selectionSize: exp2SelSize,
        channelView: VALID_CHANNELS.includes(exp2Raw.channelView as ChannelViewMode)
          ? (exp2Raw.channelView as ChannelViewMode)
          : base.experimentStates.exp2.channelView,
        transformMode: VALID_TRANSFORM_MODES.includes(exp2Raw.transformMode as TransformMode)
          ? (exp2Raw.transformMode as TransformMode)
          : base.experimentStates.exp2.transformMode,
        sValue:
          typeof exp2Raw.sValue === 'number' && Number.isFinite(exp2Raw.sValue)
            ? exp2Raw.sValue
            : base.experimentStates.exp2.sValue,
        tValue:
          typeof exp2Raw.tValue === 'number' && Number.isFinite(exp2Raw.tValue)
            ? exp2Raw.tValue
            : base.experimentStates.exp2.tValue,
      },
      exp3: {
        maskBounds: exp3MaskBounds,
        inspectOrigin: exp3InspectOrigin,
        activeCoord: exp3ActiveCoord,
        channelView: VALID_CHANNELS.includes(exp3Raw.channelView as ChannelViewMode)
          ? (exp3Raw.channelView as ChannelViewMode)
          : base.experimentStates.exp3.channelView,
      },
      exp4: {
        xValue:
          typeof exp4Raw.xValue === 'number' && Number.isFinite(exp4Raw.xValue)
            ? Math.max(0, Math.min(255, Math.round(exp4Raw.xValue)))
            : base.experimentStates.exp4.xValue,
        patchCenter: exp4PatchCenter,
        filterType: VALID_FILTER_TYPES.includes(exp4Raw.filterType as ConvolutionFilterType)
          ? (exp4Raw.filterType as ConvolutionFilterType)
          : base.experimentStates.exp4.filterType,
        meanK:
          typeof exp4Raw.meanK === 'number' && Number.isFinite(exp4Raw.meanK)
            ? Math.max(1, Math.min(3, Math.round(exp4Raw.meanK)))
            : // 이전 버전(계수 k 없음, K₁ = 1/9 고정) 저장 데이터는 k=1로 복원해 기존 결과를 보존
              exp4Raw.xValue !== undefined
              ? 1
              : base.experimentStates.exp4.meanK,
        edgeM:
          typeof exp4Raw.edgeM === 'number' && Number.isFinite(exp4Raw.edgeM)
            ? Math.max(1, Math.min(3, Math.round(exp4Raw.edgeM)))
            : base.experimentStates.exp4.edgeM,
        outRow:
          typeof exp4Raw.outRow === 'number' && Number.isFinite(exp4Raw.outRow)
            ? Math.max(0, Math.min(2, Math.round(exp4Raw.outRow)))
            : base.experimentStates.exp4.outRow,
        outCol:
          typeof exp4Raw.outCol === 'number' && Number.isFinite(exp4Raw.outCol)
            ? Math.max(0, Math.min(2, Math.round(exp4Raw.outCol)))
            : base.experimentStates.exp4.outCol,
        displayMode: VALID_EDGE_DISPLAY.includes(exp4Raw.displayMode as EdgeDisplayMode)
          ? (exp4Raw.displayMode as EdgeDisplayMode)
          : base.experimentStates.exp4.displayMode,
      },
      exp5: {
        xGrid: normalizeBinaryGrid8x8(exp5Raw.xGrid),
        editLog: Array.isArray(exp5Raw.editLog) ? exp5Raw.editLog : [],
        hasVerifiedDistances: Boolean(exp5Raw.hasVerifiedDistances),
      },
    },
    answers: {
      exp1: a1,
      exp2: a2,
      exp3: a3,
      exp4: a4,
      exp5: a5,
    },
    verificationStatus,
    activityLog: Array.isArray(raw.activityLog) ? (raw.activityLog as ActivityRecord[]) : [],
  };
}

export function loadActiveStudentKey(customStorage?: StorageLike): string {
  const storage = resolveStorage(customStorage);
  if (!storage) return DRAFT_STUDENT_KEY;
  try {
    return storage.getItem(ACTIVE_STUDENT_POINTER_KEY) || DRAFT_STUDENT_KEY;
  } catch {
    return DRAFT_STUDENT_KEY;
  }
}

export function saveActiveStudentKey(key: string, customStorage?: StorageLike): void {
  const storage = resolveStorage(customStorage);
  if (!storage) return;
  try {
    storage.setItem(ACTIVE_STUDENT_POINTER_KEY, key);
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function loadSavedStudentIndex(customStorage?: StorageLike): SavedStudentSummary[] {
  const storage = resolveStorage(customStorage);
  if (!storage) return [];
  try {
    const raw = storage.getItem(STUDENT_INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedStudentSummary[]) : [];
  } catch {
    return [];
  }
}

function updateSavedStudentIndex(
  studentKey: string,
  workspace: StudentWorkspaceData,
  storage: StorageLike,
): void {
  if (studentKey === DRAFT_STUDENT_KEY) return;
  if (!workspace.student.studentId.trim() && !workspace.student.name.trim()) return;

  const checkedCount = Object.values(workspace.verificationStatus).filter(
    (s) => s.resultChecked,
  ).length;
  const entry: SavedStudentSummary = {
    studentKey,
    student: { ...workspace.student },
    updatedAtIso: workspace.updatedAtIso,
    checkedCount,
    recordCount: workspace.activityLog.length,
  };

  const currentList = loadSavedStudentIndex(storage).filter(
    (item) => item.studentKey !== studentKey,
  );
  const nextList = [entry, ...currentList].slice(0, 40);
  try {
    storage.setItem(STUDENT_INDEX_KEY, JSON.stringify(nextList));
  } catch {
    // Ignore storage errors
  }
}

export function hasExistingStudentWorkspace(
  studentKey: string,
  customStorage?: StorageLike,
): boolean {
  const storage = resolveStorage(customStorage);
  if (!storage) return false;
  try {
    return storage.getItem(`${WORKSPACE_KEY_PREFIX}${studentKey}`) !== null;
  } catch {
    return false;
  }
}

export function loadStudentWorkspaceByKey(
  studentKey: string,
  fallbackProfile?: StudentProfile,
  customStorage?: StorageLike,
): StudentWorkspaceData {
  const storage = resolveStorage(customStorage);
  if (!storage) return createDefaultWorkspace(fallbackProfile);
  try {
    const raw = storage.getItem(`${WORKSPACE_KEY_PREFIX}${studentKey}`);
    if (!raw) {
      return createDefaultWorkspace(fallbackProfile);
    }
    const parsed = JSON.parse(raw) as Partial<StudentWorkspaceData>;
    return normalizeWorkspaceData(parsed, fallbackProfile);
  } catch {
    return createDefaultWorkspace(fallbackProfile);
  }
}

export function saveStudentWorkspace(
  workspace: StudentWorkspaceData,
  customStorage?: StorageLike,
): string {
  const key = normalizeStudentKey(workspace.student.studentId, workspace.student.name);
  const storage = resolveStorage(customStorage);
  if (!storage) return key;

  const stamped: StudentWorkspaceData = {
    ...workspace,
    updatedAtIso: new Date().toISOString(),
  };

  try {
    storage.setItem(`${WORKSPACE_KEY_PREFIX}${key}`, JSON.stringify(stamped));
    storage.setItem(ACTIVE_STUDENT_POINTER_KEY, key);
    updateSavedStudentIndex(key, stamped, storage);
  } catch {
    // Ignore storage quota errors gracefully
  }
  return key;
}

export function hasAnyAnswerContent(ans: AllExperimentAnswers): boolean {
  const nonEmptyMatrix = (m: string[][]) =>
    m.some((row) => row.some((c) => c.trim() !== ''));
  return (
    ans.exp1.regionCenterText.trim() !== '' ||
    ans.exp1.observationNote.trim() !== '' ||
    (ans.exp1.conditionCountText ?? '').trim() !== '' ||
    (ans.exp3.samplePixelZRgb ?? '').trim() !== '' ||
    (ans.exp3.sample2ZRgb ?? '').trim() !== '' ||
    ans.exp1.targetBeforeRgb.r !== '' ||
    ans.exp1.targetAfterRgb.r !== '' ||
    nonEmptyMatrix(ans.exp1.rMatrix) ||
    nonEmptyMatrix(ans.exp1.gMatrix) ||
    nonEmptyMatrix(ans.exp1.bMatrix) ||
    ans.exp2.recordedS.trim() !== '' ||
    ans.exp2.recordedT.trim() !== '' ||
    ans.exp2.pixelACalculation.trim() !== '' ||
    ans.exp2.pixelBCalculation.trim() !== '' ||
    ans.exp2.otherPixelBeforeAfter.trim() !== '' ||
    ans.exp3.formulaText.trim() !== '' ||
    ans.exp3.selectedRectText.trim() !== '' ||
    nonEmptyMatrix(ans.exp3.maskMatrix4x4) ||
    ans.exp4.recordedX.trim() !== '' ||
    ans.exp4.recordedM.trim() !== '' ||
    (ans.exp4.recordedK ?? '').trim() !== '' ||
    nonEmptyMatrix(ans.exp4.meanOutput3x3) ||
    nonEmptyMatrix(ans.exp4.edgeOutput3x3) ||
    ans.exp5.initialDistA.trim() !== '' ||
    ans.exp5.predictedDigit.trim() !== '' ||
    ans.exp5.relationExplanation.trim() !== ''
  );
}

export function hasWorkspaceActivity(workspace: StudentWorkspaceData): boolean {
  const s = workspace.experimentStates;
  return (
    workspace.activityLog.length > 0 ||
    Object.values(workspace.verificationStatus).some((v) => v.resultChecked) ||
    hasAnyAnswerContent(workspace.answers) ||
    s.exp1.pixelOverrides.length > 0 ||
    s.exp2.sValue !== 1 ||
    s.exp2.tValue !== 0 ||
    s.exp3.maskBounds.rowStart !== EXP3_INITIAL_RECT.rowStart ||
    s.exp4.xValue !== EXP4_INITIAL_X ||
    s.exp4.edgeM !== 1 ||
    s.exp4.meanK !== EXP4_INITIAL_MEAN_K ||
    s.exp5.editLog.length > 0
  );
}

/**
 * Switches the active student safely while preventing cross-student contamination.
 * - If moving from anonymous draft (__draft__) to a brand-new student (not yet saved),
 *   any current draft progress is promoted cleanly to that student.
 * - Otherwise saves previous student in their own key and loads the target student's
 *   isolated workspace (or starts clean if new).
 */
export function switchStudentWorkspace(
  fromKey: string,
  currentWorkspace: StudentWorkspaceData,
  targetStudent: StudentProfile,
  customStorage?: StorageLike,
): { nextKey: string; nextWorkspace: StudentWorkspaceData } {
  const storage = resolveStorage(customStorage);
  const cleanTarget: StudentProfile = {
    studentId: targetStudent.studentId.trim(),
    name: targetStudent.name.trim(),
  };
  const targetKey = normalizeStudentKey(cleanTarget.studentId, cleanTarget.name);

  if (fromKey === targetKey) {
    const updated: StudentWorkspaceData = {
      ...currentWorkspace,
      student: cleanTarget,
    };
    saveStudentWorkspace(updated, storage);
    return { nextKey: targetKey, nextWorkspace: updated };
  }

  // Save previous workspace cleanly under its own student bucket
  saveStudentWorkspace(currentWorkspace, storage);

  const targetExists = hasExistingStudentWorkspace(targetKey, storage);
  if (fromKey === DRAFT_STUDENT_KEY && targetKey !== DRAFT_STUDENT_KEY && !targetExists) {
    // Promote unowned draft into the newly identified student cleanly
    const promoted: StudentWorkspaceData = {
      ...currentWorkspace,
      student: cleanTarget,
    };
    if (storage) {
      try {
        storage.removeItem(`${WORKSPACE_KEY_PREFIX}${DRAFT_STUDENT_KEY}`);
      } catch {
        // Ignore cleanup failure
      }
    }
    saveStudentWorkspace(promoted, storage);
    return { nextKey: targetKey, nextWorkspace: promoted };
  }

  const nextWorkspace = loadStudentWorkspaceByKey(targetKey, cleanTarget, storage);
  nextWorkspace.student = cleanTarget;
  saveStudentWorkspace(nextWorkspace, storage);
  return { nextKey: targetKey, nextWorkspace };
}

export function buildBackupPayload(workspace: StudentWorkspaceData): LabBackupPayload {
  return {
    schemaVersion: 2,
    exportedAtIso: new Date().toISOString(),
    assessmentMeta: {
      school: ASSESSMENT_META.school,
      subject: ASSESSMENT_META.subject,
      title: ASSESSMENT_META.title,
      totalPoints: ASSESSMENT_META.totalPoints,
    },
    workspace,
  };
}

export function parseAndValidateBackupJson(
  rawText: string,
): { ok: true; workspace: StudentWorkspaceData } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(rawText) as Partial<LabBackupPayload> & Partial<StudentWorkspaceData>;
    if (!parsed || typeof parsed !== 'object') {
      return { ok: false, error: '올바른 JSON 백업 객체 형식이 아닙니다.' };
    }

    // Support wrapped LabBackupPayload v2 or raw StudentWorkspaceData v2
    const candidateWorkspace =
      parsed.workspace && typeof parsed.workspace === 'object'
        ? parsed.workspace
        : parsed.experimentStates && parsed.answers
          ? (parsed as Partial<StudentWorkspaceData>)
          : null;

    if (!candidateWorkspace || !candidateWorkspace.experimentStates || !candidateWorkspace.answers) {
      return {
        ok: false,
        error: '이미지 데이터 처리 실험실의 백업 파일(experimentStates·answers 포함)이 아닙니다.',
      };
    }

    const normalized = normalizeWorkspaceData(candidateWorkspace);
    return { ok: true, workspace: normalized };
  } catch {
    return { ok: false, error: 'JSON 파일을 읽을 수 없습니다. 파일 형식을 확인해 주세요.' };
  }
}

/**
 * Legacy helper retained strictly for backwards migration if a browser only has v1 keys.
 */
export function loadLegacyV1WorkspaceIfAny(customStorage?: StorageLike): StudentWorkspaceData | null {
  const storage = resolveStorage(customStorage);
  if (!storage) return null;
  try {
    const hasAnyV1 =
      storage.getItem(STORAGE_KEY_EXP1_V1) ||
      storage.getItem(STORAGE_KEY_EXP2_V1) ||
      storage.getItem(STORAGE_KEY_EXP3_V1) ||
      storage.getItem(STORAGE_KEY_EXP4_V1) ||
      storage.getItem(STORAGE_KEY_EXP5_V1) ||
      storage.getItem(STORAGE_KEY_LOG_V1);
    if (!hasAnyV1) return null;

    const base = createDefaultWorkspace();
    const tryParse = <T,>(k: string, fallback: T): T => {
      const s = storage.getItem(k);
      if (!s) return fallback;
      try {
        return { ...fallback, ...(JSON.parse(s) as Partial<T>) };
      } catch {
        return fallback;
      }
    };

    base.answers.exp1 = tryParse(STORAGE_KEY_EXP1_V1, createDefaultExp1Answer());
    base.answers.exp2 = tryParse(STORAGE_KEY_EXP2_V1, createDefaultExp2Answer());
    base.answers.exp3 = tryParse(STORAGE_KEY_EXP3_V1, createDefaultExp3Answer());
    base.answers.exp4 = tryParse(STORAGE_KEY_EXP4_V1, createDefaultExp4Answer());
    base.answers.exp5 = tryParse(STORAGE_KEY_EXP5_V1, createDefaultExp5Answer());

    const logRaw = storage.getItem(STORAGE_KEY_LOG_V1);
    if (logRaw) {
      const logParsed = JSON.parse(logRaw);
      if (Array.isArray(logParsed)) {
        base.activityLog = logParsed as ActivityRecord[];
      }
    }
    return base;
  } catch {
    return null;
  }
}

export function renderPixelsToPngDataUrl(
  pixels: Uint8ClampedArray,
  width: number = CORRIDOR_WIDTH,
  height: number = CORRIDOR_HEIGHT,
): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const imageData = new ImageData(new Uint8ClampedArray(pixels), width, height);
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

export function renderGrayscaleToPngDataUrl(
  gray: Uint8Array,
  width: number = CORRIDOR_WIDTH,
  height: number = CORRIDOR_HEIGHT,
): string {
  if (typeof document === 'undefined') return '';
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < gray.length; i += 1) {
    const v = gray[i];
    const idx = i * 4;
    rgba[idx] = v;
    rgba[idx + 1] = v;
    rgba[idx + 2] = v;
    rgba[idx + 3] = 255;
  }
  return renderPixelsToPngDataUrl(rgba, width, height);
}

export function renderBinaryMaskToPngDataUrl(
  mask: Uint8Array,
  width: number = CORRIDOR_WIDTH,
  height: number = CORRIDOR_HEIGHT,
): string {
  if (typeof document === 'undefined') return '';
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < mask.length; i += 1) {
    const v = mask[i] === 1 ? 255 : 0;
    const idx = i * 4;
    rgba[idx] = v;
    rgba[idx + 1] = v;
    rgba[idx + 2] = v;
    rgba[idx + 3] = 255;
  }
  return renderPixelsToPngDataUrl(rgba, width, height);
}

export function renderBinaryGridToPngDataUrl(
  grid: number[][],
  cellPx: number = 16,
): string {
  if (typeof document === 'undefined') return '';
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  if (rows === 0 || cols === 0) return '';
  const canvas = document.createElement('canvas');
  canvas.width = cols * cellPx;
  canvas.height = rows * cellPx;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      ctx.fillStyle = grid[r][c] === 1 ? '#0f172a' : '#f8fafc';
      ctx.fillRect(c * cellPx, r * cellPx, cellPx, cellPx);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.strokeRect(c * cellPx + 0.5, r * cellPx + 0.5, cellPx - 1, cellPx - 1);
    }
  }
  return canvas.toDataURL('image/png');
}

export { readPixel };
