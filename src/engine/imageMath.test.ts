import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CORRIDOR_HEIGHT,
  CORRIDOR_ORIGINAL_PIXELS,
  CORRIDOR_WIDTH,
  EXP1_ANCHOR,
  EXP2_ANCHOR_A,
  EXP2_ANCHOR_B,
  EXP2_ANCHOR_C,
  EXP2_EXPECTED_A,
  EXP2_EXPECTED_B,
  EXP2_EXPECTED_C,
  EXP2_TARGET_A,
  EXP2_TARGET_B,
  createCorridorPixelsCopy,
} from '../data/corridorImage';
import {
  applyAffineTransform,
  checkExperiment2Targets,
  clampCenterCoord,
  computePixelTransformDetail,
  countModifiedPixels,
  extractChannelMatrices,
  readPixel,
  roundAndClampChannel,
  setPixelImmutable,
} from './imageMath';

test('corridor image is 64x64 RGBA and deterministic', () => {
  assert.equal(CORRIDOR_WIDTH, 64);
  assert.equal(CORRIDOR_HEIGHT, 64);
  assert.equal(CORRIDOR_ORIGINAL_PIXELS.length, 64 * 64 * 4);

  const copy = createCorridorPixelsCopy();
  assert.deepEqual(copy, CORRIDOR_ORIGINAL_PIXELS);
});

test('fixed evaluation anchors A, B, C have exact expected RGB across 5x5 uniform neighborhoods', () => {
  const matA = extractChannelMatrices(
    CORRIDOR_ORIGINAL_PIXELS,
    EXP2_ANCHOR_A.row,
    EXP2_ANCHOR_A.col,
    5,
  );
  for (let r = 0; r < 5; r += 1) {
    for (let c = 0; c < 5; c += 1) {
      assert.equal(matA.r[r][c], EXP2_EXPECTED_A.r);
      assert.equal(matA.g[r][c], EXP2_EXPECTED_A.g);
      assert.equal(matA.b[r][c], EXP2_EXPECTED_A.b);
    }
  }

  const matB = extractChannelMatrices(
    CORRIDOR_ORIGINAL_PIXELS,
    EXP2_ANCHOR_B.row,
    EXP2_ANCHOR_B.col,
    5,
  );
  for (let r = 0; r < 5; r += 1) {
    for (let c = 0; c < 5; c += 1) {
      assert.equal(matB.r[r][c], EXP2_EXPECTED_B.r);
      assert.equal(matB.g[r][c], EXP2_EXPECTED_B.g);
      assert.equal(matB.b[r][c], EXP2_EXPECTED_B.b);
    }
  }

  const matC = extractChannelMatrices(
    CORRIDOR_ORIGINAL_PIXELS,
    EXP2_ANCHOR_C.row,
    EXP2_ANCHOR_C.col,
    5,
  );
  for (let r = 0; r < 5; r += 1) {
    for (let c = 0; c < 5; c += 1) {
      assert.equal(matC.r[r][c], EXP2_EXPECTED_C.r);
      assert.equal(matC.g[r][c], EXP2_EXPECTED_C.g);
      assert.equal(matC.b[r][c], EXP2_EXPECTED_C.b);
    }
  }
});

test('Experiment 1 anchor 3x3 region contains distinct meaningful RGB values', () => {
  const mat = extractChannelMatrices(
    CORRIDOR_ORIGINAL_PIXELS,
    EXP1_ANCHOR.row,
    EXP1_ANCHOR.col,
    3,
  );
  assert.deepEqual(mat.rows, [19, 20, 21]);
  assert.deepEqual(mat.cols, [25, 26, 27]);
  // Top-left wall pixel (19, 25) vs sign amber center (20, 26)
  assert.deepEqual(readPixel(CORRIDOR_ORIGINAL_PIXELS, 19, 25), { r: 140, g: 148, b: 158 });
  assert.deepEqual(readPixel(CORRIDOR_ORIGINAL_PIXELS, 20, 26), { r: 218, g: 128, b: 28 });
});

test('1-based coordinate clamping protects 3x3 and 5x5 matrix boundaries', () => {
  assert.deepEqual(clampCenterCoord(1, 1, 3), { row: 2, col: 2 });
  assert.deepEqual(clampCenterCoord(64, 64, 3), { row: 63, col: 63 });
  assert.deepEqual(clampCenterCoord(1, 2, 5), { row: 3, col: 3 });
  assert.deepEqual(clampCenterCoord(63, 64, 5), { row: 62, col: 62 });
});

test('setPixelImmutable updates only the target pixel without mutating original buffer', () => {
  const original = createCorridorPixelsCopy();
  const before = readPixel(original, 20, 26);
  const updated = setPixelImmutable(original, 20, 26, { r: 15, g: 200, b: 99 });

  assert.deepEqual(readPixel(original, 20, 26), before);
  assert.deepEqual(readPixel(updated, 20, 26), { r: 15, g: 200, b: 99 });
  assert.equal(countModifiedPixels(original, updated), 1);
});

test('rounding and 0..255 clamping rules are exact', () => {
  assert.deepEqual(roundAndClampChannel(107.5), {
    rounded: 108,
    clamped: 108,
    wasRounded: true,
    clampState: 'none',
  });
  assert.deepEqual(roundAndClampChannel(332.5), {
    rounded: 333,
    clamped: 255,
    wasRounded: true,
    clampState: 'high',
  });
  assert.deepEqual(roundAndClampChannel(-12.2), {
    rounded: -12,
    clamped: 0,
    wasRounded: true,
    clampState: 'low',
  });
  assert.deepEqual(roundAndClampChannel(0), {
    rounded: 0,
    clamped: 0,
    wasRounded: false,
    clampState: 'none',
  });
});

test('affine transform applies A\'=A+tJ, A\'=sA, and A\'=sA+tJ to every pixel accurately', () => {
  const addOnly = applyAffineTransform(CORRIDOR_ORIGINAL_PIXELS, 'add', 2, -20);
  // In add-only mode, s is ignored (treated as 1)
  assert.deepEqual(readPixel(addOnly.pixels, EXP2_ANCHOR_A.row, EXP2_ANCHOR_A.col), {
    r: 20,
    g: 60,
    b: 100,
  });

  const scaleOnly = applyAffineTransform(CORRIDOR_ORIGINAL_PIXELS, 'scale', 0.5, 20);
  // In scale-only mode, t is ignored (treated as 0)
  // Pixel C = (215, 223, 231) -> * 0.5 = (107.5, 111.5, 115.5) -> rounded (108, 112, 116)
  assert.deepEqual(readPixel(scaleOnly.pixels, EXP2_ANCHOR_C.row, EXP2_ANCHOR_C.col), {
    r: 108,
    g: 112,
    b: 116,
  });

  const combined = applyAffineTransform(CORRIDOR_ORIGINAL_PIXELS, 'combined', 1.5, 10);
  assert.deepEqual(readPixel(combined.pixels, EXP2_ANCHOR_A.row, EXP2_ANCHOR_A.col), EXP2_TARGET_A);
  assert.deepEqual(readPixel(combined.pixels, EXP2_ANCHOR_B.row, EXP2_ANCHOR_B.col), EXP2_TARGET_B);
  assert.deepEqual(readPixel(combined.pixels, EXP2_ANCHOR_C.row, EXP2_ANCHOR_C.col), {
    r: 255,
    g: 255,
    b: 255,
  });
  assert.ok(combined.stats.clippedHighChannels > 0);
});

test('Experiment 2 target check succeeds exclusively when A\'=(70,130,190) and B\'=(250,160,100)', () => {
  const met = checkExperiment2Targets(CORRIDOR_ORIGINAL_PIXELS, 'combined', 1.5, 10);
  assert.equal(met.pixelA.isMet, true);
  assert.equal(met.pixelB.isMet, true);
  assert.equal(met.allMet, true);

  const notMet1 = checkExperiment2Targets(CORRIDOR_ORIGINAL_PIXELS, 'add', 1, 20);
  assert.equal(notMet1.allMet, false);

  const notMet2 = checkExperiment2Targets(CORRIDOR_ORIGINAL_PIXELS, 'scale', 1.5, 10);
  assert.equal(notMet2.allMet, false);

  const detailC = computePixelTransformDetail(EXP2_EXPECTED_C, 'combined', 1.5, 10);
  assert.equal(detailC.r.clampState, 'high');
  assert.equal(detailC.r.clamped, 255);
});
