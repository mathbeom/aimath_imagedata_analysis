import { AnchorPreset, PixelCoord, RgbPixel } from '../types/lab';

export const CORRIDOR_WIDTH = 64;
export const CORRIDOR_HEIGHT = 64;

export const EXP1_ANCHOR: PixelCoord = { row: 20, col: 26 };

export const EXP2_ANCHOR_A: PixelCoord = { row: 25, col: 31 };
export const EXP2_EXPECTED_A: RgbPixel = { r: 40, g: 80, b: 120 };
export const EXP2_TARGET_A: RgbPixel = { r: 70, g: 130, b: 190 };

export const EXP2_ANCHOR_B: PixelCoord = { row: 40, col: 13 };
export const EXP2_EXPECTED_B: RgbPixel = { r: 160, g: 100, b: 60 };
export const EXP2_TARGET_B: RgbPixel = { r: 250, g: 160, b: 100 };

export const EXP2_ANCHOR_C: PixelCoord = { row: 13, col: 52 };
export const EXP2_EXPECTED_C: RgbPixel = { r: 215, g: 223, b: 231 };

export const EXP1_ANCHOR_PRESETS: AnchorPreset[] = [
  {
    id: 'exp1-sign-corner',
    label: '지정 3×3 영역 (표지판 모서리)',
    description: '표지판 테두리·안전 띠·표시 영역이 만나는 3×3 경계',
    coord: EXP1_ANCHOR,
  },
  {
    id: 'exp1-blue-panel',
    label: '안내 표지판 배경 영역',
    description: '안내 표지판 내부의 균일한 청색 영역',
    coord: EXP2_ANCHOR_A,
    expectedRgb: EXP2_EXPECTED_A,
  },
  {
    id: 'exp1-wood-door',
    label: '교실 목재 출입문 영역',
    description: '복도 왼쪽 교실 나무 문 표면 영역',
    coord: EXP2_ANCHOR_B,
    expectedRgb: EXP2_EXPECTED_B,
  },
];

export const EXP2_ANCHOR_PRESETS: AnchorPreset[] = [
  {
    id: 'exp2-pixel-a',
    label: '관찰 픽셀 A (표지판 청색)',
    description: '목표 A′ = (70, 130, 190) 비교 위치',
    coord: EXP2_ANCHOR_A,
    expectedRgb: EXP2_EXPECTED_A,
  },
  {
    id: 'exp2-pixel-b',
    label: '관찰 픽셀 B (교실 문 갈색)',
    description: '목표 B′ = (250, 160, 100) 비교 위치',
    coord: EXP2_ANCHOR_B,
    expectedRgb: EXP2_EXPECTED_B,
  },
  {
    id: 'exp2-pixel-c',
    label: '관찰 픽셀 C (밝은 상단 벽면)',
    description: '255 초과 포화·반올림 관찰 위치',
    coord: EXP2_ANCHOR_C,
    expectedRgb: EXP2_EXPECTED_C,
  },
];

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

function drawBitmapPattern(
  buffer: Uint8ClampedArray,
  topRow: number,
  leftCol: number,
  pattern: string[],
  color: RgbPixel,
): void {
  for (let rIdx = 0; rIdx < pattern.length; rIdx += 1) {
    const line = pattern[rIdx];
    for (let cIdx = 0; cIdx < line.length; cIdx += 1) {
      if (line[cIdx] === '#') {
        setRawPixel(buffer, topRow + rIdx, leftCol + cIdx, color.r, color.g, color.b);
      }
    }
  }
}

/**
 * Generates a deterministic 64x64 RGB school corridor scene with a safety/guidance sign.
 * Uses pure integer arithmetic and fixed pixel regions so RGB values are 100% identical
 * across every browser, OS, and GPU.
 */
function buildCorridorImageBuffer(): Uint8ClampedArray {
  const buf = new Uint8ClampedArray(CORRIDOR_WIDTH * CORRIDOR_HEIGHT * 4);

  // 1. Base interior corridor perspective (ceiling, left/right walls, far wall, tiled floor)
  for (let row = 1; row <= CORRIDOR_HEIGHT; row += 1) {
    for (let col = 1; col <= CORRIDOR_WIDTH; col += 1) {
      // Far corridor focal rectangle: rows 17..42, cols 21..49
      const isFarCenter = row >= 17 && row <= 42 && col >= 21 && col <= 49;

      if (isFarCenter) {
        // Far corridor rear wall
        setRawPixel(buf, row, col, 140, 148, 158);
        continue;
      }

      // Perspective boundary diagonals from corners to far focal box
      const topLeftColAtRow = Math.round(((row - 1) * (21 - 1)) / 16) + 1;
      const topRightColAtRow = 64 - Math.round(((row - 1) * (64 - 49)) / 16);
      const botLeftColAtRow = Math.round(((64 - row) * (21 - 1)) / 22) + 1;
      const botRightColAtRow = 64 - Math.round(((64 - row) * (64 - 49)) / 22);

      if (row < 17 && col >= topLeftColAtRow && col <= topRightColAtRow) {
        // Ceiling acoustic panels
        const band = Math.floor(row / 3);
        const cVal = 178 - band * 4;
        const isGridLine = row % 4 === 0 || (col === 32 && row > 3);
        if (isGridLine) {
          setRawPixel(buf, row, col, 134, 142, 154);
        } else {
          setRawPixel(buf, row, col, cVal, cVal + 4, cVal + 9);
        }
      } else if (row > 42 && col >= botLeftColAtRow && col <= botRightColAtRow) {
        // School terrazzo corridor floor with perspective grid lines
        const depthBand = Math.floor((row - 42) / 4);
        const tileColWidth = 5 + depthBand * 2;
        const isTileLine =
          row === 45 ||
          row === 49 ||
          row === 54 ||
          row === 60 ||
          Math.abs(col - 35) % tileColWidth === 0;

        if (isTileLine) {
          setRawPixel(buf, row, col, 102, 110, 122);
        } else {
          const checker = ((Math.floor((row - 42) / 5) + Math.floor(col / 7)) % 2) === 0;
          if (checker) {
            setRawPixel(buf, row, col, 136, 144, 154);
          } else {
            setRawPixel(buf, row, col, 122, 130, 140);
          }
        }
      } else if (col < 32) {
        // Left corridor wall
        if (row <= 33) {
          setRawPixel(buf, row, col, 168, 175, 184);
        } else if (row <= 34) {
          // Corridor handrail molding
          setRawPixel(buf, row, col, 84, 96, 112);
        } else {
          setRawPixel(buf, row, col, 138, 146, 158);
        }
      } else {
        // Right corridor wall
        if (row <= 33) {
          setRawPixel(buf, row, col, 162, 170, 180);
        } else if (row <= 34) {
          setRawPixel(buf, row, col, 84, 96, 112);
        } else {
          setRawPixel(buf, row, col, 132, 140, 152);
        }
      }
    }
  }

  // 2. Ceiling fluorescent light fixtures (centered corridor ceiling)
  fillRect(buf, 4, 28, 6, 37, 242, 246, 250);
  fillRect(buf, 9, 29, 10, 36, 238, 242, 248);
  fillRect(buf, 13, 31, 14, 35, 234, 239, 245);

  // 3. Corridor hallway window on right wall
  fillRect(buf, 19, 52, 31, 60, 68, 80, 96); // Window frame
  fillRect(buf, 20, 53, 25, 59, 158, 198, 232); // Upper sky pane
  fillRect(buf, 26, 53, 30, 59, 120, 170, 142); // Lower greenery
  fillRect(buf, 25, 53, 25, 59, 68, 80, 96); // Mullion bar

  // 4. Right corridor notice board
  fillRect(buf, 35, 52, 47, 61, 74, 86, 102); // Frame
  fillRect(buf, 36, 53, 46, 60, 224, 228, 234); // Notice surface
  fillRect(buf, 38, 54, 39, 59, 42, 86, 146); // Notice header
  fillRect(buf, 41, 54, 41, 59, 94, 106, 122);
  fillRect(buf, 43, 54, 43, 58, 94, 106, 122);

  // 5. Left corridor classroom wooden door (contains EXP2_ANCHOR_B = (160, 100, 60))
  fillRect(buf, 22, 6, 52, 20, 88, 62, 44); // Door frame
  fillRect(buf, 23, 7, 51, 19, 160, 100, 60); // Solid oak door surface
  // Upper door glass pane
  fillRect(buf, 24, 9, 32, 17, 96, 70, 50);
  fillRect(buf, 25, 10, 31, 16, 156, 188, 212);
  // Door handle on right edge
  fillRect(buf, 38, 18, 41, 18, 204, 208, 216);

  // 6. Bright sunlit upper-right plaster panel (contains EXP2_ANCHOR_C = (215, 223, 231))
  // Rows 8..17, cols 47..58 -> solid (215, 223, 231)
  fillRect(buf, 8, 47, 17, 58, 215, 223, 231);
  fillRect(buf, 7, 47, 7, 58, 148, 156, 168);

  // 7. Far corridor lower baseboard
  fillRect(buf, 34, 21, 42, 49, 128, 136, 148);
  fillRect(buf, 41, 21, 42, 49, 86, 96, 108);

  // 8. Prominent Mounted Guidance Sign (rows 19..32, cols 25..47)
  fillRect(buf, 19, 25, 32, 47, 52, 66, 88); // Outer frame
  fillRect(buf, 20, 26, 21, 46, 218, 128, 28); // Amber safety top stripe
  fillRect(buf, 22, 26, 31, 46, 40, 80, 120); // Sign body

  // Corner wall pixel at (19, 25)
  setRawPixel(buf, 19, 25, 140, 148, 158);

  // Keep rows 22..30, cols 26..35 strictly solid (40, 80, 120) for EXP2_ANCHOR_A (25, 31)
  // Right side of sign (cols 37..45, rows 22..30): emblem & graphics
  fillRect(buf, 22, 37, 30, 45, 244, 247, 250);
  fillRect(buf, 23, 38, 29, 44, 40, 80, 120);

  // Caution triangle (cols 39..43, rows 23..27)
  const cautionTriangle = [
    '..#..',
    '.###.',
    '.###.',
    '#####',
    '#####',
  ];
  drawBitmapPattern(buf, 23, 39, cautionTriangle, { r: 234, g: 158, b: 36 });
  // Exclamation inside triangle
  setRawPixel(buf, 24, 41, 36, 48, 66);
  setRawPixel(buf, 25, 41, 36, 48, 66);
  setRawPixel(buf, 27, 41, 36, 48, 66);

  // Directional arrow pointing right (cols 42..44, rows 28..29)
  fillRect(buf, 28, 38, 28, 44, 244, 247, 250);
  fillRect(buf, 29, 38, 29, 42, 218, 128, 28);
  fillRect(buf, 29, 43, 29, 44, 244, 247, 250);

  // Subtle drop shadow under sign
  fillRect(buf, 33, 26, 33, 47, 152, 160, 174);

  return buf;
}

export const CORRIDOR_ORIGINAL_PIXELS: Uint8ClampedArray = buildCorridorImageBuffer();

export function createCorridorPixelsCopy(): Uint8ClampedArray {
  return new Uint8ClampedArray(CORRIDOR_ORIGINAL_PIXELS);
}
