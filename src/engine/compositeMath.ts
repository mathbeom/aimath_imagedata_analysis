import {
  CORRIDOR_HEIGHT,
  CORRIDOR_WIDTH,
} from '../data/corridorImage';
import {
  ChannelMatrices,
  CompositeStats,
  PixelCoord,
  RectMaskBounds,
  RgbPixel,
} from '../types/lab';
import { readPixel } from './imageMath';

export interface Composite4x4Cell {
  row: number;
  col: number;
  p: 0 | 1;
  x: RgbPixel;
  y: RgbPixel;
  z: RgbPixel;
}

export interface Composite4x4Inspection {
  origin: PixelCoord;
  rows: number[];
  cols: number[];
  pMatrix: number[][];
  xMatrices: ChannelMatrices;
  yMatrices: ChannelMatrices;
  zMatrices: ChannelMatrices;
  cells: Composite4x4Cell[][];
}

export function clampRectBounds(
  bounds: RectMaskBounds,
  width: number = CORRIDOR_WIDTH,
  height: number = CORRIDOR_HEIGHT,
): RectMaskBounds {
  const r1 = Math.max(1, Math.min(height, Math.round(bounds.rowStart)));
  const r2 = Math.max(1, Math.min(height, Math.round(bounds.rowEnd)));
  const c1 = Math.max(1, Math.min(width, Math.round(bounds.colStart)));
  const c2 = Math.max(1, Math.min(width, Math.round(bounds.colEnd)));

  return {
    rowStart: Math.min(r1, r2),
    rowEnd: Math.max(r1, r2),
    colStart: Math.min(c1, c2),
    colEnd: Math.max(c1, c2),
  };
}

export function buildRectMask(
  bounds: RectMaskBounds,
  width: number = CORRIDOR_WIDTH,
  height: number = CORRIDOR_HEIGHT,
): Uint8Array {
  const safe = clampRectBounds(bounds, width, height);
  const mask = new Uint8Array(width * height);

  for (let row = safe.rowStart; row <= safe.rowEnd; row += 1) {
    const rowOffset = (row - 1) * width;
    for (let col = safe.colStart; col <= safe.colEnd; col += 1) {
      mask[rowOffset + (col - 1)] = 1;
    }
  }

  return mask;
}

export function readMaskValue(
  mask: Uint8Array,
  row1: number,
  col1: number,
  width: number = CORRIDOR_WIDTH,
  height: number = CORRIDOR_HEIGHT,
): 0 | 1 {
  const r = Math.max(1, Math.min(height, Math.round(row1)));
  const c = Math.max(1, Math.min(width, Math.round(col1)));
  return mask[(r - 1) * width + (c - 1)] === 1 ? 1 : 0;
}

/**
 * Applies Z = X ⊙ P + Y ⊙ (J - P) independently across R, G, and B channels.
 */
export function applyHadamardComposite(
  xPixels: Uint8ClampedArray,
  yPixels: Uint8ClampedArray,
  mask: Uint8Array,
  width: number = CORRIDOR_WIDTH,
  height: number = CORRIDOR_HEIGHT,
): { pixels: Uint8ClampedArray; stats: CompositeStats } {
  const totalPixels = width * height;
  const out = new Uint8ClampedArray(totalPixels * 4);

  let keptFromXPixels = 0;
  let replacedWithYPixels = 0;

  for (let pIdx = 0; pIdx < totalPixels; pIdx += 1) {
    const p = mask[pIdx] === 1 ? 1 : 0;
    const invP = 1 - p;
    const rgbaIdx = pIdx * 4;

    out[rgbaIdx] = xPixels[rgbaIdx] * p + yPixels[rgbaIdx] * invP;
    out[rgbaIdx + 1] = xPixels[rgbaIdx + 1] * p + yPixels[rgbaIdx + 1] * invP;
    out[rgbaIdx + 2] = xPixels[rgbaIdx + 2] * p + yPixels[rgbaIdx + 2] * invP;
    out[rgbaIdx + 3] = 255;

    if (p === 1) {
      keptFromXPixels += 1;
    } else {
      replacedWithYPixels += 1;
    }
  }

  return {
    pixels: out,
    stats: {
      totalPixels,
      keptFromXPixels,
      replacedWithYPixels,
    },
  };
}

export function clamp4x4Origin(
  origin: PixelCoord,
  width: number = CORRIDOR_WIDTH,
  height: number = CORRIDOR_HEIGHT,
): PixelCoord {
  return {
    row: Math.max(1, Math.min(height - 3, Math.round(origin.row))),
    col: Math.max(1, Math.min(width - 3, Math.round(origin.col))),
  };
}

export function extract4x4CompositeData(
  xPixels: Uint8ClampedArray,
  yPixels: Uint8ClampedArray,
  mask: Uint8Array,
  zPixels: Uint8ClampedArray,
  origin: PixelCoord,
  width: number = CORRIDOR_WIDTH,
  height: number = CORRIDOR_HEIGHT,
): Composite4x4Inspection {
  const safeOrigin = clamp4x4Origin(origin, width, height);
  const rows = [
    safeOrigin.row,
    safeOrigin.row + 1,
    safeOrigin.row + 2,
    safeOrigin.row + 3,
  ];
  const cols = [
    safeOrigin.col,
    safeOrigin.col + 1,
    safeOrigin.col + 2,
    safeOrigin.col + 3,
  ];

  const pMatrix: number[][] = [];
  const xR: number[][] = [];
  const xG: number[][] = [];
  const xB: number[][] = [];
  const yR: number[][] = [];
  const yG: number[][] = [];
  const yB: number[][] = [];
  const zR: number[][] = [];
  const zG: number[][] = [];
  const zB: number[][] = [];
  const cells: Composite4x4Cell[][] = [];

  for (const row of rows) {
    const pRow: number[] = [];
    const xRRow: number[] = [];
    const xGRow: number[] = [];
    const xBRow: number[] = [];
    const yRRow: number[] = [];
    const yGRow: number[] = [];
    const yBRow: number[] = [];
    const zRRow: number[] = [];
    const zGRow: number[] = [];
    const zBRow: number[] = [];
    const cellRow: Composite4x4Cell[] = [];

    for (const col of cols) {
      const p = readMaskValue(mask, row, col, width, height);
      const x = readPixel(xPixels, row, col, width, height);
      const y = readPixel(yPixels, row, col, width, height);
      const z = readPixel(zPixels, row, col, width, height);

      pRow.push(p);
      xRRow.push(x.r);
      xGRow.push(x.g);
      xBRow.push(x.b);
      yRRow.push(y.r);
      yGRow.push(y.g);
      yBRow.push(y.b);
      zRRow.push(z.r);
      zGRow.push(z.g);
      zBRow.push(z.b);
      cellRow.push({ row, col, p, x, y, z });
    }

    pMatrix.push(pRow);
    xR.push(xRRow);
    xG.push(xGRow);
    xB.push(xBRow);
    yR.push(yRRow);
    yG.push(yGRow);
    yB.push(yBRow);
    zR.push(zRRow);
    zG.push(zGRow);
    zB.push(zBRow);
    cells.push(cellRow);
  }

  return {
    origin: safeOrigin,
    rows,
    cols,
    pMatrix,
    xMatrices: { rows, cols, r: xR, g: xG, b: xB },
    yMatrices: { rows, cols, r: yR, g: yG, b: yB },
    zMatrices: { rows, cols, r: zR, g: zG, b: zB },
    cells,
  };
}

export function maskToPreviewRgbaPixels(
  mask: Uint8Array,
  width: number = CORRIDOR_WIDTH,
  height: number = CORRIDOR_HEIGHT,
): Uint8ClampedArray {
  const totalPixels = width * height;
  const rgba = new Uint8ClampedArray(totalPixels * 4);
  for (let i = 0; i < totalPixels; i += 1) {
    const val = mask[i] === 1 ? 255 : 0;
    const idx = i * 4;
    rgba[idx] = val;
    rgba[idx + 1] = val;
    rgba[idx + 2] = val;
    rgba[idx + 3] = 255;
  }
  return rgba;
}
