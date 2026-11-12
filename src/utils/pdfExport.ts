import { FullAssessmentReportSnapshot } from '../engine/reportBuilder';
import { ASSESSMENT_META } from '../types/lab';
import { EXP3_TARGET_PIXELS } from '../data/experimentAssets';

export interface PdfJpegPage {
  widthPx: number;
  heightPx: number;
  jpegBytes: Uint8Array;
}

const A4_PT_W = 595.28;
const A4_PT_H = 841.89;
const PAGE_PX_W = 1240;
const PAGE_PX_H = 1754;
const MARGIN_X = 68;
const CONTENT_W = PAGE_PX_W - MARGIN_X * 2;
const FONT_SANS =
  '"Pretendard", "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", "Unifont", sans-serif';
const FONT_MONO =
  '"IBM Plex Mono", "JetBrains Mono", "Unifont", ui-monospace, monospace';

function encodeAscii(str: string): Uint8Array {
  const arr = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i += 1) {
    arr[i] = str.charCodeAt(i) & 0xff;
  }
  return arr;
}

function concatUint8Arrays(chunks: Uint8Array[]): Uint8Array {
  const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

export function dataUrlToJpegBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] || '';
  const binStr = atob(base64);
  const bytes = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i += 1) {
    bytes[i] = binStr.charCodeAt(i);
  }
  return bytes;
}

/**
 * Pure TypeScript multi-page PDF 1.4 writer embedding JPEG A4 pages.
 * Runs identically in Node.js (tests) and the browser.
 */
export function buildPdfFromJpegPages(pages: PdfJpegPage[]): Uint8Array {
  if (pages.length === 0) {
    throw new Error('PDF 생성을 위한 페이지가 없습니다.');
  }

  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0]; // 1-indexed PDF object table; slot 0 unused
  let currentOffset = 0;

  const pushChunk = (bytes: Uint8Array) => {
    chunks.push(bytes);
    currentOffset += bytes.length;
  };

  pushChunk(encodeAscii('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n'));

  const totalObjects = 2 + pages.length * 3;
  const pageObjIds: number[] = [];

  for (let i = 0; i < pages.length; i += 1) {
    pageObjIds.push(3 + i * 3);
  }

  const writeObject = (objId: number, bodyChunks: Uint8Array[]) => {
    offsets[objId] = currentOffset;
    pushChunk(encodeAscii(`${objId} 0 obj\n`));
    for (const c of bodyChunks) {
      pushChunk(c);
    }
    pushChunk(encodeAscii('\nendobj\n'));
  };

  // 1: Catalog
  writeObject(1, [encodeAscii('<< /Type /Catalog /Pages 2 0 R >>')]);

  // 2: Pages root
  writeObject(2, [
    encodeAscii(
      `<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`,
    ),
  ]);

  // Per-page objects
  for (let i = 0; i < pages.length; i += 1) {
    const pageObjId = 3 + i * 3;
    const imgObjId = pageObjId + 1;
    const contentObjId = pageObjId + 2;
    const page = pages[i];
    const imgName = `Im${i}`;

    writeObject(pageObjId, [
      encodeAscii(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_PT_W} ${A4_PT_H}] /Resources << /XObject << /${imgName} ${imgObjId} 0 R >> >> /Contents ${contentObjId} 0 R >>`,
      ),
    ]);

    writeObject(imgObjId, [
      encodeAscii(
        `<< /Type /XObject /Subtype /Image /Width ${page.widthPx} /Height ${page.heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpegBytes.length} >>\nstream\n`,
      ),
      page.jpegBytes,
      encodeAscii('\nendstream'),
    ]);

    const streamStr = `q\n${A4_PT_W} 0 0 ${A4_PT_H} 0 0 cm\n/${imgName} Do\nQ\n`;
    writeObject(contentObjId, [
      encodeAscii(`<< /Length ${streamStr.length} >>\nstream\n${streamStr}endstream`),
    ]);
  }

  const xrefOffset = currentOffset;
  let xrefStr = `xref\n0 ${totalObjects + 1}\n0000000000 65535 f \n`;
  for (let objId = 1; objId <= totalObjects; objId += 1) {
    const off = offsets[objId] ?? 0;
    xrefStr += `${String(off).padStart(10, '0')} 00000 n \n`;
  }
  xrefStr += `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  pushChunk(encodeAscii(xrefStr));

  return concatUint8Arrays(chunks);
}

function loadImageElement(src: string): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function createA4Canvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = PAGE_PX_W;
  canvas.height = PAGE_PX_H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, PAGE_PX_W, PAGE_PX_H);
  return { canvas, ctx };
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number = 10,
): string[] {
  const safeText = (text || '(미입력)').replace(/\r\n/g, '\n');
  const rawParagraphs = safeText.split('\n');
  const lines: string[] = [];

  for (const para of rawParagraphs) {
    if (para.length === 0) {
      lines.push('');
      continue;
    }
    let current = '';
    for (const ch of para) {
      const candidate = current + ch;
      if (ctx.measureText(candidate).width > maxWidth && current.length > 0) {
        lines.push(current);
        current = ch;
        if (lines.length >= maxLines) break;
      } else {
        current = candidate;
      }
    }
    if (lines.length >= maxLines) break;
    if (current.length > 0) lines.push(current);
  }

  if (lines.length === 0) return ['(미입력)'];
  return lines.slice(0, maxLines);
}

function drawRoundedBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string = '#cbd5e1',
  lineWidth: number = 1.5,
) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(x, y, w, h);
}

function drawPageHeader(
  ctx: CanvasRenderingContext2D,
  title: string,
  points: number,
  checked: boolean,
  pageNum: number,
  totalPages: number,
  studentLabel: string,
): number {
  ctx.fillStyle = '#0f172a';
  ctx.font = `600 18px ${FONT_SANS}`;
  ctx.fillText(`${ASSESSMENT_META.school} · ${ASSESSMENT_META.subject} 수행평가`, MARGIN_X, 58);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#475569';
  ctx.font = `500 17px ${FONT_SANS}`;
  ctx.fillText(`${studentLabel}  |  ${pageNum} / ${totalPages}쪽`, PAGE_PX_W - MARGIN_X, 58);
  ctx.textAlign = 'left';

  drawRoundedBox(ctx, MARGIN_X, 74, CONTENT_W, 66, '#f8fafc', '#1e3a8a', 2);
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(MARGIN_X, 74, 10, 66);

  ctx.fillStyle = '#0f172a';
  ctx.font = `700 28px ${FONT_SANS}`;
  ctx.fillText(title, MARGIN_X + 26, 117);

  const statusText = checked
    ? `배점 ${points}점  |  실험 결과 확인: 확인 완료`
    : `배점 ${points}점  |  실험 결과 확인: 미확인`;
  ctx.textAlign = 'right';
  ctx.fillStyle = checked ? '#047857' : '#64748b';
  ctx.font = `600 19px ${FONT_SANS}`;
  ctx.fillText(statusText, PAGE_PX_W - MARGIN_X - 20, 116);
  ctx.textAlign = 'left';

  return 162;
}

function drawTeacherConfirmFooter(
  ctx: CanvasRenderingContext2D,
  points: number,
  title: string,
) {
  const y = PAGE_PX_H - 118;
  drawRoundedBox(ctx, MARGIN_X, y, CONTENT_W, 68, '#f8fafc', '#94a3b8', 1.5);
  ctx.fillStyle = '#334155';
  ctx.font = `600 18px ${FONT_SANS}`;
  ctx.fillText(`${title} 교사 최종 확인 (앱 자동 채점·감점 없음)`, MARGIN_X + 20, y + 40);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#0f172a';
  ctx.font = `700 21px ${FONT_SANS}`;
  ctx.fillText(`교사 확인 점수:  (          ) / ${points} 점`, PAGE_PX_W - MARGIN_X - 20, y + 41);
  ctx.textAlign = 'left';
}

function drawLabeledImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  label: string,
  x: number,
  y: number,
  boxSize: number,
) {
  drawRoundedBox(ctx, x, y, boxSize, boxSize + 38, '#f8fafc', '#cbd5e1', 1.5);
  if (img) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, x + 12, y + 8, boxSize - 24, boxSize - 24);
  }
  ctx.fillStyle = '#1e293b';
  ctx.font = `600 16px ${FONT_SANS}`;
  ctx.textAlign = 'center';
  ctx.fillText(label, x + boxSize / 2, y + boxSize + 15);
  ctx.textAlign = 'left';
}

function drawAnswerBlock(
  ctx: CanvasRenderingContext2D,
  label: string,
  value: string,
  x: number,
  y: number,
  w: number,
  h: number,
  mono: boolean = false,
): number {
  drawRoundedBox(ctx, x, y, w, h, '#ffffff', '#cbd5e1', 1.5);
  ctx.fillStyle = '#1e3a8a';
  ctx.font = `700 17px ${FONT_SANS}`;
  ctx.fillText(label, x + 16, y + 26);

  ctx.font = mono ? `500 17px ${FONT_MONO}` : `400 18px ${FONT_SANS}`;
  ctx.fillStyle = value.trim() ? '#0f172a' : '#94a3b8';
  const maxLines = Math.max(1, Math.floor((h - 42) / 24));
  const lines = wrapLines(ctx, value.trim() || '(미입력)', w - 32, maxLines);
  lines.forEach((line, idx) => {
    ctx.fillText(line, x + 16, y + 54 + idx * 24);
  });
  return y + h + 12;
}

function formatMatrixLines(grid: string[][]): string {
  return grid.map((row) => `[${row.map((c) => (c.trim() ? c.trim() : '·')).join(', ')}]`).join('\n');
}

function formatNumMatrixLines(grid: number[][]): string {
  return grid.map((row) => `[${row.map((n) => String(n)).join(', ')}]`).join('\n');
}

export async function renderReportToPdfBlob(
  report: FullAssessmentReportSnapshot,
): Promise<Blob> {
  const totalPages = 6;
  const studentLabel = `${report.student.studentId.trim() || '학번미입력'} ${report.student.name.trim() || '이름미입력'}`;

  // Preload all PNG snapshots in parallel
  const [
    exp1Orig,
    exp1Work,
    exp2Trans,
    exp3X,
    exp3Y,
    exp3Mask,
    exp3Z,
    exp4Gray,
    exp4Mean,
    exp4Edge,
    refA,
    refB,
    refC,
    xInit,
    xCurr,
  ] = await Promise.all([
    loadImageElement(report.exp1.origImageUrl),
    loadImageElement(report.exp1.workingImageUrl),
    loadImageElement(report.exp2.transformedImageUrl),
    loadImageElement(report.exp3.xImageUrl),
    loadImageElement(report.exp3.yImageUrl),
    loadImageElement(report.exp3.maskImageUrl),
    loadImageElement(report.exp3.zImageUrl),
    loadImageElement(report.exp4.grayOrigImageUrl),
    loadImageElement(report.exp4.meanImageUrl),
    loadImageElement(report.exp4.edgeImageUrl),
    loadImageElement(report.exp5.refAImageUrl),
    loadImageElement(report.exp5.refBImageUrl),
    loadImageElement(report.exp5.refCImageUrl),
    loadImageElement(report.exp5.xInitialImageUrl),
    loadImageElement(report.exp5.xCurrentImageUrl),
  ]);

  const pageCanvases: PdfJpegPage[] = [];

  const finalizeCanvas = (canvas: HTMLCanvasElement) => {
    const jpegUrl = canvas.toDataURL('image/jpeg', 0.92);
    pageCanvases.push({
      widthPx: canvas.width,
      heightPx: canvas.height,
      jpegBytes: dataUrlToJpegBytes(jpegUrl),
    });
  };

  // ==================== PAGE 1: COVER ====================
  {
    const { canvas, ctx } = createA4Canvas();
    drawRoundedBox(ctx, MARGIN_X, 76, CONTENT_W, 200, '#0f172a', '#0f172a', 2);
    ctx.fillStyle = '#93c5fd';
    ctx.font = `600 22px ${FONT_SANS}`;
    ctx.fillText(
      `${ASSESSMENT_META.school} · 2026학년도 2학년 「${ASSESSMENT_META.subject}」 수행평가`,
      MARGIN_X + 36,
      130,
    );

    ctx.fillStyle = '#ffffff';
    ctx.font = `700 38px ${FONT_SANS}`;
    ctx.fillText(ASSESSMENT_META.title, MARGIN_X + 36, 192);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = `500 20px ${FONT_SANS}`;
    ctx.fillText(
      '이미지 데이터 처리 실험실 전체 활동 및 수학적 계산 결과 보고서',
      MARGIN_X + 36,
      238,
    );

    // Student Info Table
    let y = 312;
    drawRoundedBox(ctx, MARGIN_X, y, CONTENT_W, 136, '#f8fafc', '#94a3b8', 2);
    ctx.fillStyle = '#1e3a8a';
    ctx.font = `700 21px ${FONT_SANS}`;
    ctx.fillText('응시 학생 정보', MARGIN_X + 28, y + 38);

    const colW = (CONTENT_W - 56) / 3;
    const infoItems = [
      { k: '학번', v: report.student.studentId.trim() || '(미입력)' },
      { k: '이름', v: report.student.name.trim() || '(미입력)' },
      { k: '실험 실시일', v: report.assessmentDate },
    ];
    infoItems.forEach((item, idx) => {
      const ix = MARGIN_X + 28 + idx * colW;
      ctx.fillStyle = '#64748b';
      ctx.font = `500 17px ${FONT_SANS}`;
      ctx.fillText(item.k, ix, y + 76);
      ctx.fillStyle = '#0f172a';
      ctx.font = `700 26px ${FONT_SANS}`;
      ctx.fillText(item.v, ix, y + 114);
    });

    // Rubric & Verification Overview Table
    y = 484;
    ctx.fillStyle = '#0f172a';
    ctx.font = `700 23px ${FONT_SANS}`;
    ctx.fillText(
      `수행평가 요소별 배점 및 실험 결과 확인 현황 (총점 ${ASSESSMENT_META.totalPoints}점)`,
      MARGIN_X,
      y,
    );
    y += 18;

    const rowH = 92;
    const checks = [
      report.exp1.verification.resultChecked,
      report.exp2.verification.resultChecked,
      report.exp3.verification.resultChecked,
      report.exp4.verification.resultChecked,
      report.exp5.verification.resultChecked,
    ];
    const recCounts = [
      report.exp1.savedRecordCount,
      report.exp2.savedRecordCount,
      report.exp3.savedRecordCount,
      report.exp4.savedRecordCount,
      report.exp5.savedRecordCount,
    ];

    // Table header
    const tableRightX = MARGIN_X + CONTENT_W - 22;
    drawRoundedBox(ctx, MARGIN_X, y, CONTENT_W, 50, '#1e3a8a', '#1e3a8a', 1);
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 18px ${FONT_SANS}`;
    ctx.fillText('평가 영역 및 요소', MARGIN_X + 20, y + 32);
    ctx.fillText('배점', MARGIN_X + 590, y + 32);
    ctx.fillText('실험 결과 확인 여부', MARGIN_X + 680, y + 32);
    ctx.textAlign = 'right';
    ctx.fillText('교사 확인란', tableRightX, y + 32);
    ctx.textAlign = 'left';
    y += 50;

    ASSESSMENT_META.elements.forEach((el, idx) => {
      const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      drawRoundedBox(ctx, MARGIN_X, y, CONTENT_W, rowH, bg, '#cbd5e1', 1);
      ctx.fillStyle = '#0f172a';
      ctx.font = `700 20px ${FONT_SANS}`;
      ctx.fillText(el.title, MARGIN_X + 20, y + 36);
      ctx.fillStyle = '#475569';
      ctx.font = `400 17px ${FONT_SANS}`;
      ctx.fillText(el.elementName, MARGIN_X + 20, y + 66);

      ctx.fillStyle = '#0f172a';
      ctx.font = `700 21px ${FONT_SANS}`;
      ctx.fillText(`${el.points}점`, MARGIN_X + 590, y + 52);

      const isChecked = checks[idx];
      ctx.fillStyle = isChecked ? '#047857' : '#64748b';
      ctx.font = `700 19px ${FONT_SANS}`;
      ctx.fillText(
        isChecked ? `확인 완료 (기록 ${recCounts[idx]}건)` : `미확인 (기록 ${recCounts[idx]}건)`,
        MARGIN_X + 680,
        y + 52,
      );

      ctx.fillStyle = '#334155';
      ctx.font = `600 19px ${FONT_MONO}`;
      ctx.textAlign = 'right';
      ctx.fillText(`(      ) / ${el.points}점`, tableRightX, y + 52);
      ctx.textAlign = 'left';
      y += rowH;
    });

    // Total Row
    drawRoundedBox(ctx, MARGIN_X, y, CONTENT_W, 58, '#eff6ff', '#1e3a8a', 1.5);
    ctx.fillStyle = '#1e3a8a';
    ctx.font = `700 20px ${FONT_SANS}`;
    ctx.fillText(
      `합계 (결과 확인 ${report.checkedExperimentCount}/5개 실험 · 저장 기록 ${report.totalRecordCount}건)`,
      MARGIN_X + 20,
      y + 37,
    );
    ctx.fillText(`${ASSESSMENT_META.totalPoints}점`, MARGIN_X + 590, y + 37);
    ctx.textAlign = 'right';
    ctx.fillText(`총점: (      ) / ${ASSESSMENT_META.totalPoints}점`, tableRightX, y + 37);
    ctx.textAlign = 'left';
    y += 88;

    // Non-auto-scoring notice & Classroom instructions
    drawRoundedBox(ctx, MARGIN_X, y, CONTENT_W, 130, '#f8fafc', '#cbd5e1', 1.5);
    ctx.fillStyle = '#0f172a';
    ctx.font = `700 19px ${FONT_SANS}`;
    ctx.fillText('평가 운영 및 제출 안내', MARGIN_X + 24, y + 36);
    ctx.fillStyle = '#334155';
    ctx.font = `400 18px ${FONT_SANS}`;
    ctx.fillText(
      '• 이 도구는 학생의 점수를 자동 확정하거나 감점하지 않으며, 모든 과정 기록을 보존합니다.',
      MARGIN_X + 24,
      y + 72,
    );
    ctx.fillStyle = '#1e3a8a';
    ctx.font = `700 18px ${FONT_SANS}`;
    ctx.fillText(`• ${ASSESSMENT_META.classroomNotice}`, MARGIN_X + 24, y + 106);

    ctx.fillStyle = '#64748b';
    ctx.font = `500 16px ${FONT_SANS}`;
    ctx.fillText(
      `생성 일시: ${new Date(report.generatedAtIso).toLocaleString('ko-KR')}`,
      MARGIN_X,
      PAGE_PX_H - 54,
    );
    ctx.textAlign = 'right';
    ctx.fillText(`1 / ${totalPages}쪽`, PAGE_PX_W - MARGIN_X, PAGE_PX_H - 54);
    ctx.textAlign = 'left';

    finalizeCanvas(canvas);
  }

  // ==================== PAGE 2: EXPERIMENT 1 ====================
  {
    const { canvas, ctx } = createA4Canvas();
    const s = report.exp1;
    let y = drawPageHeader(
      ctx,
      s.meta.title,
      s.meta.points,
      s.verification.resultChecked,
      2,
      totalPages,
      studentLabel,
    );

    drawLabeledImage(ctx, exp1Orig, '원본 이미지 (64×64)', MARGIN_X, y, 224);
    drawLabeledImage(ctx, exp1Work, '작업·수정 후 이미지', MARGIN_X + 244, y, 224);

    // Parameters & Computed Matrices Box on right of images
    const infoX = MARGIN_X + 490;
    const infoW = CONTENT_W - 490;
    drawRoundedBox(ctx, infoX, y, infoW, 266, '#f8fafc', '#cbd5e1', 1.5);
    ctx.fillStyle = '#1e3a8a';
    ctx.font = `700 18px ${FONT_SANS}`;
    ctx.fillText('실습 선택 영역 및 계측 RGB 값', infoX + 18, y + 30);

    ctx.fillStyle = '#0f172a';
    ctx.font = `500 16px ${FONT_MONO}`;
    const infoLines = [
      `선택 픽셀: (${s.activeCoord.row}, ${s.activeCoord.col}) | 영역: ${s.selectionSize}×${s.selectionSize} (중심 ${s.regionCenter.row}, ${s.regionCenter.col})`,
      `수정 픽셀: (${s.origPixel.r}, ${s.origPixel.g}, ${s.origPixel.b}) → (${s.currPixel.r}, ${s.currPixel.g}, ${s.currPixel.b}) (총 ${s.modifiedCount}개 변경)`,
      `작업 R행렬: ${s.workingMatrices.r.map((r) => `[${r.join(',')}]`).join(' ')}`,
      `작업 G행렬: ${s.workingMatrices.g.map((r) => `[${r.join(',')}]`).join(' ')}`,
      `작업 B행렬: ${s.workingMatrices.b.map((r) => `[${r.join(',')}]`).join(' ')}`,
    ];
    let curY1 = y + 60;
    infoLines.forEach((line) => {
      const wrapped = wrapLines(ctx, line, infoW - 36, 2);
      wrapped.forEach((wl) => {
        if (curY1 <= y + 252) {
          ctx.fillText(wl, infoX + 18, curY1);
        }
        curY1 += 21;
      });
      curY1 += 10;
    });

    y += 290;
    ctx.fillStyle = '#0f172a';
    ctx.font = `700 20px ${FONT_SANS}`;
    ctx.fillText('학생 직접 작성 답안 및 계산 기록', MARGIN_X, y);
    y += 16;

    y = drawAnswerBlock(
      ctx,
      '관찰한 3×3 영역 기준 좌표',
      s.answer.regionCenterText,
      MARGIN_X,
      y,
      CONTENT_W,
      86,
      true,
    );

    const matW = (CONTENT_W - 24) / 3;
    drawAnswerBlock(ctx, '학생 작성 R 행렬', formatMatrixLines(s.answer.rMatrix), MARGIN_X, y, matW, 146, true);
    drawAnswerBlock(ctx, '학생 작성 G 행렬', formatMatrixLines(s.answer.gMatrix), MARGIN_X + matW + 12, y, matW, 146, true);
    drawAnswerBlock(ctx, '학생 작성 B 행렬', formatMatrixLines(s.answer.bMatrix), MARGIN_X + (matW + 12) * 2, y, matW, 146, true);
    y += 160;

    const beforeStr = `(${s.answer.targetBeforeRgb.r || '-'}, ${s.answer.targetBeforeRgb.g || '-'}, ${s.answer.targetBeforeRgb.b || '-'})`;
    const afterStr = `(${s.answer.targetAfterRgb.r || '-'}, ${s.answer.targetAfterRgb.g || '-'}, ${s.answer.targetAfterRgb.b || '-'})`;
    y = drawAnswerBlock(
      ctx,
      '학생 기록: 지정 픽셀 수정 전 → 후 RGB (B 성분 +40 과제)',
      `${beforeStr}  →  ${afterStr}`,
      MARGIN_X,
      y,
      CONTENT_W,
      88,
      true,
    );

    drawAnswerBlock(
      ctx,
      '지정 3×3 영역에서 R 성분이 B 성분보다 큰 픽셀의 개수',
      s.answer.conditionCountText ?? '',
      MARGIN_X,
      y,
      CONTENT_W,
      88,
      true,
    );

    drawTeacherConfirmFooter(ctx, s.meta.points, '실험 1');
    finalizeCanvas(canvas);
  }

  // ==================== PAGE 3: EXPERIMENT 2 ====================
  {
    const { canvas, ctx } = createA4Canvas();
    const s = report.exp2;
    let y = drawPageHeader(
      ctx,
      s.meta.title,
      s.meta.points,
      s.verification.resultChecked,
      3,
      totalPages,
      studentLabel,
    );

    drawLabeledImage(ctx, exp1Orig, '원본 이미지 A', MARGIN_X, y, 212);
    drawLabeledImage(ctx, exp2Trans, '변환 결과 이미지 A′', MARGIN_X + 228, y, 212);

    const infoX = MARGIN_X + 460;
    const infoW = CONTENT_W - 460;
    drawRoundedBox(ctx, infoX, y, infoW, 250, '#f8fafc', '#cbd5e1', 1.5);
    ctx.fillStyle = '#1e3a8a';
    ctx.font = `700 18px ${FONT_SANS}`;
    ctx.fillText('행렬 변환 설정 및 목표 픽셀 변화 계측', infoX + 18, y + 30);

    ctx.fillStyle = '#0f172a';
    ctx.font = `500 16px ${FONT_MONO}`;
    const lines2 = [
      `적용 식: ${s.formula}   (s = ${s.effectiveS}, t = ${s.effectiveT})`,
      `포화/반올림: 255초과=${s.stats.clippedHighChannels}, 0미만=${s.stats.clippedLowChannels}, 반올림=${s.stats.roundedChannels}`,
      `픽셀 A(${s.pixelA.coord.row},${s.pixelA.coord.col}): (${s.pixelA.original.r},${s.pixelA.original.g},${s.pixelA.original.b})→(${s.pixelA.current.r},${s.pixelA.current.g},${s.pixelA.current.b})`,
      `픽셀 B(${s.pixelB.coord.row},${s.pixelB.coord.col}): (${s.pixelB.original.r},${s.pixelB.original.g},${s.pixelB.original.b})→(${s.pixelB.current.r},${s.pixelB.current.g},${s.pixelB.current.b})`,
      `픽셀 C(${s.pixelCCoord.row},${s.pixelCCoord.col}): (${s.pixelCBefore.r},${s.pixelCBefore.g},${s.pixelCBefore.b})→(${s.pixelCAfter.r},${s.pixelCAfter.g},${s.pixelCAfter.b})`,
    ];
    let curY2 = y + 60;
    lines2.forEach((line) => {
      const wrapped = wrapLines(ctx, line, infoW - 36, 2);
      wrapped.forEach((wl) => {
        ctx.fillText(wl, infoX + 18, curY2);
        curY2 += 20;
      });
      curY2 += 12;
    });

    y += 274;
    ctx.fillStyle = '#0f172a';
    ctx.font = `700 20px ${FONT_SANS}`;
    ctx.fillText('학생 직접 작성 답안 및 계산 과정', MARGIN_X, y);
    y += 16;

    y = drawAnswerBlock(
      ctx,
      '기록한 행렬 변환식 및 매개변수 (s, t)',
      `${s.answer.selectedFormula || '(미선택)'}   |   s = ${s.answer.recordedS || '(미입력)'}   |   t = ${s.answer.recordedT || '(미입력)'}`,
      MARGIN_X,
      y,
      CONTENT_W,
      86,
      true,
    );

    const halfW = (CONTENT_W - 16) / 2;
    drawAnswerBlock(ctx, '목표 픽셀 A 계산 과정', s.answer.pixelACalculation, MARGIN_X, y, halfW, 180, true);
    drawAnswerBlock(ctx, '목표 픽셀 B 계산 과정', s.answer.pixelBCalculation, MARGIN_X + halfW + 16, y, halfW, 180, true);
    y += 192;

    y = drawAnswerBlock(
      ctx,
      '지정한 다른 픽셀의 변환 전후 RGB 값',
      s.answer.otherPixelBeforeAfter,
      MARGIN_X,
      y,
      CONTENT_W,
      92,
      true,
    );

    y = drawAnswerBlock(
      ctx,
      '255 초과 성분의 처리 결과 및 탐구 관찰',
      s.answer.overflowHandlingNote,
      MARGIN_X,
      y,
      CONTENT_W,
      154,
      false,
    );

    drawAnswerBlock(
      ctx,
      '추가 탐구 메모 (t·s 변화에 따른 밝기와 픽셀 차이 변화)',
      s.answer.inquiryReflectionNote,
      MARGIN_X,
      y,
      CONTENT_W,
      166,
      false,
    );

    drawTeacherConfirmFooter(ctx, s.meta.points, '실험 2');
    finalizeCanvas(canvas);
  }

  // ==================== PAGE 4: EXPERIMENT 3 ====================
  {
    const { canvas, ctx } = createA4Canvas();
    const s = report.exp3;
    let y = drawPageHeader(
      ctx,
      s.meta.title,
      s.meta.points,
      s.verification.resultChecked,
      4,
      totalPages,
      studentLabel,
    );

    const imgBox = 248;
    const gap = (CONTENT_W - imgBox * 4) / 3;
    drawLabeledImage(ctx, exp3X, '원본 이미지 X', MARGIN_X, y, imgBox);
    drawLabeledImage(ctx, exp3Y, '배경 이미지 Y', MARGIN_X + (imgBox + gap), y, imgBox);
    drawLabeledImage(ctx, exp3Mask, '이진 마스크 P', MARGIN_X + (imgBox + gap) * 2, y, imgBox);
    drawLabeledImage(ctx, exp3Z, '합성 결과 Z', MARGIN_X + (imgBox + gap) * 3, y, imgBox);

    y += imgBox + 58;

    drawRoundedBox(ctx, MARGIN_X, y, CONTENT_W, 174, '#f8fafc', '#cbd5e1', 1.5);
    ctx.fillStyle = '#1e3a8a';
    ctx.font = `700 18px ${FONT_SANS}`;
    ctx.fillText('아다마르 곱 합성 설정 및 4×4 확대 마스크 P 실제값', MARGIN_X + 18, y + 30);

    ctx.fillStyle = '#0f172a';
    ctx.font = `500 16px ${FONT_MONO}`;
    ctx.fillText(`목표 영역 일치 여부: ${s.targetMet ? '목표 일치' : '미일치'}`, MARGIN_X + 18, y + 64);
    ctx.fillText(
      `선택 유지 영역(P=1): ${s.maskBounds.rowStart}~${s.maskBounds.rowEnd}행, ${s.maskBounds.colStart}~${s.maskBounds.colEnd}열`,
      MARGIN_X + 18,
      y + 92,
    );
    ctx.fillText(
      `유지 픽셀(P=1): ${s.keptFromXPixels.toLocaleString()}개  |  배경 교체(P=0): ${s.replacedWithYPixels.toLocaleString()}개`,
      MARGIN_X + 18,
      y + 120,
    );
    ctx.fillText(
      `4×4 관찰 시작: (${s.inspectOrigin.row}, ${s.inspectOrigin.col})`,
      MARGIN_X + 18,
      y + 148,
    );

    ctx.fillStyle = '#1e293b';
    ctx.font = `600 16px ${FONT_MONO}`;
    s.pMatrix4x4.forEach((row, rIdx) => {
      ctx.fillText(`[ ${row.join('  ')} ]`, MARGIN_X + 760, y + 62 + rIdx * 24);
    });

    y += 196;
    ctx.fillStyle = '#0f172a';
    ctx.font = `700 20px ${FONT_SANS}`;
    ctx.fillText('학생 직접 작성 답안 (아다마르 곱과 마스크 기록)', MARGIN_X, y);
    y += 16;

    y = drawAnswerBlock(
      ctx,
      '학생이 완성한 합성식 (빈칸 선택)',
      s.answer.formulaText || '(미선택)',
      MARGIN_X,
      y,
      CONTENT_W,
      76,
      true,
    );

    const halfW = (CONTENT_W - 16) / 2;
    drawAnswerBlock(
      ctx,
      '학생 작성 4×4 마스크 행렬 P',
      formatMatrixLines(s.answer.maskMatrix4x4),
      MARGIN_X,
      y,
      halfW,
      240,
      true,
    );
    drawAnswerBlock(
      ctx,
      '지정 픽셀 ①·②의 P, X, Y → Z 기록',
      `① (${EXP3_TARGET_PIXELS[0].row}, ${EXP3_TARGET_PIXELS[0].col})  P = ${s.answer.samplePixelMaskP || '-'}\nX: ${s.answer.samplePixelXRgb || '-'} / Y: ${s.answer.samplePixelYRgb || '-'}\nZ: ${s.answer.samplePixelZRgb || '-'}\n② (${EXP3_TARGET_PIXELS[1].row}, ${EXP3_TARGET_PIXELS[1].col})  P = ${s.answer.sample2MaskP || '-'}\nX: ${s.answer.sample2XRgb || '-'} / Y: ${s.answer.sample2YRgb || '-'}\nZ: ${s.answer.sample2ZRgb || '-'}`,
      MARGIN_X + halfW + 16,
      y,
      halfW,
      240,
      true,
    );

    drawTeacherConfirmFooter(ctx, s.meta.points, '실험 3');
    finalizeCanvas(canvas);
  }

  // ==================== PAGE 5: EXPERIMENT 4 ====================
  {
    const { canvas, ctx } = createA4Canvas();
    const s = report.exp4;
    let y = drawPageHeader(
      ctx,
      s.meta.title,
      s.meta.points,
      s.verification.resultChecked,
      5,
      totalPages,
      studentLabel,
    );

    drawLabeledImage(ctx, exp4Gray, '원본 흑백 이미지', MARGIN_X, y, 200);
    drawLabeledImage(ctx, exp4Mean, `평균 필터 K₁ (k=${s.meanK})`, MARGIN_X + 216, y, 200);
    drawLabeledImage(
      ctx,
      exp4Edge,
      `경계 필터 K₂ (m=${s.edgeM})`,
      MARGIN_X + 432,
      y,
      200,
    );

    const sideX = MARGIN_X + 650;
    const sideW = CONTENT_W - 650;
    drawRoundedBox(ctx, sideX, y, sideW, 238, '#f8fafc', '#cbd5e1', 1.5);
    ctx.fillStyle = '#1e3a8a';
    ctx.font = `700 17px ${FONT_SANS}`;
    ctx.fillText('필터 설정 및 실제 출력 3×3', sideX + 16, y + 28);
    ctx.fillStyle = '#0f172a';
    ctx.font = `500 15px ${FONT_MONO}`;
    ctx.fillText(`x=${s.xValue} | k=${s.meanK} | m=${s.edgeM} | 표시: ${s.displayMode === 'abs' ? '|값|' : '0~255'}`, sideX + 16, y + 56);
    ctx.fillText(`5×5 중심: (${s.patchCenter.row}, ${s.patchCenter.col})`, sideX + 16, y + 80);

    const colHalf = (sideW - 32) / 2;
    ctx.fillStyle = '#1e3a8a';
    ctx.font = `600 14px ${FONT_SANS}`;
    ctx.fillText(`K₁(k=${s.meanK}) 실제 3×3:`, sideX + 16, y + 114);
    ctx.fillText(`K₂(m=${s.edgeM}) 실제 3×3:`, sideX + 16 + colHalf, y + 114);

    ctx.fillStyle = '#0f172a';
    ctx.font = `500 14px ${FONT_MONO}`;
    s.meanOutput3x3.forEach((row, rIdx) => {
      ctx.fillText(`[${row.join(',')}]`, sideX + 16, y + 142 + rIdx * 24);
    });
    s.edgeOutput3x3.forEach((row, rIdx) => {
      ctx.fillText(`[${row.join(',')}]`, sideX + 16 + colHalf, y + 142 + rIdx * 24);
    });

    y += 258;
    ctx.fillStyle = '#0f172a';
    ctx.font = `700 20px ${FONT_SANS}`;
    ctx.fillText('학생 직접 작성 답안 (합성곱 계산 과정 및 행렬)', MARGIN_X, y);
    y += 16;

    y = drawAnswerBlock(
      ctx,
      '구한 중앙 픽셀 x 및 필터 계수 k, m 값',
      `구한 x = ${s.answer.recordedX || '(미입력)'}    |    구한 k = ${s.answer.recordedK || '(미입력)'}    |    구한 m = ${s.answer.recordedM || '(미입력)'}`,
      MARGIN_X,
      y,
      CONTENT_W,
      82,
      true,
    );

    const halfW = (CONTENT_W - 16) / 2;
    drawAnswerBlock(
      ctx,
      '실험 A · 평균 필터 K₁ 출력 3×3 행렬',
      formatMatrixLines(s.answer.meanOutput3x3),
      MARGIN_X,
      y,
      halfW,
      146,
      true,
    );
    drawAnswerBlock(
      ctx,
      '실험 A · 평균 필터 계산 과정',
      s.answer.meanCalcStep,
      MARGIN_X + halfW + 16,
      y,
      halfW,
      146,
      true,
    );
    y += 160;

    drawAnswerBlock(
      ctx,
      '실험 B · 경계 필터 K₂ (3×3)',
      formatMatrixLines(s.answer.edgeKernel3x3),
      MARGIN_X,
      y,
      halfW,
      146,
      true,
    );
    drawAnswerBlock(
      ctx,
      '실험 B · 경계 필터 출력 3×3 행렬',
      formatMatrixLines(s.answer.edgeOutput3x3),
      MARGIN_X + halfW + 16,
      y,
      halfW,
      146,
      true,
    );
    y += 160;

    drawAnswerBlock(
      ctx,
      '실험 B · 경계 필터 계산 과정',
      s.answer.edgeCalcStep,
      MARGIN_X,
      y,
      CONTENT_W,
      154,
      true,
    );

    // Selected 5x5 original patch summary just above footer
    const patchNote = `선택 5×5 원본 영역 (${s.patch5x5Rows[0]}~${s.patch5x5Rows[4]}행, ${s.patch5x5Cols[0]}~${s.patch5x5Cols[4]}열): ${formatNumMatrixLines(s.patch5x5Values).replace(/\n/g, '  ')}`;
    ctx.fillStyle = '#475569';
    ctx.font = `400 14px ${FONT_MONO}`;
    const pLines = wrapLines(ctx, patchNote, CONTENT_W, 2);
    pLines.forEach((l, i) => ctx.fillText(l, MARGIN_X, y + 178 + i * 20));

    drawTeacherConfirmFooter(ctx, s.meta.points, '실험 4');
    finalizeCanvas(canvas);
  }

  // ==================== PAGE 6: EXPERIMENT 5 ====================
  {
    const { canvas, ctx } = createA4Canvas();
    const s = report.exp5;
    let y = drawPageHeader(
      ctx,
      s.meta.title,
      s.meta.points,
      s.verification.resultChecked,
      6,
      totalPages,
      studentLabel,
    );

    const bSize = 186;
    const bGap = (CONTENT_W - bSize * 5) / 4;
    drawLabeledImage(ctx, refA, '기준 A (숫자 0)', MARGIN_X, y, bSize);
    drawLabeledImage(ctx, refB, '기준 B (숫자 1)', MARGIN_X + (bSize + bGap), y, bSize);
    drawLabeledImage(ctx, refC, '기준 C (숫자 7)', MARGIN_X + (bSize + bGap) * 2, y, bSize);
    drawLabeledImage(ctx, xInit, '초기 입력 X₀', MARGIN_X + (bSize + bGap) * 3, y, bSize);
    drawLabeledImage(ctx, xCurr, '수정 후 입력 X', MARGIN_X + (bSize + bGap) * 4, y, bSize);

    y += bSize + 56;

    drawRoundedBox(ctx, MARGIN_X, y, CONTENT_W, 186, '#f8fafc', '#cbd5e1', 1.5);
    ctx.fillStyle = '#1e3a8a';
    ctx.font = `700 18px ${FONT_SANS}`;
    ctx.fillText('해밍 거리 계측 비교 및 분류 결과 변화', MARGIN_X + 18, y + 30);

    ctx.fillStyle = '#0f172a';
    ctx.font = `500 16px ${FONT_MONO}`;
    ctx.fillText(
      `수정 전 초기 X₀: d(X₀, A)=${s.initialDistances.A}, d(X₀, B)=${s.initialDistances.B}, d(X₀, C)=${s.initialDistances.C}  →  초기 분류: ${s.initialClassification.predictedDigitLabel}`,
      MARGIN_X + 18,
      y + 62,
    );
    ctx.fillText(
      `수정 후 현재 X:  d(X, A)=${s.currentDistances.A}, d(X, B)=${s.currentDistances.B}, d(X, C)=${s.currentDistances.C}  →  현재 분류: ${s.currentClassification.predictedDigitLabel}`,
      MARGIN_X + 18,
      y + 88,
    );
    const editCoordLines = wrapLines(
      ctx,
      `수정한 픽셀 좌표(${s.editLog.length}회): ${s.editedCoordsSummary}`,
      CONTENT_W - 36,
      2,
    );
    let curY5 = y + 114;
    editCoordLines.forEach((line) => {
      ctx.fillText(line, MARGIN_X + 18, curY5);
      curY5 += 20;
    });
    ctx.fillStyle = '#475569';
    ctx.font = `400 14px ${FONT_SANS}`;
    const discLines = wrapLines(
      ctx,
      '※ 본 분류기는 글자 의미를 이해하는 인공지능이 아니라 해밍 거리가 최소인 기준 행렬을 선택하는 수학적 비교 모델입니다.',
      CONTENT_W - 36,
      2,
    );
    discLines.forEach((line, idx) => {
      ctx.fillText(line, MARGIN_X + 18, y + 156 + idx * 18);
    });

    y += 208;
    ctx.fillStyle = '#0f172a';
    ctx.font = `700 20px ${FONT_SANS}`;
    ctx.fillText('학생 직접 작성 답안 (해밍 거리 분석)', MARGIN_X, y);
    y += 16;

    y = drawAnswerBlock(
      ctx,
      '직접 계산한 초기 해밍 거리 및 분류 숫자',
      `d(X, A)=${s.answer.initialDistA || '-'}   d(X, B)=${s.answer.initialDistB || '-'}   d(X, C)=${s.answer.initialDistC || '-'}   |   분류 숫자: ${s.answer.predictedDigit || '(미입력)'}`,
      MARGIN_X,
      y,
      CONTENT_W,
      90,
      true,
    );

    y = drawAnswerBlock(
      ctx,
      '수정한 픽셀 좌표 · 수정 횟수 · 수정 후 d(X, B)',
      `좌표: ${s.answer.editedCoordsText || '(미입력)'}   |   수정 횟수: ${s.answer.editCountText || '-'}회   |   수정 후 d(X, B) = ${s.answer.finalDistB || '-'}`,
      MARGIN_X,
      y,
      CONTENT_W,
      96,
      true,
    );

    drawAnswerBlock(
      ctx,
      '수정한 픽셀과 해밍 거리의 관계 설명',
      s.answer.relationExplanation,
      MARGIN_X,
      y,
      CONTENT_W,
      250,
      false,
    );

    drawTeacherConfirmFooter(ctx, s.meta.points, '실험 5');
    finalizeCanvas(canvas);
  }

  const pdfBytes = buildPdfFromJpegPages(pageCanvases);
  const copy = new Uint8Array(pdfBytes.byteLength);
  copy.set(pdfBytes);
  return new Blob([copy.buffer], { type: 'application/pdf' });
}
