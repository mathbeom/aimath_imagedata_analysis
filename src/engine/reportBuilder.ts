import {
  ASSESSMENT_META,
  AssessmentElementMeta,
  BinaryEditEntry,
  ChannelMatrices,
  EdgeDisplayMode,
  Experiment1Answer,
  Experiment2Answer,
  Experiment3Answer,
  Experiment4Answer,
  Experiment5Answer,
  ExperimentCheckStatus,
  PixelCoord,
  RectMaskBounds,
  RgbPixel,
  SelectionSize,
  StudentProfile,
  StudentWorkspaceData,
  TargetPixelStatus,
  TransformStats,
} from '../types/lab';
import {
  CORRIDOR_HEIGHT,
  CORRIDOR_ORIGINAL_PIXELS,
  CORRIDOR_WIDTH,
  EXP2_ANCHOR_C,
  EXP2_EXPECTED_C,
} from '../data/corridorImage';
import {
  BINARY_REF_A,
  BINARY_REF_B,
  BINARY_REF_C,
  COMPOSITE_BG_Y_PIXELS,
  CORRIDOR_GRAYSCALE_ORIGINAL,
  EXP3_SIGN_RECT,
  EXP4_EVAL_CENTER,
  createInitialBinaryX,
} from '../data/experimentAssets';
import {
  applyAffineTransform,
  checkExperiment2Targets,
  clampCenterCoord,
  computePixelTransformDetail,
  countModifiedPixels,
  extractChannelMatrices,
  formatFormulaText,
  getEffectiveParams,
  readPixel,
} from './imageMath';
import {
  applyHadamardComposite,
  buildRectMask,
  clamp4x4Origin,
  clampRectBounds,
  extract4x4CompositeData,
} from './compositeMath';
import {
  KernelInfo,
  applyConvolutionToFullGrayscaleImage,
  computeValid3x3Convolution,
  convolutionRawToRgbaPixels,
  extract5x5GrayscalePatch,
  setGrayscaleCenterXImmutable,
} from './convolutionMath';
import {
  ClassificationResult,
  HammingDistances,
  classifyByHammingDistance,
  computeAllDistances,
  formatCoordList,
} from './hammingMath';
import {
  applyPixelOverrides,
  renderBinaryGridToPngDataUrl,
  renderBinaryMaskToPngDataUrl,
  renderGrayscaleToPngDataUrl,
  renderPixelsToPngDataUrl,
} from '../utils/storage';

export interface ReportImageRenderer {
  renderRgb: (pixels: Uint8ClampedArray, w?: number, h?: number) => string;
  renderGray: (gray: Uint8Array, w?: number, h?: number) => string;
  renderMask: (mask: Uint8Array, w?: number, h?: number) => string;
  renderBinary: (grid: number[][], cellPx?: number) => string;
}

const DEFAULT_RENDERER: ReportImageRenderer = {
  renderRgb: (pixels, w = CORRIDOR_WIDTH, h = CORRIDOR_HEIGHT) =>
    renderPixelsToPngDataUrl(pixels, w, h),
  renderGray: (gray, w = CORRIDOR_WIDTH, h = CORRIDOR_HEIGHT) =>
    renderGrayscaleToPngDataUrl(gray, w, h),
  renderMask: (mask, w = CORRIDOR_WIDTH, h = CORRIDOR_HEIGHT) =>
    renderBinaryMaskToPngDataUrl(mask, w, h),
  renderBinary: (grid, cellPx = 16) => renderBinaryGridToPngDataUrl(grid, cellPx),
};

export interface Exp1ReportSection {
  meta: AssessmentElementMeta;
  origImageUrl: string;
  workingImageUrl: string;
  activeCoord: PixelCoord;
  regionCenter: PixelCoord;
  selectionSize: SelectionSize;
  origPixel: RgbPixel;
  currPixel: RgbPixel;
  modifiedCount: number;
  originalMatrices: ChannelMatrices;
  workingMatrices: ChannelMatrices;
  answer: Experiment1Answer;
  verification: ExperimentCheckStatus;
  savedRecordCount: number;
}

export interface Exp2ReportSection {
  meta: AssessmentElementMeta;
  origImageUrl: string;
  transformedImageUrl: string;
  formula: string;
  effectiveS: number;
  effectiveT: number;
  stats: TransformStats;
  pixelA: TargetPixelStatus;
  pixelB: TargetPixelStatus;
  pixelCCoord: PixelCoord;
  pixelCBefore: RgbPixel;
  pixelCAfter: RgbPixel;
  activeCoord: PixelCoord;
  regionCenter: PixelCoord;
  selectionSize: SelectionSize;
  beforeMatrices: ChannelMatrices;
  afterMatrices: ChannelMatrices;
  answer: Experiment2Answer;
  verification: ExperimentCheckStatus;
  savedRecordCount: number;
}

export interface Exp3ReportSection {
  meta: AssessmentElementMeta;
  xImageUrl: string;
  yImageUrl: string;
  maskImageUrl: string;
  zImageUrl: string;
  maskBounds: RectMaskBounds;
  inspectOrigin: PixelCoord;
  targetMet: boolean;
  keptFromXPixels: number;
  replacedWithYPixels: number;
  totalPixels: number;
  pMatrix4x4: number[][];
  inspectRows: number[];
  inspectCols: number[];
  answer: Experiment3Answer;
  verification: ExperimentCheckStatus;
  savedRecordCount: number;
}

export interface Exp4ReportSection {
  meta: AssessmentElementMeta;
  grayOrigImageUrl: string;
  meanImageUrl: string;
  edgeImageUrl: string;
  xValue: number;
  meanK: number;
  edgeM: number;
  patchCenter: PixelCoord;
  displayMode: EdgeDisplayMode;
  patch5x5Rows: number[];
  patch5x5Cols: number[];
  patch5x5Values: number[][];
  meanKernel: KernelInfo;
  edgeKernel: KernelInfo;
  meanOutput3x3: number[][];
  edgeOutput3x3: number[][];
  answer: Experiment4Answer;
  verification: ExperimentCheckStatus;
  savedRecordCount: number;
}

export interface Exp5ReportSection {
  meta: AssessmentElementMeta;
  refAImageUrl: string;
  refBImageUrl: string;
  refCImageUrl: string;
  xInitialImageUrl: string;
  xCurrentImageUrl: string;
  xGrid: number[][];
  editLog: BinaryEditEntry[];
  editedCoordsSummary: string;
  initialDistances: HammingDistances;
  currentDistances: HammingDistances;
  initialClassification: ClassificationResult;
  currentClassification: ClassificationResult;
  answer: Experiment5Answer;
  verification: ExperimentCheckStatus;
  savedRecordCount: number;
}

export interface FullAssessmentReportSnapshot {
  generatedAtIso: string;
  assessmentMeta: typeof ASSESSMENT_META;
  student: StudentProfile;
  assessmentDate: string;
  checkedExperimentCount: number;
  totalRecordCount: number;
  exp1: Exp1ReportSection;
  exp2: Exp2ReportSection;
  exp3: Exp3ReportSection;
  exp4: Exp4ReportSection;
  exp5: Exp5ReportSection;
}

export function buildReportSnapshot(
  workspace: StudentWorkspaceData,
  renderer: ReportImageRenderer = DEFAULT_RENDERER,
): FullAssessmentReportSnapshot {
  const { experimentStates, answers, verificationStatus, activityLog } = workspace;

  const countRecordsFor = (tabId: AssessmentElementMeta['id']) =>
    activityLog.filter((r) => r.experimentId === tabId).length;

  // --- Experiment 1 ---
  const exp1State = experimentStates.exp1;
  const exp1WorkingPixels = applyPixelOverrides(
    CORRIDOR_ORIGINAL_PIXELS,
    exp1State.pixelOverrides,
  );
  const exp1Center = clampCenterCoord(
    exp1State.activeCoord.row,
    exp1State.activeCoord.col,
    exp1State.selectionSize,
  );
  const exp1OrigMatrices = extractChannelMatrices(
    CORRIDOR_ORIGINAL_PIXELS,
    exp1Center.row,
    exp1Center.col,
    exp1State.selectionSize,
  );
  const exp1WorkMatrices = extractChannelMatrices(
    exp1WorkingPixels,
    exp1Center.row,
    exp1Center.col,
    exp1State.selectionSize,
  );

  // --- Experiment 2 ---
  const exp2State = experimentStates.exp2;
  const { effectiveS, effectiveT } = getEffectiveParams(
    exp2State.transformMode,
    exp2State.sValue,
    exp2State.tValue,
  );
  const exp2Formula = formatFormulaText(exp2State.transformMode, effectiveS, effectiveT);
  const exp2Computed = applyAffineTransform(
    CORRIDOR_ORIGINAL_PIXELS,
    exp2State.transformMode,
    exp2State.sValue,
    exp2State.tValue,
  );
  const exp2Targets = checkExperiment2Targets(
    CORRIDOR_ORIGINAL_PIXELS,
    exp2State.transformMode,
    exp2State.sValue,
    exp2State.tValue,
  );
  const exp2DetailC = computePixelTransformDetail(
    EXP2_EXPECTED_C,
    exp2State.transformMode,
    exp2State.sValue,
    exp2State.tValue,
  );
  const exp2Center = clampCenterCoord(
    exp2State.activeCoord.row,
    exp2State.activeCoord.col,
    exp2State.selectionSize,
  );
  const exp2BeforeMatrices = extractChannelMatrices(
    CORRIDOR_ORIGINAL_PIXELS,
    exp2Center.row,
    exp2Center.col,
    exp2State.selectionSize,
  );
  const exp2AfterMatrices = extractChannelMatrices(
    exp2Computed.pixels,
    exp2Center.row,
    exp2Center.col,
    exp2State.selectionSize,
  );

  // --- Experiment 3 ---
  const exp3State = experimentStates.exp3;
  const exp3Bounds = clampRectBounds(exp3State.maskBounds);
  const exp3Origin = clamp4x4Origin(exp3State.inspectOrigin);
  const exp3Mask = buildRectMask(exp3Bounds);
  const exp3Composite = applyHadamardComposite(
    CORRIDOR_ORIGINAL_PIXELS,
    COMPOSITE_BG_Y_PIXELS,
    exp3Mask,
  );
  const exp3Inspection = extract4x4CompositeData(
    CORRIDOR_ORIGINAL_PIXELS,
    COMPOSITE_BG_Y_PIXELS,
    exp3Mask,
    exp3Composite.pixels,
    exp3Origin,
  );

  // --- Experiment 4 ---
  const exp4State = experimentStates.exp4;
  const exp4Grayscale = setGrayscaleCenterXImmutable(
    CORRIDOR_GRAYSCALE_ORIGINAL,
    exp4State.xValue,
    EXP4_EVAL_CENTER,
  );
  const exp4Patch = extract5x5GrayscalePatch(
    exp4Grayscale,
    exp4State.patchCenter.row,
    exp4State.patchCenter.col,
  );
  const exp4MeanConv = computeValid3x3Convolution(exp4Patch, 'mean', exp4State.meanK);
  const exp4EdgeConv = computeValid3x3Convolution(exp4Patch, 'edge', exp4State.edgeM);
  const exp4MeanFull = applyConvolutionToFullGrayscaleImage(
    exp4Grayscale,
    'mean',
    exp4State.meanK,
  );
  const exp4EdgeFull = applyConvolutionToFullGrayscaleImage(
    exp4Grayscale,
    'edge',
    exp4State.edgeM,
  );
  const exp4MeanRgba = convolutionRawToRgbaPixels(exp4MeanFull.rawValues, 'clamp');
  const exp4EdgeRgba = convolutionRawToRgbaPixels(
    exp4EdgeFull.rawValues,
    exp4State.displayMode,
  );

  // --- Experiment 5 ---
  const exp5State = experimentStates.exp5;
  const xInitialGrid = createInitialBinaryX();
  const initialDistances = computeAllDistances(xInitialGrid);
  const currentDistances = computeAllDistances(exp5State.xGrid);
  const initialClassification = classifyByHammingDistance(xInitialGrid);
  const currentClassification = classifyByHammingDistance(exp5State.xGrid);

  const origImageDataUrl = renderer.renderRgb(CORRIDOR_ORIGINAL_PIXELS);

  const checkedExperimentCount = Object.values(verificationStatus).filter(
    (v) => v.resultChecked,
  ).length;

  return {
    generatedAtIso: new Date().toISOString(),
    assessmentMeta: ASSESSMENT_META,
    student: { ...workspace.student },
    assessmentDate: workspace.assessmentDate,
    checkedExperimentCount,
    totalRecordCount: activityLog.length,
    exp1: {
      meta: ASSESSMENT_META.elements[0],
      origImageUrl: origImageDataUrl,
      workingImageUrl: renderer.renderRgb(exp1WorkingPixels),
      activeCoord: exp1State.activeCoord,
      regionCenter: exp1Center,
      selectionSize: exp1State.selectionSize,
      origPixel: readPixel(
        CORRIDOR_ORIGINAL_PIXELS,
        exp1State.activeCoord.row,
        exp1State.activeCoord.col,
      ),
      currPixel: readPixel(
        exp1WorkingPixels,
        exp1State.activeCoord.row,
        exp1State.activeCoord.col,
      ),
      modifiedCount: countModifiedPixels(CORRIDOR_ORIGINAL_PIXELS, exp1WorkingPixels),
      originalMatrices: exp1OrigMatrices,
      workingMatrices: exp1WorkMatrices,
      answer: answers.exp1,
      verification: verificationStatus['rgb-analysis'],
      savedRecordCount: countRecordsFor('rgb-analysis'),
    },
    exp2: {
      meta: ASSESSMENT_META.elements[1],
      origImageUrl: origImageDataUrl,
      transformedImageUrl: renderer.renderRgb(exp2Computed.pixels),
      formula: exp2Formula,
      effectiveS,
      effectiveT,
      stats: exp2Computed.stats,
      pixelA: exp2Targets.pixelA,
      pixelB: exp2Targets.pixelB,
      pixelCCoord: EXP2_ANCHOR_C,
      pixelCBefore: EXP2_EXPECTED_C,
      pixelCAfter: {
        r: exp2DetailC.r.clamped,
        g: exp2DetailC.g.clamped,
        b: exp2DetailC.b.clamped,
      },
      activeCoord: exp2State.activeCoord,
      regionCenter: exp2Center,
      selectionSize: exp2State.selectionSize,
      beforeMatrices: exp2BeforeMatrices,
      afterMatrices: exp2AfterMatrices,
      answer: answers.exp2,
      verification: verificationStatus['color-brightness'],
      savedRecordCount: countRecordsFor('color-brightness'),
    },
    exp3: {
      meta: ASSESSMENT_META.elements[2],
      xImageUrl: origImageDataUrl,
      yImageUrl: renderer.renderRgb(COMPOSITE_BG_Y_PIXELS),
      maskImageUrl: renderer.renderMask(exp3Mask),
      zImageUrl: renderer.renderRgb(exp3Composite.pixels),
      maskBounds: exp3Bounds,
      inspectOrigin: exp3Origin,
      targetMet:
        experimentStates.exp3.maskBounds.rowStart === EXP3_SIGN_RECT.rowStart &&
        experimentStates.exp3.maskBounds.rowEnd === EXP3_SIGN_RECT.rowEnd &&
        experimentStates.exp3.maskBounds.colStart === EXP3_SIGN_RECT.colStart &&
        experimentStates.exp3.maskBounds.colEnd === EXP3_SIGN_RECT.colEnd,
      keptFromXPixels: exp3Composite.stats.keptFromXPixels,
      replacedWithYPixels: exp3Composite.stats.replacedWithYPixels,
      totalPixels: exp3Composite.stats.totalPixels,
      pMatrix4x4: exp3Inspection.pMatrix,
      inspectRows: exp3Inspection.rows,
      inspectCols: exp3Inspection.cols,
      answer: answers.exp3,
      verification: verificationStatus['image-composite'],
      savedRecordCount: countRecordsFor('image-composite'),
    },
    exp4: {
      meta: ASSESSMENT_META.elements[3],
      grayOrigImageUrl: renderer.renderGray(exp4Grayscale),
      meanImageUrl: renderer.renderRgb(exp4MeanRgba),
      edgeImageUrl: renderer.renderRgb(exp4EdgeRgba),
      xValue: exp4State.xValue,
      meanK: exp4State.meanK,
      edgeM: exp4State.edgeM,
      patchCenter: exp4Patch.center,
      displayMode: exp4State.displayMode,
      patch5x5Rows: exp4Patch.rows,
      patch5x5Cols: exp4Patch.cols,
      patch5x5Values: exp4Patch.values,
      meanKernel: exp4MeanConv.kernel,
      edgeKernel: exp4EdgeConv.kernel,
      meanOutput3x3: exp4MeanConv.outputMatrix,
      edgeOutput3x3: exp4EdgeConv.outputMatrix,
      answer: answers.exp4,
      verification: verificationStatus['convolution-filter'],
      savedRecordCount: countRecordsFor('convolution-filter'),
    },
    exp5: {
      meta: ASSESSMENT_META.elements[4],
      refAImageUrl: renderer.renderBinary(BINARY_REF_A),
      refBImageUrl: renderer.renderBinary(BINARY_REF_B),
      refCImageUrl: renderer.renderBinary(BINARY_REF_C),
      xInitialImageUrl: renderer.renderBinary(xInitialGrid),
      xCurrentImageUrl: renderer.renderBinary(exp5State.xGrid),
      xGrid: exp5State.xGrid,
      editLog: exp5State.editLog,
      editedCoordsSummary: formatCoordList(exp5State.editLog),
      initialDistances,
      currentDistances,
      initialClassification,
      currentClassification,
      answer: answers.exp5,
      verification: verificationStatus['image-classification'],
      savedRecordCount: countRecordsFor('image-classification'),
    },
  };
}
