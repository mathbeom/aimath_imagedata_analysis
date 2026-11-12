export type ExperimentTabId =
  | 'rgb-analysis'
  | 'color-brightness'
  | 'image-composite'
  | 'convolution-filter'
  | 'image-classification';

export type SelectionSize = 3 | 5;

export type ChannelViewMode = 'all' | 'r' | 'g' | 'b';

export type TransformMode = 'add' | 'scale' | 'combined';

export type ResultCompareMode = 'result' | 'side-by-side' | 'split';

export interface RgbPixel {
  r: number;
  g: number;
  b: number;
}

export interface PixelCoord {
  /** 1-based row coordinate (1..height) */
  row: number;
  /** 1-based column coordinate (1..width) */
  col: number;
}

export interface ChannelMatrices {
  rows: number[];
  cols: number[];
  r: number[][];
  g: number[][];
  b: number[][];
}

export interface ChannelTransformDetail {
  original: number;
  raw: number;
  rounded: number;
  clamped: number;
  wasRounded: boolean;
  clampState: 'none' | 'low' | 'high';
}

export interface PixelTransformDetail {
  r: ChannelTransformDetail;
  g: ChannelTransformDetail;
  b: ChannelTransformDetail;
}

export interface TransformStats {
  totalPixels: number;
  totalChannels: number;
  clippedHighChannels: number;
  clippedLowChannels: number;
  roundedChannels: number;
}

export interface TargetPixelStatus {
  label: string;
  coord: PixelCoord;
  original: RgbPixel;
  current: RgbPixel;
  target: RgbPixel;
  isMet: boolean;
}

export interface AnchorPreset {
  id: string;
  label: string;
  description: string;
  coord: PixelCoord;
  expectedRgb?: RgbPixel;
}

/* Experiment 3: Hadamard Composite */
export interface RectMaskBounds {
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
}

export interface CompositeStats {
  totalPixels: number;
  keptFromXPixels: number;
  replacedWithYPixels: number;
}

/* Experiment 4: Convolution */
export type ConvolutionFilterType = 'mean' | 'edge';

export type EdgeDisplayMode = 'clamp' | 'abs';

export interface ConvolutionTerm {
  kernelRow: number;
  kernelCol: number;
  imageRow: number;
  imageCol: number;
  imageValue: number;
  kernelCoefficientNumerator: number;
  kernelDenominator: number;
  kernelValue: number;
  product: number;
}

export interface ConvolutionCellDetail {
  outRow: number;
  outCol: number;
  terms: ConvolutionTerm[];
  rawSum: number;
  roundedValue: number;
}

/* Experiment 5: Hamming Distance & Classification */
export type BinaryImageId = 'A' | 'B' | 'C' | 'X';

export interface BinaryEditEntry {
  step: number;
  coord: PixelCoord;
  fromValue: 0 | 1;
  toValue: 0 | 1;
  distancesAfter: {
    A: number;
    B: number;
    C: number;
  };
}

export interface Experiment1Answer {
  regionCenterText: string;
  rMatrix: string[][];
  gMatrix: string[][];
  bMatrix: string[][];
  targetBeforeRgb: { r: string; g: string; b: string };
  targetAfterRgb: { r: string; g: string; b: string };
  observationNote: string;
  conditionCountText: string;
}

export interface Experiment2Answer {
  selectedFormula: string;
  recordedS: string;
  recordedT: string;
  pixelACalculation: string;
  pixelBCalculation: string;
  otherPixelBeforeAfter: string;
  overflowHandlingNote: string;
  inquiryReflectionNote: string;
}

export interface Experiment3Answer {
  formulaText: string;
  selectedRectText: string;
  maskMatrix4x4: string[][];
  samplePixelCoord: string;
  samplePixelXRgb: string;
  samplePixelYRgb: string;
  samplePixelMaskP: string;
  samplePixelZRgb: string;
  formulaBlankX: string;
  formulaBlankY: string;
  sample2XRgb: string;
  sample2YRgb: string;
  sample2MaskP: string;
  sample2ZRgb: string;
}

export interface Experiment4Answer {
  recordedX: string;
  recordedK: string;
  recordedM: string;
  meanOutput3x3: string[][];
  meanCalcStep: string;
  edgeKernel3x3: string[][];
  edgeOutput3x3: string[][];
  edgeCalcStep: string;
}

export interface Experiment5Answer {
  initialDistA: string;
  initialDistB: string;
  initialDistC: string;
  predictedDigit: string;
  editedCoordsText: string;
  editCountText: string;
  finalDistB: string;
  relationExplanation: string;
}

export type AnyExperimentAnswer =
  | Experiment1Answer
  | Experiment2Answer
  | Experiment3Answer
  | Experiment4Answer
  | Experiment5Answer;

export interface ActivityRecord {
  id: string;
  timestampIso: string;
  experimentId: ExperimentTabId;
  experimentTitle: string;
  summary: string;
  parameters: Record<string, string | number>;
  resultImageDataUrl: string;
  studentAnswers: AnyExperimentAnswer;
  resultChecked?: boolean;
}

/* Performance Assessment Metadata & Student Isolation */
export interface AssessmentElementMeta {
  id: ExperimentTabId;
  order: number;
  title: string;
  elementName: string;
  points: number;
}

export interface AssessmentMeta {
  school: string;
  subject: string;
  title: string;
  totalPoints: number;
  reportFileSuffix: string;
  classroomNotice: string;
  elements: AssessmentElementMeta[];
}

export const ASSESSMENT_META: AssessmentMeta = {
  school: '오류고등학교',
  subject: '인공지능수학',
  title: '공학 도구를 활용한 이미지 데이터 변환 및 분석',
  totalPoints: 20,
  reportFileSuffix: '인공지능수학3차수행평가',
  classroomNotice:
    '실험을 완료한 뒤 전체 보고서를 PDF로 저장하고, Google Classroom 과제에 파일을 첨부하여 제출하세요.',
  elements: [
    {
      id: 'rgb-analysis',
      order: 1,
      title: '실험 1 — RGB 데이터 분석',
      elementName: '이미지 데이터의 표현 및 추출',
      points: 3,
    },
    {
      id: 'color-brightness',
      order: 2,
      title: '실험 2 — 색상·밝기 변환',
      elementName: '이미지 색상 변환 및 목표 이미지 제작',
      points: 5,
    },
    {
      id: 'image-composite',
      order: 3,
      title: '실험 3 — 이미지 합성',
      elementName: '행렬 연산을 이용한 이미지 합성',
      points: 4,
    },
    {
      id: 'convolution-filter',
      order: 4,
      title: '실험 4 — 합성곱 필터',
      elementName: '합성곱을 이용한 이미지 변환',
      points: 5,
    },
    {
      id: 'image-classification',
      order: 5,
      title: '실험 5 — 이미지 분류',
      elementName: '이미지 분류 및 결과 분석',
      points: 3,
    },
  ],
};

export interface StudentProfile {
  studentId: string;
  name: string;
}

export interface PixelRgbOverride {
  row: number;
  col: number;
  r: number;
  g: number;
  b: number;
}

export interface Exp1PersistedState {
  pixelOverrides: PixelRgbOverride[];
  activeCoord: PixelCoord;
  selectionSize: SelectionSize;
  channelView: ChannelViewMode;
}

export interface Exp2PersistedState {
  activeCoord: PixelCoord;
  selectionSize: SelectionSize;
  channelView: ChannelViewMode;
  transformMode: TransformMode;
  sValue: number;
  tValue: number;
}

export interface Exp3PersistedState {
  maskBounds: RectMaskBounds;
  inspectOrigin: PixelCoord;
  activeCoord: PixelCoord;
  channelView: ChannelViewMode;
}

export interface Exp4PersistedState {
  xValue: number;
  patchCenter: PixelCoord;
  filterType: ConvolutionFilterType;
  meanK: number;
  edgeM: number;
  outRow: number;
  outCol: number;
  displayMode: EdgeDisplayMode;
}

export interface Exp5PersistedState {
  xGrid: number[][];
  editLog: BinaryEditEntry[];
  hasVerifiedDistances: boolean;
}

export interface AllExperimentStates {
  activeTab: ExperimentTabId;
  exp1: Exp1PersistedState;
  exp2: Exp2PersistedState;
  exp3: Exp3PersistedState;
  exp4: Exp4PersistedState;
  exp5: Exp5PersistedState;
}

export interface AllExperimentAnswers {
  exp1: Experiment1Answer;
  exp2: Experiment2Answer;
  exp3: Experiment3Answer;
  exp4: Experiment4Answer;
  exp5: Experiment5Answer;
}

export interface ExperimentCheckStatus {
  resultChecked: boolean;
  checkedAtIso?: string;
  checkNote?: string;
}

export type ExperimentVerificationMap = Record<ExperimentTabId, ExperimentCheckStatus>;

export interface StudentWorkspaceData {
  schemaVersion: 2;
  student: StudentProfile;
  assessmentDate: string;
  updatedAtIso: string;
  experimentStates: AllExperimentStates;
  answers: AllExperimentAnswers;
  verificationStatus: ExperimentVerificationMap;
  activityLog: ActivityRecord[];
}

export interface SavedStudentSummary {
  studentKey: string;
  student: StudentProfile;
  updatedAtIso: string;
  checkedCount: number;
  recordCount: number;
}

export interface LabBackupPayload {
  schemaVersion: 2;
  exportedAtIso: string;
  assessmentMeta: {
    school: string;
    subject: string;
    title: string;
    totalPoints: number;
  };
  workspace: StudentWorkspaceData;
}

