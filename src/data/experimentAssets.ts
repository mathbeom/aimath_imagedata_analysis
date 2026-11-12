import {
  CORRIDOR_HEIGHT,
  CORRIDOR_ORIGINAL_PIXELS,
  CORRIDOR_WIDTH,
} from './corridorImage';
import { PixelCoord, RectMaskBounds } from '../types/lab';

/**
 * Experiment 3: Recommended sign rectangle bounds on 64x64 corridor image
 * Matches the mounted school safety sign (rows 19..32, cols 25..47).
 */
export const EXP3_SIGN_RECT: RectMaskBounds = {
  rowStart: 19,
  rowEnd: 32,
  colStart: 25,
  colEnd: 47,
};

/**
 * Starter partial mask so students visibly see overlay/composite working
 * and adjust/drag to isolate the complete safety sign.
 */
export const EXP3_INITIAL_RECT: RectMaskBounds = {
  rowStart: 21,
  rowEnd: 29,
  colStart: 27,
  colEnd: 41,
};

/**
 * 실험 ③ 평가용 지정 픽셀: ①은 표지판 내부, ②는 표지판 바깥 (합성 후 Z의 RGB를 계산·기록)
 */
export const EXP3_TARGET_PIXELS: PixelCoord[] = [
  { row: 20, col: 30 },
  { row: 40, col: 50 },
];

/** 합성식 빈칸 선택지 (정답 표시는 하지 않음) */
export const EXP3_FORMULA_OPTIONS: string[] = ['P', 'J', 'J − P', 'P − J', 'J + P'];

/** 실험 ① 지정 픽셀 수정 과제: B 성분에 더할 값 */
export const EXP1_EDIT_DELTA_B = 40;

/**
 * Default 4x4 inspection top-left sitting across the sign top-left edge (rows 18..21, cols 24..27).
 */
export const EXP3_DEFAULT_4X4_ORIGIN: PixelCoord = { row: 18, col: 24 };

function setRawPixel(
  buffer: Uint8ClampedArray,
  row1: number,
  col1: number,
  r: number,
  g: number,
  b: number,
): void {
  if (row1 < 1 || row1 > CORRIDOR_HEIGHT || col1 < 1 || col1 > CORRIDOR_WIDTH) {
    return;
  }
  const idx = ((row1 - 1) * CORRIDOR_WIDTH + (col1 - 1)) * 4;
  buffer[idx] = r;
  buffer[idx + 1] = g;
  buffer[idx + 2] = b;
  buffer[idx + 3] = 255;
}

function fillRect(
  buffer: Uint8ClampedArray,
  rowStart: number,
  colStart: number,
  rowEnd: number,
  colEnd: number,
  r: number,
  g: number,
  b: number,
): void {
  for (let row = rowStart; row <= rowEnd; row += 1) {
    for (let col = colStart; col <= colEnd; col += 1) {
      setRawPixel(buffer, row, col, r, g, b);
    }
  }
}

/**
 * Deterministic 64x64 warm sunset sky & school courtyard background image Y
 * for Experiment 3 (Hadamard composite). Distinct color palette from indoor corridor X.
 */
function buildCourtyardBackgroundY(): Uint8ClampedArray {
  const buf = new Uint8ClampedArray(CORRIDOR_WIDTH * CORRIDOR_HEIGHT * 4);

  for (let row = 1; row <= CORRIDOR_HEIGHT; row += 1) {
    for (let col = 1; col <= CORRIDOR_WIDTH; col += 1) {
      if (row <= 36) {
        // Warm sunset sky bands (coral-amber near horizon, soft lavender-blue above)
        const band = Math.floor((row - 1) / 4);
        const r = Math.min(250, 182 + band * 8);
        const g = Math.min(220, 146 + band * 7);
        const b = Math.max(108, 196 - band * 9);
        setRawPixel(buf, row, col, r, g, b);
      } else if (row <= 43) {
        // Distant hills silhouette
        const wave = Math.round(2 * Math.sin((col / 64) * Math.PI * 3));
        if (row >= 38 + wave) {
          setRawPixel(buf, row, col, 72, 112, 102);
        } else {
          setRawPixel(buf, row, col, 246, 202, 134);
        }
      } else if (row <= 54) {
        // Green schoolyard grass field with subtle horizontal mow stripes
        const stripe = Math.floor((row - 44) / 2) % 2 === 0;
        if (stripe) {
          setRawPixel(buf, row, col, 74, 152, 84);
        } else {
          setRawPixel(buf, row, col, 62, 136, 74);
        }
      } else {
        // Terracotta school running track lanes at bottom
        if (row === 57 || row === 61) {
          setRawPixel(buf, row, col, 236, 238, 240);
        } else {
          setRawPixel(buf, row, col, 188, 92, 68);
        }
      }
    }
  }

  // Sun disc in upper-left sky
  for (let row = 7; row <= 16; row += 1) {
    for (let col = 8; col <= 17; col += 1) {
      const dr = row - 12;
      const dc = col - 13;
      const distSq = dr * dr + dc * dc;
      if (distSq <= 9) {
        setRawPixel(buf, row, col, 254, 242, 178);
      } else if (distSq <= 16) {
        setRawPixel(buf, row, col, 250, 218, 142);
      }
    }
  }

  // Stylized courtyard trees on right & far left
  fillRect(buf, 35, 53, 45, 56, 92, 64, 46);
  fillRect(buf, 27, 50, 37, 59, 48, 118, 66);
  fillRect(buf, 29, 52, 35, 58, 62, 138, 80);

  fillRect(buf, 38, 6, 46, 8, 92, 64, 46);
  fillRect(buf, 31, 4, 39, 11, 48, 118, 66);

  return buf;
}

export const COMPOSITE_BG_Y_PIXELS: Uint8ClampedArray = buildCourtyardBackgroundY();

/**
 * Experiment 4: Evaluation 5x5 anchor center inside 64x64 grayscale corridor image.
 * Rows 23..27, Cols 19..23 (center row 25, col 21) hold the exact step-edge matrix:
 * 20 20 20 140 140
 * 20 20 20 140 140
 * 20 20 x  140 140
 * 20 20 20 140 140
 * 20 20 20 140 140
 */
export const EXP4_EVAL_CENTER: PixelCoord = { row: 25, col: 21 };
export const EXP4_INITIAL_X = 20;
/** 평균 필터 K₁ = (k/9)·J 의 계수 k 선택지와 초기값 (초기값은 목표를 만족하지 않는 값) */
export const EXP4_MEAN_K_OPTIONS: number[] = [1, 2, 3];
export const EXP4_INITIAL_MEAN_K = 2;

export const EXP4_TARGET_MEAN_3X3: number[][] = [
  [30, 70, 110],
  [30, 70, 110],
  [30, 70, 110],
];

export const EXP4_TARGET_EDGE_3X3: number[][] = [
  [60, 240, 180],
  [60, 240, 180],
  [60, 240, 180],
];

function buildGrayscaleCorridorImage(): Uint8Array {
  const gray = new Uint8Array(CORRIDOR_WIDTH * CORRIDOR_HEIGHT);
  for (let row = 1; row <= CORRIDOR_HEIGHT; row += 1) {
    for (let col = 1; col <= CORRIDOR_WIDTH; col += 1) {
      const idx4 = ((row - 1) * CORRIDOR_WIDTH + (col - 1)) * 4;
      const r = CORRIDOR_ORIGINAL_PIXELS[idx4];
      const g = CORRIDOR_ORIGINAL_PIXELS[idx4 + 1];
      const b = CORRIDOR_ORIGINAL_PIXELS[idx4 + 2];
      const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      gray[(row - 1) * CORRIDOR_WIDTH + (col - 1)] = lum;
    }
  }

  // Embed the exact 5x5 evaluation step-edge patch at rows 23..27, cols 19..23:
  // cols 19..21 (dark vertical molding edge = 20), cols 22..23 (corridor wall = 140)
  for (let row = 23; row <= 27; row += 1) {
    for (let col = 19; col <= 23; col += 1) {
      const val = col <= 21 ? 20 : 140;
      gray[(row - 1) * CORRIDOR_WIDTH + (col - 1)] = val;
    }
  }

  return gray;
}

export const CORRIDOR_GRAYSCALE_ORIGINAL: Uint8Array = buildGrayscaleCorridorImage();

/**
 * Experiment 5: Fixed 8x8 Binary Reference Digits A(0), B(1), C(7) and Initial X.
 */
function parseBinaryRows(rows: string[]): number[][] {
  return rows.map((line) => line.split('').map((ch) => (ch === '1' ? 1 : 0)));
}

export const BINARY_REF_A: number[][] = parseBinaryRows([
  '00111100',
  '01100110',
  '11000011',
  '11000011',
  '11000011',
  '11000011',
  '01100110',
  '00111100',
]);

export const BINARY_REF_B: number[][] = parseBinaryRows([
  '00011000',
  '00111000',
  '00011000',
  '00011000',
  '00011000',
  '00011000',
  '00011000',
  '00111100',
]);

export const BINARY_REF_C: number[][] = parseBinaryRows([
  '11111111',
  '00000110',
  '00001100',
  '00011000',
  '00110000',
  '00110000',
  '00110000',
  '00110000',
]);

export const EXP5_FLIPPED_COORDS: PixelCoord[] = [
  { row: 1, col: 4 },
  { row: 7, col: 2 },
];

export function createInitialBinaryX(): number[][] {
  const copy = BINARY_REF_B.map((row) => [...row]);
  for (const coord of EXP5_FLIPPED_COORDS) {
    const r0 = coord.row - 1;
    const c0 = coord.col - 1;
    copy[r0][c0] = copy[r0][c0] === 1 ? 0 : 1;
  }
  return copy;
}
