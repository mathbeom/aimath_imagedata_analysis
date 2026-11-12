import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CORRIDOR_HEIGHT,
  CORRIDOR_ORIGINAL_PIXELS,
  CORRIDOR_WIDTH,
} from '../data/corridorImage';
import {
  BINARY_REF_A,
  BINARY_REF_B,
  BINARY_REF_C,
  COMPOSITE_BG_Y_PIXELS,
  CORRIDOR_GRAYSCALE_ORIGINAL,
  EXP3_DEFAULT_4X4_ORIGIN,
  EXP3_SIGN_RECT,
  EXP4_EVAL_CENTER,
  EXP4_INITIAL_X,
  EXP4_TARGET_EDGE_3X3,
  EXP4_TARGET_MEAN_3X3,
  createInitialBinaryX,
} from '../data/experimentAssets';
import { readPixel } from './imageMath';
import {
  applyHadamardComposite,
  buildRectMask,
  clampRectBounds,
  extract4x4CompositeData,
} from './compositeMath';
import {
  applyConvolutionToFullGrayscaleImage,
  checkExp4Targets,
  computeValid3x3Convolution,
  convolutionRawToRgbaPixels,
  extract5x5GrayscalePatch,
  readGrayscalePixel,
  setGrayscaleCenterXImmutable,
} from './convolutionMath';
import {
  classifyByHammingDistance,
  computeAllDistances,
  computeHammingDistance,
  computeXorMatrix,
  toggleBinaryCellImmutable,
} from './hammingMath';

test('Experiment 3: composite image Y matches 64x64 RGBA and Hadamard Z = X⊙P + Y⊙(J-P) is exact', () => {
  assert.equal(COMPOSITE_BG_Y_PIXELS.length, CORRIDOR_WIDTH * CORRIDOR_HEIGHT * 4);

  const clamped = clampRectBounds({
    rowStart: 32,
    rowEnd: 19,
    colStart: 47,
    colEnd: 25,
  });
  assert.deepEqual(clamped, EXP3_SIGN_RECT);

  const mask = buildRectMask(EXP3_SIGN_RECT);
  const res = applyHadamardComposite(
    CORRIDOR_ORIGINAL_PIXELS,
    COMPOSITE_BG_Y_PIXELS,
    mask,
  );

  // Inside sign mask -> exact pixel from X; outside mask -> exact pixel from Y
  const insideCoord = { row: 25, col: 30 };
  const outsideCoord = { row: 10, col: 15 };

  assert.deepEqual(
    readPixel(res.pixels, insideCoord.row, insideCoord.col),
    readPixel(CORRIDOR_ORIGINAL_PIXELS, insideCoord.row, insideCoord.col),
  );
  assert.deepEqual(
    readPixel(res.pixels, outsideCoord.row, outsideCoord.col),
    readPixel(COMPOSITE_BG_Y_PIXELS, outsideCoord.row, outsideCoord.col),
  );

  const signRows = EXP3_SIGN_RECT.rowEnd - EXP3_SIGN_RECT.rowStart + 1; // 14
  const signCols = EXP3_SIGN_RECT.colEnd - EXP3_SIGN_RECT.colStart + 1; // 23
  assert.equal(res.stats.keptFromXPixels, signRows * signCols);
  assert.equal(
    res.stats.keptFromXPixels + res.stats.replacedWithYPixels,
    CORRIDOR_WIDTH * CORRIDOR_HEIGHT,
  );

  // Inspect 4x4 boundary across top-left corner of the sign (rows 18..21, cols 24..27)
  const inspect4x4 = extract4x4CompositeData(
    CORRIDOR_ORIGINAL_PIXELS,
    COMPOSITE_BG_Y_PIXELS,
    mask,
    res.pixels,
    EXP3_DEFAULT_4X4_ORIGIN,
  );
  assert.deepEqual(inspect4x4.rows, [18, 19, 20, 21]);
  assert.deepEqual(inspect4x4.cols, [24, 25, 26, 27]);
  assert.deepEqual(inspect4x4.pMatrix, [
    [0, 0, 0, 0],
    [0, 1, 1, 1],
    [0, 1, 1, 1],
    [0, 1, 1, 1],
  ]);

  // Row 18 col 24 has P=0 so Z == Y
  assert.deepEqual(inspect4x4.cells[0][0].z, inspect4x4.cells[0][0].y);
  // Row 20 col 26 has P=1 so Z == X
  assert.deepEqual(inspect4x4.cells[2][2].z, inspect4x4.cells[2][2].x);
});

test('Experiment 4: grayscale 5x5 patch at evaluation center has exact 20/140 step-edge and evaluates K1 & K2 accurately', () => {
  assert.equal(CORRIDOR_GRAYSCALE_ORIGINAL.length, CORRIDOR_WIDTH * CORRIDOR_HEIGHT);
  assert.equal(
    readGrayscalePixel(
      CORRIDOR_GRAYSCALE_ORIGINAL,
      EXP4_EVAL_CENTER.row,
      EXP4_EVAL_CENTER.col,
    ),
    EXP4_INITIAL_X,
  );

  const patchInit = extract5x5GrayscalePatch(
    CORRIDOR_GRAYSCALE_ORIGINAL,
    EXP4_EVAL_CENTER.row,
    EXP4_EVAL_CENTER.col,
  );
  assert.deepEqual(patchInit.values, [
    [20, 20, 20, 140, 140],
    [20, 20, 20, 140, 140],
    [20, 20, 20, 140, 140],
    [20, 20, 20, 140, 140],
    [20, 20, 20, 140, 140],
  ]);

  // Initial state: x=20 fails targets
  const initCheck = checkExp4Targets(CORRIDOR_GRAYSCALE_ORIGINAL, 1, 1);
  assert.equal(initCheck.meanMet, false);
  assert.equal(initCheck.edgeMet, false);

  // Set center pixel x = 110 without mutating original grayscale array
  const updatedGray = setGrayscaleCenterXImmutable(
    CORRIDOR_GRAYSCALE_ORIGINAL,
    110,
    EXP4_EVAL_CENTER,
  );
  assert.equal(
    readGrayscalePixel(
      CORRIDOR_GRAYSCALE_ORIGINAL,
      EXP4_EVAL_CENTER.row,
      EXP4_EVAL_CENTER.col,
    ),
    20,
  );
  assert.equal(
    readGrayscalePixel(updatedGray, EXP4_EVAL_CENTER.row, EXP4_EVAL_CENTER.col),
    110,
  );

  const patch110 = extract5x5GrayscalePatch(
    updatedGray,
    EXP4_EVAL_CENTER.row,
    EXP4_EVAL_CENTER.col,
  );

  const meanConv = computeValid3x3Convolution(patch110, 'mean', 1);
  assert.deepEqual(meanConv.outputMatrix, EXP4_TARGET_MEAN_3X3);
  assert.equal(meanConv.details[1][1].terms.length, 9);

  // Edge filter m=2 with x=110 matches target [[60,240,180],...]
  const edgeConvM2 = computeValid3x3Convolution(patch110, 'edge', 2);
  assert.deepEqual(edgeConvM2.outputMatrix, EXP4_TARGET_EDGE_3X3);

  // Edge filter m=3 preserves >255 raw mathematical output (360) without clamping
  const edgeConvM3 = computeValid3x3Convolution(patch110, 'edge', 3);
  assert.equal(edgeConvM3.outputMatrix[1][1], 360);

  // K1 = (k/9)·J: only k=1 with x=110 meets the mean target; k=2, 3 scale the output
  const meanK2 = computeValid3x3Convolution(patch110, 'mean', 2);
  assert.deepEqual(meanK2.outputMatrix[0], [60, 140, 220]);
  assert.equal(meanK2.kernel.scaleText, '2/9');
  const meanK3 = computeValid3x3Convolution(patch110, 'mean', 3);
  assert.deepEqual(meanK3.outputMatrix[0], [90, 210, 330]);
  assert.equal(checkExp4Targets(updatedGray, 2, 2).meanMet, false);
  assert.equal(checkExp4Targets(updatedGray, 2, 3).meanMet, false);
  // No other (x, k) pair in range reaches the mean target → unique answer
  for (const k of [1, 2, 3]) {
    for (let x = 0; x <= 255; x += 1) {
      const g = setGrayscaleCenterXImmutable(CORRIDOR_GRAYSCALE_ORIGINAL, x, EXP4_EVAL_CENTER);
      assert.equal(checkExp4Targets(g, 2, k).meanMet, k === 1 && x === 110);
    }
  }
  // Full image result changes with k
  const fullK1 = applyConvolutionToFullGrayscaleImage(updatedGray, 'mean', 1);
  const fullK3 = applyConvolutionToFullGrayscaleImage(updatedGray, 'mean', 3);
  assert.ok(fullK3.stats.maxRaw > fullK1.stats.maxRaw);

  const checkSolved = checkExp4Targets(updatedGray, 2, 1);
  assert.equal(checkSolved.meanMet, true);
  assert.equal(checkSolved.edgeMet, true);
  assert.equal(checkSolved.allMet, true);

  // Full 64x64 convolution produces negative & >255 values and updates when x changes
  const fullEdge = applyConvolutionToFullGrayscaleImage(updatedGray, 'edge', 2);
  assert.equal(fullEdge.rawValues.length, CORRIDOR_WIDTH * CORRIDOR_HEIGHT);
  assert.ok(fullEdge.stats.negativePixelCount > 0);
  // At center output of 5x5, value is 240
  const centerIdx = (EXP4_EVAL_CENTER.row - 1) * CORRIDOR_WIDTH + (EXP4_EVAL_CENTER.col - 1);
  assert.equal(fullEdge.rawValues[centerIdx], 240);

  const clampedDisplay = convolutionRawToRgbaPixels(fullEdge.rawValues, 'clamp');
  const absDisplay = convolutionRawToRgbaPixels(fullEdge.rawValues, 'abs');
  assert.equal(clampedDisplay.length, CORRIDOR_WIDTH * CORRIDOR_HEIGHT * 4);
  assert.equal(absDisplay.length, CORRIDOR_WIDTH * CORRIDOR_HEIGHT * 4);
  // Negative edge pixel becomes 0 in clamp mode and >0 in abs mode
  let diffFound = false;
  for (let i = 0; i < fullEdge.rawValues.length; i += 1) {
    if (fullEdge.rawValues[i] < -50) {
      assert.equal(clampedDisplay[i * 4], 0);
      assert.ok(absDisplay[i * 4] > 0);
      diffFound = true;
      break;
    }
  }
  assert.equal(diffFound, true);
});

test('Experiment 5: 8x8 binary Hamming distances, XOR diff, and classification behave accurately', () => {
  assert.equal(BINARY_REF_A.length, 8);
  assert.equal(BINARY_REF_B.length, 8);
  assert.equal(BINARY_REF_C.length, 8);

  const xInit = createInitialBinaryX();
  const distInit = computeAllDistances(xInit);
  assert.equal(distInit.B, 2);
  assert.ok(distInit.A > 2);
  assert.ok(distInit.C > 2);

  const xorInit = computeXorMatrix(xInit, BINARY_REF_B);
  assert.equal(xorInit[0][3], true); // (1, 4)
  assert.equal(xorInit[6][1], true); // (7, 2)

  const initClass = classifyByHammingDistance(xInit);
  assert.equal(initClass.predictedClass, 'B');
  assert.equal(initClass.minDistance, 2);

  // Flipping (1, 4) and (7, 2) restores exact B -> distance 0
  const xStep1 = toggleBinaryCellImmutable(xInit, 1, 4);
  assert.equal(computeHammingDistance(xStep1, BINARY_REF_B), 1);

  const xStep2 = toggleBinaryCellImmutable(xStep1, 7, 2);
  assert.equal(computeHammingDistance(xStep2, BINARY_REF_B), 0);
  const finalClass = classifyByHammingDistance(xStep2);
  assert.equal(finalClass.predictedClass, 'B');
  assert.equal(finalClass.minDistance, 0);
});
