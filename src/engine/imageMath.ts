import {
  ChannelMatrices,
  ChannelTransformDetail,
  PixelCoord,
  PixelTransformDetail,
  RgbPixel,
  SelectionSize,
  TargetPixelStatus,
  TransformMode,
  TransformStats,
} from '../types/lab';
import {
  CORRIDOR_HEIGHT,
  CORRIDOR_WIDTH,
  EXP2_ANCHOR_A,
  EXP2_ANCHOR_B,
  EXP2_EXPECTED_A,
  EXP2_EXPECTED_B,
  EXP2_TARGET_A,
  EXP2_TARGET_B,
} from '../data/corridorImage';

export function clampByte(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 255) return 255;
  return Math.round(value);
}

export function roundAndClampChannel(raw: number): {
  rounded: number;
  clamped: number;
  wasRounded: boolean;
  clampState: 'none' | 'low' | 'high';
} {
  const roundedRaw = Math.round(raw);
  const rounded = roundedRaw === 0 ? 0 : roundedRaw;
  const wasRounded = Math.abs(raw - rounded) > 1e-9;

  if (rounded < 0) {
    return { rounded, clamped: 0, wasRounded, clampState: 'low' };
  }
  if (rounded > 255) {
    return { rounded, clamped: 255, wasRounded, clampState: 'high' };
  }
  return { rounded, clamped: rounded, wasRounded, clampState: 'none' };
}

export function getPixelByteOffset(row1: number, col1: number, width: number = CORRIDOR_WIDTH): number {
  return ((row1 - 1) * width + (col1 - 1)) * 4;
}

export function clampCoord(
  row1: number,
  col1: number,
  width: number = CORRIDOR_WIDTH,
  height: number = CORRIDOR_HEIGHT,
): PixelCoord {
  return {
    row: Math.max(1, Math.min(height, Math.round(row1))),
    col: Math.max(1, Math.min(width, Math.round(col1))),
  };
}

/**
 * Ensures a 3x3 or 5x5 selection center keeps the entire neighborhood inside 1..width, 1..height.
 */
export function clampCenterCoord(
  row1: number,
  col1: number,
  size: SelectionSize,
  width: number = CORRIDOR_WIDTH,
  height: number = CORRIDOR_HEIGHT,
): PixelCoord {
  const radius = Math.floor(size / 2);
  return {
    row: Math.max(1 + radius, Math.min(height - radius, Math.round(row1))),
    col: Math.max(1 + radius, Math.min(width - radius, Math.round(col1))),
  };
}

export function readPixel(
  pixels: Uint8ClampedArray,
  row1: number,
  col1: number,
  width: number = CORRIDOR_WIDTH,
  height: number = CORRIDOR_HEIGHT,
): RgbPixel {
  const safe = clampCoord(row1, col1, width, height);
  const offset = getPixelByteOffset(safe.row, safe.col, width);
  return {
    r: pixels[offset],
    g: pixels[offset + 1],
    b: pixels[offset + 2],
  };
}

export function setPixelImmutable(
  pixels: Uint8ClampedArray,
  row1: number,
  col1: number,
  rgb: RgbPixel,
  width: number = CORRIDOR_WIDTH,
  height: number = CORRIDOR_HEIGHT,
): Uint8ClampedArray {
  const safe = clampCoord(row1, col1, width, height);
  const next = new Uint8ClampedArray(pixels);
  const offset = getPixelByteOffset(safe.row, safe.col, width);
  next[offset] = clampByte(rgb.r);
  next[offset + 1] = clampByte(rgb.g);
  next[offset + 2] = clampByte(rgb.b);
  next[offset + 3] = 255;
  return next;
}

export function extractChannelMatrices(
  pixels: Uint8ClampedArray,
  centerRow1: number,
  centerCol1: number,
  size: SelectionSize,
  width: number = CORRIDOR_WIDTH,
  height: number = CORRIDOR_HEIGHT,
): ChannelMatrices {
  const center = clampCenterCoord(centerRow1, centerCol1, size, width, height);
  const radius = Math.floor(size / 2);

  const rows: number[] = [];
  const cols: number[] = [];
  for (let offset = -radius; offset <= radius; offset += 1) {
    rows.push(center.row + offset);
    cols.push(center.col + offset);
  }

  const r: number[][] = [];
  const g: number[][] = [];
  const b: number[][] = [];

  for (const row of rows) {
    const rRow: number[] = [];
    const gRow: number[] = [];
    const bRow: number[] = [];
    for (const col of cols) {
      const px = readPixel(pixels, row, col, width, height);
      rRow.push(px.r);
      gRow.push(px.g);
      bRow.push(px.b);
    }
    r.push(rRow);
    g.push(gRow);
    b.push(bRow);
  }

  return { rows, cols, r, g, b };
}

export function countModifiedPixels(
  original: Uint8ClampedArray,
  working: Uint8ClampedArray,
): number {
  let count = 0;
  for (let i = 0; i < original.length; i += 4) {
    if (
      original[i] !== working[i] ||
      original[i + 1] !== working[i + 1] ||
      original[i + 2] !== working[i + 2]
    ) {
      count += 1;
    }
  }
  return count;
}

export function getEffectiveParams(
  mode: TransformMode,
  s: number,
  t: number,
): { effectiveS: number; effectiveT: number } {
  if (mode === 'add') {
    return { effectiveS: 1, effectiveT: t };
  }
  if (mode === 'scale') {
    return { effectiveS: s, effectiveT: 0 };
  }
  return { effectiveS: s, effectiveT: t };
}

export function computeSingleChannelTransform(
  original: number,
  mode: TransformMode,
  s: number,
  t: number,
): ChannelTransformDetail {
  const { effectiveS, effectiveT } = getEffectiveParams(mode, s, t);
  const raw = effectiveS * original + effectiveT;
  const { rounded, clamped, wasRounded, clampState } = roundAndClampChannel(raw);
  return {
    original,
    raw,
    rounded,
    clamped,
    wasRounded,
    clampState,
  };
}

export function computePixelTransformDetail(
  pixel: RgbPixel,
  mode: TransformMode,
  s: number,
  t: number,
): PixelTransformDetail {
  return {
    r: computeSingleChannelTransform(pixel.r, mode, s, t),
    g: computeSingleChannelTransform(pixel.g, mode, s, t),
    b: computeSingleChannelTransform(pixel.b, mode, s, t),
  };
}

export function applyAffineTransform(
  source: Uint8ClampedArray,
  mode: TransformMode,
  s: number,
  t: number,
): { pixels: Uint8ClampedArray; stats: TransformStats } {
  const { effectiveS, effectiveT } = getEffectiveParams(mode, s, t);
  const out = new Uint8ClampedArray(source.length);
  const totalPixels = source.length / 4;

  let clippedHighChannels = 0;
  let clippedLowChannels = 0;
  let roundedChannels = 0;

  for (let i = 0; i < source.length; i += 4) {
    for (let c = 0; c < 3; c += 1) {
      const orig = source[i + c];
      const raw = effectiveS * orig + effectiveT;
      const rounded = Math.round(raw);
      if (Math.abs(raw - rounded) > 1e-9) {
        roundedChannels += 1;
      }
      if (rounded > 255) {
        out[i + c] = 255;
        clippedHighChannels += 1;
      } else if (rounded < 0) {
        out[i + c] = 0;
        clippedLowChannels += 1;
      } else {
        out[i + c] = rounded;
      }
    }
    out[i + 3] = 255;
  }

  return {
    pixels: out,
    stats: {
      totalPixels,
      totalChannels: totalPixels * 3,
      clippedHighChannels,
      clippedLowChannels,
      roundedChannels,
    },
  };
}

export function rgbEqual(a: RgbPixel, b: RgbPixel): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b;
}

export function checkExperiment2Targets(
  source: Uint8ClampedArray,
  mode: TransformMode,
  s: number,
  t: number,
): {
  pixelA: TargetPixelStatus;
  pixelB: TargetPixelStatus;
  allMet: boolean;
} {
  const origA = readPixel(source, EXP2_ANCHOR_A.row, EXP2_ANCHOR_A.col);
  const origB = readPixel(source, EXP2_ANCHOR_B.row, EXP2_ANCHOR_B.col);

  const detailA = computePixelTransformDetail(origA, mode, s, t);
  const detailB = computePixelTransformDetail(origB, mode, s, t);

  const currentA: RgbPixel = {
    r: detailA.r.clamped,
    g: detailA.g.clamped,
    b: detailA.b.clamped,
  };
  const currentB: RgbPixel = {
    r: detailB.r.clamped,
    g: detailB.g.clamped,
    b: detailB.b.clamped,
  };

  const isAMet = rgbEqual(origA, EXP2_EXPECTED_A) && rgbEqual(currentA, EXP2_TARGET_A);
  const isBMet = rgbEqual(origB, EXP2_EXPECTED_B) && rgbEqual(currentB, EXP2_TARGET_B);

  return {
    pixelA: {
      label: '관찰 픽셀 A',
      coord: EXP2_ANCHOR_A,
      original: origA,
      current: currentA,
      target: EXP2_TARGET_A,
      isMet: isAMet,
    },
    pixelB: {
      label: '관찰 픽셀 B',
      coord: EXP2_ANCHOR_B,
      original: origB,
      current: currentB,
      target: EXP2_TARGET_B,
      isMet: isBMet,
    },
    allMet: isAMet && isBMet,
  };
}

export function formatFormulaText(mode: TransformMode, s: number, t: number): string {
  if (mode === 'add') {
    const sign = t >= 0 ? '+' : '-';
    return `A′ = A ${sign} ${Math.abs(t)}J`;
  }
  if (mode === 'scale') {
    return `A′ = ${s}A`;
  }
  const sign = t >= 0 ? '+' : '-';
  return `A′ = ${s}A ${sign} ${Math.abs(t)}J`;
}
