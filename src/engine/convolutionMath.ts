import {
  CORRIDOR_HEIGHT,
  CORRIDOR_WIDTH,
} from '../data/corridorImage';
import {
  EXP4_EVAL_CENTER,
  EXP4_TARGET_EDGE_3X3,
  EXP4_TARGET_MEAN_3X3,
} from '../data/experimentAssets';
import {
  ConvolutionCellDetail,
  ConvolutionFilterType,
  ConvolutionTerm,
  EdgeDisplayMode,
  PixelCoord,
} from '../types/lab';
import { clampByte, clampCenterCoord } from './imageMath';

export interface KernelInfo {
  type: ConvolutionFilterType;
  name: string;
  shortName: string;
  formulaLabel: string;
  scaleText: string;
  denominator: number;
  numeratorMatrix: number[][];
  numericMatrix: number[][];
}

export interface Grayscale5x5Patch {
  center: PixelCoord;
  rows: number[];
  cols: number[];
  values: number[][];
}

export interface FullConvolutionStats {
  minRaw: number;
  maxRaw: number;
  negativePixelCount: number;
  over255PixelCount: number;
}

export interface FullConvolutionResult {
  rawValues: Float32Array;
  stats: FullConvolutionStats;
}

/**
 * coefficient: 'mean' 이면 K₁ = (k/9)·J 의 k, 'edge' 이면 K₂ = (m/3)·[[-1,0,1]×3] 의 m (모두 1~3 정수).
 */
export function getKernelInfo(
  filterType: ConvolutionFilterType,
  coefficient: number = 1,
): KernelInfo {
  const safeM = Math.max(1, Math.min(3, Math.round(coefficient)));
  if (filterType === 'mean') {
    const k = safeM;
    const numeratorMatrix = [
      [k, k, k],
      [k, k, k],
      [k, k, k],
    ];
    return {
      type: 'mean',
      name: `평균 필터 K₁ (k = ${k})`,
      shortName: `평균 K₁ (k=${k})`,
      formulaLabel: `K₁ = (${k}/9) × [[1,1,1],[1,1,1],[1,1,1]]`,
      scaleText: `${k}/9`,
      denominator: 9,
      numeratorMatrix,
      numericMatrix: numeratorMatrix.map((row) => row.map((v) => v / 9)),
    };
  }

  const numeratorMatrix = [
    [-safeM, 0, safeM],
    [-safeM, 0, safeM],
    [-safeM, 0, safeM],
  ];
  return {
    type: 'edge',
    name: `세로 경계 검출 필터 K₂ (m = ${safeM})`,
    shortName: `경계 K₂ (m=${safeM})`,
    formulaLabel: `K₂ = (${safeM}/3) × [[-1,0,1],[-1,0,1],[-1,0,1]]`,
    scaleText: `${safeM}/3`,
    denominator: 3,
    numeratorMatrix,
    numericMatrix: numeratorMatrix.map((row) => row.map((v) => v / 3)),
  };
}

export function readGrayscalePixel(
  gray: Uint8Array,
  row1: number,
  col1: number,
  width: number = CORRIDOR_WIDTH,
  height: number = CORRIDOR_HEIGHT,
): number {
  const r = Math.max(1, Math.min(height, Math.round(row1)));
  const c = Math.max(1, Math.min(width, Math.round(col1)));
  return gray[(r - 1) * width + (c - 1)];
}

/**
 * Updates only the target center pixel x at EXP4_EVAL_CENTER without mutating input array.
 */
export function setGrayscaleCenterXImmutable(
  gray: Uint8Array,
  newX: number,
  center: PixelCoord = EXP4_EVAL_CENTER,
  width: number = CORRIDOR_WIDTH,
  height: number = CORRIDOR_HEIGHT,
): Uint8Array {
  const r = Math.max(1, Math.min(height, Math.round(center.row)));
  const c = Math.max(1, Math.min(width, Math.round(center.col)));
  const next = new Uint8Array(gray);
  next[(r - 1) * width + (c - 1)] = clampByte(newX);
  return next;
}

export function extract5x5GrayscalePatch(
  gray: Uint8Array,
  centerRow1: number,
  centerCol1: number,
  width: number = CORRIDOR_WIDTH,
  height: number = CORRIDOR_HEIGHT,
): Grayscale5x5Patch {
  const safeCenter = clampCenterCoord(centerRow1, centerCol1, 5, width, height);
  const rows: number[] = [];
  const cols: number[] = [];
  for (let offset = -2; offset <= 2; offset += 1) {
    rows.push(safeCenter.row + offset);
    cols.push(safeCenter.col + offset);
  }

  const values: number[][] = rows.map((r) =>
    cols.map((c) => readGrayscalePixel(gray, r, c, width, height)),
  );

  return {
    center: safeCenter,
    rows,
    cols,
    values,
  };
}

/**
 * Computes valid 3x3 cross-correlation (NO kernel flip, step=1, NO padding) on a 5x5 patch.
 * Preserves exact signed numbers (including negatives and values > 255).
 */
export function computeValid3x3Convolution(
  patch: Grayscale5x5Patch,
  filterType: ConvolutionFilterType,
  edgeM: number = 1,
): {
  kernel: KernelInfo;
  outputMatrix: number[][];
  roundedMatrix: number[][];
  details: ConvolutionCellDetail[][];
} {
  const kernel = getKernelInfo(filterType, edgeM);
  const outputMatrix: number[][] = [];
  const roundedMatrix: number[][] = [];
  const details: ConvolutionCellDetail[][] = [];

  for (let outRow = 0; outRow < 3; outRow += 1) {
    const outRowVals: number[] = [];
    const roundedRowVals: number[] = [];
    const detailRow: ConvolutionCellDetail[] = [];

    for (let outCol = 0; outCol < 3; outCol += 1) {
      const terms: ConvolutionTerm[] = [];
      let numeratorSum = 0;

      for (let kr = 0; kr < 3; kr += 1) {
        for (let kc = 0; kc < 3; kc += 1) {
          const imgVal = patch.values[outRow + kr][outCol + kc];
          const kNum = kernel.numeratorMatrix[kr][kc];
          const kVal = kernel.numericMatrix[kr][kc];
          const product = (imgVal * kNum) / kernel.denominator;
          numeratorSum += imgVal * kNum;

          terms.push({
            kernelRow: kr + 1,
            kernelCol: kc + 1,
            imageRow: patch.rows[outRow + kr],
            imageCol: patch.cols[outCol + kc],
            imageValue: imgVal,
            kernelCoefficientNumerator: kNum,
            kernelDenominator: kernel.denominator,
            kernelValue: kVal,
            product,
          });
        }
      }

      const rawSum = numeratorSum / kernel.denominator;
      const cleanRaw =
        Math.abs(rawSum - Math.round(rawSum)) < 1e-9
          ? Math.round(rawSum)
          : Number(rawSum.toFixed(2));
      const roundedValue = Math.round(rawSum);

      outRowVals.push(cleanRaw);
      roundedRowVals.push(roundedValue);
      detailRow.push({
        outRow: outRow + 1,
        outCol: outCol + 1,
        terms,
        rawSum: cleanRaw,
        roundedValue,
      });
    }

    outputMatrix.push(outRowVals);
    roundedMatrix.push(roundedRowVals);
    details.push(detailRow);
  }

  return {
    kernel,
    outputMatrix,
    roundedMatrix,
    details,
  };
}

/**
 * Applies full 128x128 2D cross-correlation (NO kernel flip) with replicate edge boundary
 * so output preserves exact 128x128 geometry and raw float values (negative & >255 intact).
 */
export function applyConvolutionToFullGrayscaleImage(
  gray: Uint8Array,
  filterType: ConvolutionFilterType,
  edgeM: number = 1,
  width: number = CORRIDOR_WIDTH,
  height: number = CORRIDOR_HEIGHT,
): FullConvolutionResult {
  const kernel = getKernelInfo(filterType, edgeM);
  const rawValues = new Float32Array(width * height);

  let minRaw = Infinity;
  let maxRaw = -Infinity;
  let negativePixelCount = 0;
  let over255PixelCount = 0;

  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      let numeratorSum = 0;
      for (let kr = 0; kr < 3; kr += 1) {
        const sr = Math.max(0, Math.min(height - 1, row + kr - 1));
        for (let kc = 0; kc < 3; kc += 1) {
          const sc = Math.max(0, Math.min(width - 1, col + kc - 1));
          const pixelVal = gray[sr * width + sc];
          numeratorSum += pixelVal * kernel.numeratorMatrix[kr][kc];
        }
      }

      const val = numeratorSum / kernel.denominator;
      const idx = row * width + col;
      rawValues[idx] = val;

      if (val < minRaw) minRaw = val;
      if (val > maxRaw) maxRaw = val;
      if (val < -1e-6) negativePixelCount += 1;
      if (val > 255 + 1e-6) over255PixelCount += 1;
    }
  }

  return {
    rawValues,
    stats: {
      minRaw: Number(minRaw.toFixed(1)),
      maxRaw: Number(maxRaw.toFixed(1)),
      negativePixelCount,
      over255PixelCount,
    },
  };
}

export function grayscaleToRgbaPixels(
  gray: Uint8Array,
  width: number = CORRIDOR_WIDTH,
  height: number = CORRIDOR_HEIGHT,
): Uint8ClampedArray {
  const totalPixels = width * height;
  const rgba = new Uint8ClampedArray(totalPixels * 4);
  for (let i = 0; i < totalPixels; i += 1) {
    const v = gray[i];
    const idx = i * 4;
    rgba[idx] = v;
    rgba[idx + 1] = v;
    rgba[idx + 2] = v;
    rgba[idx + 3] = 255;
  }
  return rgba;
}

export function convolutionRawToRgbaPixels(
  rawValues: Float32Array,
  displayMode: EdgeDisplayMode,
  width: number = CORRIDOR_WIDTH,
  height: number = CORRIDOR_HEIGHT,
): Uint8ClampedArray {
  const totalPixels = width * height;
  const rgba = new Uint8ClampedArray(totalPixels * 4);
  for (let i = 0; i < totalPixels; i += 1) {
    const raw = rawValues[i];
    const v =
      displayMode === 'abs'
        ? clampByte(Math.round(Math.abs(raw)))
        : clampByte(Math.round(raw));
    const idx = i * 4;
    rgba[idx] = v;
    rgba[idx + 1] = v;
    rgba[idx + 2] = v;
    rgba[idx + 3] = 255;
  }
  return rgba;
}

function matricesEqualExact(actual: number[][], expected: number[][]): boolean {
  if (actual.length !== expected.length) return false;
  for (let r = 0; r < expected.length; r += 1) {
    if (actual[r].length !== expected[r].length) return false;
    for (let c = 0; c < expected[r].length; c += 1) {
      if (Math.abs(actual[r][c] - expected[r][c]) > 1e-6) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Evaluates Experiment A (mean filter) and Experiment B (edge filter) on the fixed (50, 42) 5x5 patch
 * without leaking the target answers (x=110, k=1, m=2).
 */
export function checkExp4Targets(
  gray: Uint8Array,
  edgeM: number,
  meanK: number,
  width: number = CORRIDOR_WIDTH,
  height: number = CORRIDOR_HEIGHT,
): {
  meanMet: boolean;
  edgeMet: boolean;
  allMet: boolean;
  meanMatrix: number[][];
  edgeMatrix: number[][];
} {
  const evalPatch = extract5x5GrayscalePatch(
    gray,
    EXP4_EVAL_CENTER.row,
    EXP4_EVAL_CENTER.col,
    width,
    height,
  );
  const meanRes = computeValid3x3Convolution(evalPatch, 'mean', meanK);
  const edgeRes = computeValid3x3Convolution(evalPatch, 'edge', edgeM);

  const meanMet = matricesEqualExact(meanRes.outputMatrix, EXP4_TARGET_MEAN_3X3);
  const edgeMet = matricesEqualExact(edgeRes.outputMatrix, EXP4_TARGET_EDGE_3X3);

  return {
    meanMet,
    edgeMet,
    allMet: meanMet && edgeMet,
    meanMatrix: meanRes.outputMatrix,
    edgeMatrix: edgeRes.outputMatrix,
  };
}
