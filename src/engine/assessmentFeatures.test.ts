import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CORRIDOR_ORIGINAL_PIXELS,
  EXP1_ANCHOR,
  createCorridorPixelsCopy,
} from '../data/corridorImage';
import {
  COMPOSITE_BG_Y_PIXELS,
  EXP1_EDIT_DELTA_B,
  EXP3_FORMULA_OPTIONS,
  EXP3_INITIAL_RECT,
  EXP3_SIGN_RECT,
  EXP3_TARGET_PIXELS,
  EXP4_EVAL_CENTER,
  createInitialBinaryX,
} from '../data/experimentAssets';
import { CORRIDOR_ORIGINAL_PIXELS as RUBRIC_X, EXP1_ANCHOR as RUBRIC_ANCHOR } from '../data/corridorImage';
import { ASSESSMENT_META } from '../types/lab';
import { setPixelImmutable, readPixel } from './imageMath';
import { toggleBinaryCellImmutable } from './hammingMath';
import {
  DRAFT_STUDENT_KEY,
  StorageLike,
  applyPixelOverrides,
  buildBackupJsonFilename,
  buildBackupPayload,
  buildReportPdfFilename,
  createDefaultWorkspace,
  extractPixelOverrides,
  loadActiveStudentKey,
  loadSavedStudentIndex,
  loadStudentWorkspaceByKey,
  normalizeStudentKey,
  parseAndValidateBackupJson,
  saveStudentWorkspace,
  switchStudentWorkspace,
} from '../utils/storage';
import { ReportImageRenderer, buildReportSnapshot } from './reportBuilder';
import { buildPdfFromJpegPages } from '../utils/pdfExport';

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => (map.has(key) ? map.get(key)! : null),
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

test('assessment metadata covers all 5 rubric items summing to 20 points and Classroom guide', () => {
  assert.equal(ASSESSMENT_META.school, '오류고등학교');
  assert.equal(ASSESSMENT_META.subject, '인공지능수학');
  assert.equal(ASSESSMENT_META.title, '공학 도구를 활용한 이미지 데이터 변환 및 분석');
  assert.equal(ASSESSMENT_META.totalPoints, 20);
  const sum = ASSESSMENT_META.elements.reduce((acc, el) => acc + el.points, 0);
  assert.equal(sum, 20);
  assert.deepEqual(
    ASSESSMENT_META.elements.map((e) => e.points),
    [3, 5, 4, 5, 3],
  );
  assert.ok(ASSESSMENT_META.classroomNotice.includes('Google Classroom'));
  assert.ok(!ASSESSMENT_META.classroomNotice.includes('클래스룸 제출 완료'));
});

test('filename builders generate sanitized Korean assessment PDF and JSON backup names', () => {
  assert.equal(
    buildReportPdfFilename({ studentId: '20101', name: '김오류' }),
    '20101_김오류_인공지능수학3차수행평가.pdf',
  );
  assert.equal(
    buildReportPdfFilename({ studentId: ' 20101 / a ', name: '김 오류' }),
    '20101_a_김_오류_인공지능수학3차수행평가.pdf',
  );
  assert.equal(
    buildReportPdfFilename({ studentId: '', name: '' }),
    '학번미입력_이름미입력_인공지능수학3차수행평가.pdf',
  );
  assert.equal(
    buildBackupJsonFilename({ studentId: '20205', name: '이수학' }, '2026-05-12'),
    '20205_이수학_실험백업_2026-05-12.json',
  );
});

test('student workspace isolation prevents cross-student contamination and promotes draft cleanly', () => {
  const storage = createMemoryStorage();

  // Start in anonymous draft and modify Exp 1 + Exp 2 + Answer
  const draftWs = createDefaultWorkspace({ studentId: '', name: '' }, '2026-05-12');
  const editedBuf = setPixelImmutable(createCorridorPixelsCopy(), 39, 51, {
    r: 12,
    g: 34,
    b: 56,
  });
  draftWs.experimentStates.exp1.pixelOverrides = extractPixelOverrides(
    CORRIDOR_ORIGINAL_PIXELS,
    editedBuf,
  );
  draftWs.experimentStates.exp2.sValue = 1.5;
  draftWs.experimentStates.exp2.tValue = 10;
  draftWs.answers.exp1.observationNote = '학생 A 메모';
  draftWs.verificationStatus['rgb-analysis'] = { resultChecked: true };
  saveStudentWorkspace(draftWs, storage);

  // Student A enters studentId & name -> unseen key promotes __draft__
  const resA = switchStudentWorkspace(
    DRAFT_STUDENT_KEY,
    draftWs,
    { studentId: '20101', name: '김오류' },
    storage,
  );
  assert.equal(resA.nextKey, normalizeStudentKey('20101', '김오류'));
  assert.equal(resA.nextWorkspace.student.studentId, '20101');
  assert.equal(resA.nextWorkspace.answers.exp1.observationNote, '학생 A 메모');
  assert.equal(resA.nextWorkspace.experimentStates.exp2.sValue, 1.5);
  assert.equal(loadActiveStudentKey(storage), resA.nextKey);

  // Switch to Student B (unseen) -> starts completely clean, Student A preserved separately
  const resB = switchStudentWorkspace(
    resA.nextKey,
    resA.nextWorkspace,
    { studentId: '20102', name: '이인공' },
    storage,
  );
  assert.equal(resB.nextKey, normalizeStudentKey('20102', '이인공'));
  assert.equal(resB.nextWorkspace.answers.exp1.observationNote, '');
  assert.equal(resB.nextWorkspace.experimentStates.exp1.pixelOverrides.length, 0);
  assert.equal(resB.nextWorkspace.experimentStates.exp2.sValue, 1);
  assert.equal(resB.nextWorkspace.verificationStatus['rgb-analysis'].resultChecked, false);

  resB.nextWorkspace.answers.exp5.relationExplanation = '학생 B 설명';
  saveStudentWorkspace(resB.nextWorkspace, storage);

  // Index tracks both distinct students cleanly
  const index = loadSavedStudentIndex(storage);
  assert.equal(index.length, 2);
  assert.deepEqual(
    index.map((i) => i.student.studentId).sort(),
    ['20101', '20102'],
  );

  // Switching back to Student A restores Student A's exact workspace without Student B's edits
  const backToA = switchStudentWorkspace(
    resB.nextKey,
    resB.nextWorkspace,
    { studentId: '20101', name: '김오류' },
    storage,
  );
  assert.equal(backToA.nextWorkspace.answers.exp1.observationNote, '학생 A 메모');
  assert.equal(backToA.nextWorkspace.answers.exp5.relationExplanation, '');
  assert.equal(backToA.nextWorkspace.experimentStates.exp1.pixelOverrides.length, 1);

  // Draft with unsaved changes switching onto EXISTING Student B must NOT overwrite Student B
  const anotherDraft = createDefaultWorkspace({ studentId: '', name: '' }, '2026-05-12');
  anotherDraft.answers.exp5.relationExplanation = '덮어쓰면 안 되는 임시 메모';
  const loadB = switchStudentWorkspace(
    DRAFT_STUDENT_KEY,
    anotherDraft,
    { studentId: '20102', name: '이인공' },
    storage,
  );
  assert.equal(loadB.nextWorkspace.answers.exp5.relationExplanation, '학생 B 설명');
  assert.equal(
    loadStudentWorkspaceByKey(resB.nextKey, undefined, storage).answers.exp5.relationExplanation,
    '학생 B 설명',
  );
});

test('pixel override extraction and re-application are lossless', () => {
  const edited = setPixelImmutable(
    setPixelImmutable(createCorridorPixelsCopy(), EXP1_ANCHOR.row, EXP1_ANCHOR.col, {
      r: 10,
      g: 220,
      b: 99,
    }),
    12,
    40,
    { r: 255, g: 0, b: 128 },
  );

  const overrides = extractPixelOverrides(CORRIDOR_ORIGINAL_PIXELS, edited);
  assert.equal(overrides.length, 2);

  const restored = applyPixelOverrides(CORRIDOR_ORIGINAL_PIXELS, overrides);
  assert.deepEqual(restored, edited);
  assert.deepEqual(readPixel(restored, EXP1_ANCHOR.row, EXP1_ANCHOR.col), {
    r: 10,
    g: 220,
    b: 99,
  });
});

test('JSON backup export and import preserve workspace state and reject malformed files safely', () => {
  const ws = createDefaultWorkspace({ studentId: '20309', name: '박행렬' }, '2026-05-12');
  ws.experimentStates.exp3.maskBounds = { ...EXP3_SIGN_RECT };
  ws.experimentStates.exp4.xValue = 110;
  ws.experimentStates.exp4.edgeM = 2;
  ws.experimentStates.exp4.meanK = 3;
  ws.answers.exp3.formulaText = 'Z = X ⊙ P + Y ⊙ (J - P)';
  ws.verificationStatus['image-composite'] = { resultChecked: true };

  const payload = buildBackupPayload(ws);
  assert.equal(payload.schemaVersion, 2);
  assert.equal(payload.assessmentMeta.totalPoints, 20);

  const parsed = parseAndValidateBackupJson(JSON.stringify(payload));
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.workspace.student.studentId, '20309');
    assert.equal(parsed.workspace.student.name, '박행렬');
    assert.equal(parsed.workspace.experimentStates.exp4.xValue, 110);
    assert.equal(parsed.workspace.experimentStates.exp4.edgeM, 2);
    assert.equal(parsed.workspace.experimentStates.exp4.meanK, 3);
    assert.equal(parsed.workspace.answers.exp3.formulaText, 'Z = X ⊙ P + Y ⊙ (J - P)');
    assert.equal(parsed.workspace.verificationStatus['image-composite'].resultChecked, true);
  }

  const invalidJson = parseAndValidateBackupJson('{ broken json');
  assert.equal(invalidJson.ok, false);

  const wrongObject = parseAndValidateBackupJson(JSON.stringify({ hello: 'world' }));
  assert.equal(wrongObject.ok, false);
});

test('buildReportSnapshot collects all 5 experiment computations cleanly without auto-scoring fields', () => {
  const ws = createDefaultWorkspace({ studentId: '20101', name: '김오류' }, '2026-05-12');
  ws.experimentStates.exp2.sValue = 1.5;
  ws.experimentStates.exp2.tValue = 10;
  ws.experimentStates.exp3.maskBounds = { ...EXP3_SIGN_RECT };
  ws.experimentStates.exp4.xValue = 110;
  ws.experimentStates.exp4.edgeM = 2;
  ws.experimentStates.exp4.meanK = 1;
  ws.experimentStates.exp4.patchCenter = { ...EXP4_EVAL_CENTER };

  const x1 = toggleBinaryCellImmutable(createInitialBinaryX(), 1, 4);
  const x2 = toggleBinaryCellImmutable(x1, 7, 2);
  ws.experimentStates.exp5.xGrid = x2;
  ws.verificationStatus['rgb-analysis'] = { resultChecked: true };
  ws.verificationStatus['color-brightness'] = { resultChecked: true };

  const mockRenderer: ReportImageRenderer = {
    renderRgb: () => 'data:image/png;base64,rgb',
    renderGray: () => 'data:image/png;base64,gray',
    renderMask: () => 'data:image/png;base64,mask',
    renderBinary: () => 'data:image/png;base64,bin',
  };

  const report = buildReportSnapshot(ws, mockRenderer);
  assert.equal(report.checkedExperimentCount, 2);
  assert.equal(report.exp2.pixelA.isMet, true);
  assert.equal(report.exp2.pixelB.isMet, true);
  assert.equal(report.exp3.keptFromXPixels, 14 * 23);
  assert.equal(report.exp3.targetMet, true);
  assert.equal(report.exp4.meanOutput3x3[1][1], 70);
  assert.equal(report.exp4.edgeOutput3x3[1][1], 240);
  assert.equal(report.exp5.initialDistances.B, 2);
  assert.equal(report.exp5.currentDistances.B, 0);
  assert.equal(report.exp5.currentClassification.predictedClass, 'B');

  // Verify no auto-assigned student numeric scores exist on the snapshot
  assert.equal('autoScore' in report, false);
  assert.equal('totalScore' in report, false);
});

test('buildPdfFromJpegPages generates valid multi-page %PDF-1.4 document with accurate xref table', () => {
  const fakeJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]);
  const pages = Array.from({ length: 6 }, () => ({
    widthPx: 1240,
    heightPx: 1754,
    jpegBytes: fakeJpeg,
  }));

  const pdfBytes = buildPdfFromJpegPages(pages);
  const text = new TextDecoder('latin1').decode(pdfBytes);

  assert.ok(text.startsWith('%PDF-1.4\n'));
  assert.ok(text.includes('/Type /Pages /Kids [3 0 R 6 0 R 9 0 R 12 0 R 15 0 R 18 0 R] /Count 6'));
  assert.ok(text.includes('/Filter /DCTDecode'));
  assert.ok(text.includes('xref\n0 21\n'));
  assert.ok(text.trimEnd().endsWith('%%EOF'));

  // Validate startxref offset actually points at 'xref\n'
  const startXrefMatch = text.match(/startxref\n(\d+)\n%%EOF/);
  assert.ok(startXrefMatch);
  const startXrefOffset = Number(startXrefMatch[1]);
  assert.equal(text.slice(startXrefOffset, startXrefOffset + 5), 'xref\n');

  // Verify every object entry in xref points to exact `<id> 0 obj` byte offset
  const xrefEntries = [...text.matchAll(/^(\d{10}) 00000 n $/gm)];
  assert.equal(xrefEntries.length, 20);
  xrefEntries.forEach((m, idx) => {
    const off = Number(m[1]);
    const expectedPrefix = `${idx + 1} 0 obj`;
    assert.equal(text.slice(off, off + expectedPrefix.length), expectedPrefix);
  });
});

test('rubric-aligned fixed tasks: exp1 condition count / B+40 edit and exp3 target pixels are well-defined', () => {
  // Exp1: designated 3x3 region has exactly 4 pixels with R > B, and B + 40 stays within 0..255
  let count = 0;
  for (let r = RUBRIC_ANCHOR.row - 1; r <= RUBRIC_ANCHOR.row + 1; r += 1) {
    for (let c = RUBRIC_ANCHOR.col - 1; c <= RUBRIC_ANCHOR.col + 1; c += 1) {
      const px = readPixel(RUBRIC_X, r, c);
      if (px.r > px.b) count += 1;
    }
  }
  assert.equal(count, 4);
  const center = readPixel(RUBRIC_X, RUBRIC_ANCHOR.row, RUBRIC_ANCHOR.col);
  assert.deepEqual(center, { r: 218, g: 128, b: 28 });
  assert.ok(center.b + EXP1_EDIT_DELTA_B <= 255);

  // Exp3: pixel 1 inside the sign rect, pixel 2 outside; X and Y differ at both so Z is informative
  const inside = (p: { row: number; col: number }) =>
    p.row >= EXP3_SIGN_RECT.rowStart && p.row <= EXP3_SIGN_RECT.rowEnd &&
    p.col >= EXP3_SIGN_RECT.colStart && p.col <= EXP3_SIGN_RECT.colEnd;
  assert.equal(inside(EXP3_TARGET_PIXELS[0]), true);
  assert.equal(inside(EXP3_TARGET_PIXELS[1]), false);
  for (const p of EXP3_TARGET_PIXELS) {
    assert.notDeepEqual(readPixel(RUBRIC_X, p.row, p.col), readPixel(COMPOSITE_BG_Y_PIXELS, p.row, p.col));
  }
  // Initial mask must not already satisfy the target, and the correct blanks are selectable
  assert.notDeepEqual(EXP3_INITIAL_RECT, EXP3_SIGN_RECT);
  assert.ok(EXP3_FORMULA_OPTIONS.includes('P') && EXP3_FORMULA_OPTIONS.includes('J − P'));

  // Legacy backups without the new answer fields restore with empty strings
  const ws = createDefaultWorkspace({ studentId: '20101', name: '김오류' }, '2026-11-16');
  const payload = JSON.parse(JSON.stringify(buildBackupPayload(ws)));
  delete payload.workspace.answers.exp1.conditionCountText;
  delete payload.workspace.answers.exp3.sample2ZRgb;
  delete payload.workspace.answers.exp3.formulaBlankX;
  const parsed = parseAndValidateBackupJson(JSON.stringify(payload));
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.workspace.answers.exp1.conditionCountText, '');
    assert.equal(parsed.workspace.answers.exp3.sample2ZRgb, '');
    assert.equal(parsed.workspace.answers.exp3.formulaBlankX, '');
  }
});
