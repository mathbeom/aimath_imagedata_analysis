import React, { useEffect, useRef, useState } from 'react';
import { Move, RotateCcw, SquareDashedMousePointer } from 'lucide-react';
import {
  CORRIDOR_HEIGHT,
  CORRIDOR_WIDTH,
} from '../data/corridorImage';
import {
  EXP3_DEFAULT_4X4_ORIGIN,
} from '../data/experimentAssets';
import { clamp4x4Origin, clampRectBounds, maskToPreviewRgbaPixels } from '../engine/compositeMath';
import { clampCoord } from '../engine/imageMath';
import { PixelCoord, RectMaskBounds } from '../types/lab';

interface Exp3CompositeLeftPanelProps {
  xPixels: Uint8ClampedArray;
  yPixels: Uint8ClampedArray;
  mask: Uint8Array;
  maskBounds: RectMaskBounds;
  inspectOrigin: PixelCoord;
  onChangeMaskBounds: (next: RectMaskBounds) => void;
  onChangeInspectOrigin: (next: PixelCoord) => void;
  onResetMask: () => void;
}

type PointerToolMode = 'rect' | 'inspect4x4';

export const Exp3CompositeLeftPanel: React.FC<Exp3CompositeLeftPanelProps> = ({
  xPixels,
  yPixels,
  mask,
  maskBounds,
  inspectOrigin,
  onChangeMaskBounds,
  onChangeInspectOrigin,
  onResetMask,
}) => {
  const xCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const yCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const dragStartRef = useRef<PixelCoord | null>(null);
  const [pointerMode, setPointerMode] = useState<PointerToolMode>('rect');
  const [showOverlay, setShowOverlay] = useState<boolean>(true);
  const [showPureMask, setShowPureMask] = useState<boolean>(false);
  const [hoverCoord, setHoverCoord] = useState<PixelCoord | null>(null);

  useEffect(() => {
    const xCanvas = xCanvasRef.current;
    if (xCanvas) {
      const ctx = xCanvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        ctx.putImageData(
          new ImageData(new Uint8ClampedArray(xPixels), CORRIDOR_WIDTH, CORRIDOR_HEIGHT),
          0,
          0,
        );
      }
    }
    const yCanvas = yCanvasRef.current;
    if (yCanvas) {
      const ctx = yCanvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        ctx.putImageData(
          new ImageData(new Uint8ClampedArray(yPixels), CORRIDOR_WIDTH, CORRIDOR_HEIGHT),
          0,
          0,
        );
      }
    }
  }, [xPixels, yPixels]);

  useEffect(() => {
    if (!showPureMask) return;
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext('2d');
    if (!ctx) return;
    const rgba = maskToPreviewRgbaPixels(mask);
    ctx.imageSmoothingEnabled = false;
    ctx.putImageData(
      new ImageData(new Uint8ClampedArray(rgba), CORRIDOR_WIDTH, CORRIDOR_HEIGHT),
      0,
      0,
    );
  }, [mask, showPureMask]);

  const coordFromPointer = (
    clientX: number,
    clientY: number,
    rect: DOMRect,
  ): PixelCoord => {
    const normX = Math.max(0, Math.min(rect.width - 0.001, clientX - rect.left));
    const normY = Math.max(0, Math.min(rect.height - 0.001, clientY - rect.top));
    const col1 = Math.floor((normX / rect.width) * CORRIDOR_WIDTH) + 1;
    const row1 = Math.floor((normY / rect.height) * CORRIDOR_HEIGHT) + 1;
    return clampCoord(row1, col1);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    const coord = coordFromPointer(e.clientX, e.clientY, rect);
    setHoverCoord(coord);

    if (pointerMode === 'rect') {
      dragStartRef.current = coord;
      onChangeMaskBounds({
        rowStart: coord.row,
        rowEnd: coord.row,
        colStart: coord.col,
        colEnd: coord.col,
      });
    } else {
      onChangeInspectOrigin(
        clamp4x4Origin({ row: coord.row - 1, col: coord.col - 1 }),
      );
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const coord = coordFromPointer(e.clientX, e.clientY, rect);
    setHoverCoord(coord);

    if (pointerMode === 'rect' && dragStartRef.current) {
      const start = dragStartRef.current;
      onChangeMaskBounds(
        clampRectBounds({
          rowStart: start.row,
          rowEnd: coord.row,
          colStart: start.col,
          colEnd: coord.col,
        }),
      );
    }
  };

  const handlePointerUp = () => {
    dragStartRef.current = null;
  };

  const safeBounds = clampRectBounds(maskBounds);
  const safeOrigin = clamp4x4Origin(inspectOrigin);

  // Overlay percentages
  const maskLeftPct = ((safeBounds.colStart - 1) / CORRIDOR_WIDTH) * 100;
  const maskTopPct = ((safeBounds.rowStart - 1) / CORRIDOR_HEIGHT) * 100;
  const maskWidthPct =
    ((safeBounds.colEnd - safeBounds.colStart + 1) / CORRIDOR_WIDTH) * 100;
  const maskHeightPct =
    ((safeBounds.rowEnd - safeBounds.rowStart + 1) / CORRIDOR_HEIGHT) * 100;

  const inspectLeftPct = ((safeOrigin.col - 1) / CORRIDOR_WIDTH) * 100;
  const inspectTopPct = ((safeOrigin.row - 1) / CORRIDOR_HEIGHT) * 100;
  const inspectSizePct = (4 / CORRIDOR_WIDTH) * 100;

  const updateBoundField = (key: keyof RectMaskBounds, rawVal: string) => {
    const parsed = parseInt(rawVal, 10);
    if (Number.isNaN(parsed)) return;
    const rawNext = { ...safeBounds, [key]: parsed };
    onChangeMaskBounds(clampRectBounds(rawNext));
  };

  return (
    <section
      aria-label="이미지 X와 Y 비교 및 마스크 영역 선택"
      className="flex flex-col gap-4 bg-white border border-slate-200 rounded-lg p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900">
            1. 원본 X · 배경 Y 및 마스크 P
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            64×64 고정 RGB · P=1 유지, P=0 교체
          </p>
        </div>
        <button
          type="button"
          onClick={onResetMask}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>초기화</span>
        </button>
      </div>

      {/* Pointer Mode & Overlay Toggles */}
      <div className="flex flex-col gap-2">
        <div
          role="group"
          aria-label="캔버스 드래그 도구 모드"
          className="grid grid-cols-2 gap-1 p-1 bg-slate-100 border border-slate-200 rounded-md"
        >
          <button
            type="button"
            onClick={() => setPointerMode('rect')}
            className={`inline-flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
              pointerMode === 'rect'
                ? 'bg-white text-blue-900 border border-slate-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <SquareDashedMousePointer className="w-3.5 h-3.5" aria-hidden="true" />
            <span>유지 영역 드래그</span>
          </button>
          <button
            type="button"
            onClick={() => setPointerMode('inspect4x4')}
            className={`inline-flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
              pointerMode === 'inspect4x4'
                ? 'bg-white text-blue-900 border border-slate-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Move className="w-3.5 h-3.5" aria-hidden="true" />
            <span>4×4 확대 이동</span>
          </button>
        </div>

        {/* Side-by-side X and Y */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-800 text-center">
              원본 X (복도 안내 표지판)
            </span>
            <div className="relative aspect-square bg-slate-200 border-2 border-slate-300 rounded overflow-hidden select-none touch-none">
              <canvas
                ref={xCanvasRef}
                width={CORRIDOR_WIDTH}
                height={CORRIDOR_HEIGHT}
                data-testid="exp3-canvas-x"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onPointerLeave={() => setHoverCoord(null)}
                className="w-full h-full block pixelated-canvas cursor-crosshair"
                aria-label="원본 이미지 X 64×64 캔버스"
              />

              {/* Translucent binary mask P overlay: darken P=0 regions cleanly via 4 outer panels */}
              {showOverlay && (
                <div className="pointer-events-none absolute inset-0">
                  {/* Top outside P=0 */}
                  <div
                    style={{ left: 0, right: 0, top: 0, height: `${maskTopPct}%` }}
                    className="absolute bg-slate-950/55"
                  />
                  {/* Bottom outside P=0 */}
                  <div
                    style={{
                      left: 0,
                      right: 0,
                      top: `${maskTopPct + maskHeightPct}%`,
                      bottom: 0,
                    }}
                    className="absolute bg-slate-950/55"
                  />
                  {/* Left middle P=0 */}
                  <div
                    style={{
                      left: 0,
                      width: `${maskLeftPct}%`,
                      top: `${maskTopPct}%`,
                      height: `${maskHeightPct}%`,
                    }}
                    className="absolute bg-slate-950/55"
                  />
                  {/* Right middle P=0 */}
                  <div
                    style={{
                      left: `${maskLeftPct + maskWidthPct}%`,
                      right: 0,
                      top: `${maskTopPct}%`,
                      height: `${maskHeightPct}%`,
                    }}
                    className="absolute bg-slate-950/55"
                  />
                  {/* Selected P=1 outline */}
                  <div
                    style={{
                      left: `${maskLeftPct}%`,
                      top: `${maskTopPct}%`,
                      width: `${maskWidthPct}%`,
                      height: `${maskHeightPct}%`,
                    }}
                    className="absolute border-2 border-blue-400 shadow-[0_0_0_1px_rgba(255,255,255,0.85)]"
                  />
                  {/* 4x4 inspection box */}
                  <div
                    style={{
                      left: `${inspectLeftPct}%`,
                      top: `${inspectTopPct}%`,
                      width: `${inspectSizePct}%`,
                      height: `${inspectSizePct}%`,
                    }}
                    className="absolute border-2 border-amber-400 bg-amber-300/20"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-800 text-center">
              배경 Y (운동장 노을 장면)
            </span>
            <div className="relative aspect-square bg-slate-200 border-2 border-slate-300 rounded overflow-hidden select-none">
              <canvas
                ref={yCanvasRef}
                width={CORRIDOR_WIDTH}
                height={CORRIDOR_HEIGHT}
                data-testid="exp3-canvas-y"
                className="w-full h-full block pixelated-canvas"
                aria-label="배경 이미지 Y 64×64 캔버스"
              />
              {showOverlay && (
                <div className="pointer-events-none absolute inset-0">
                  <div
                    style={{
                      left: `${inspectLeftPct}%`,
                      top: `${inspectTopPct}%`,
                      width: `${inspectSizePct}%`,
                      height: `${inspectSizePct}%`,
                    }}
                    className="absolute border-2 border-amber-400 bg-amber-300/20"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 px-1">
          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showOverlay}
              onChange={(e) => setShowOverlay(e.target.checked)}
              className="rounded border-slate-300 text-blue-700"
            />
            <span>마스크 반투명 오버레이</span>
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showPureMask}
              onChange={(e) => setShowPureMask(e.target.checked)}
              className="rounded border-slate-300 text-blue-700"
            />
            <span>이진 마스크 P 흑백 보기</span>
          </label>
        </div>

        {showPureMask && (
          <div className="flex items-center gap-3 p-2 bg-slate-50 border border-slate-200 rounded">
            <canvas
              ref={maskCanvasRef}
              width={CORRIDOR_WIDTH}
              height={CORRIDOR_HEIGHT}
              className="w-20 h-20 border border-slate-300 rounded pixelated-canvas shrink-0 bg-black"
              aria-label="이진 마스크 행렬 P 64×64 미리보기"
            />
            <div className="text-[11px] text-slate-600 leading-relaxed">
              <div className="font-semibold text-slate-900">마스크 행렬 P (64×64)</div>
              <div>흰색 영역: P = 1 (원본 X 유지)</div>
              <div>검은색 영역: P = 0 (배경 Y 적용)</div>
            </div>
          </div>
        )}

        <div className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-[11px] font-mono tabular-nums flex flex-wrap items-center justify-between gap-2">
          <span className="text-slate-800">
            유지(P=1): {safeBounds.rowStart}~{safeBounds.rowEnd}행, {safeBounds.colStart}~{safeBounds.colEnd}열
          </span>
          {hoverCoord && (
            <span className="text-slate-500">
              커서 ({hoverCoord.row}, {hoverCoord.col})
            </span>
          )}
        </div>
      </div>

      {/* Mask Rectangle Direct Coordinate Inputs */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-200">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-900">
            사각형 유지 영역 P = 1 좌표 (1~64)
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <label className="flex items-center justify-between gap-1.5 bg-slate-50 border border-slate-200 rounded px-2 py-1">
            <span className="text-slate-600 whitespace-nowrap">시작 행</span>
            <input
              type="number"
              min={1}
              max={CORRIDOR_HEIGHT}
              value={safeBounds.rowStart}
              onChange={(e) => updateBoundField('rowStart', e.target.value)}
              aria-label="마스크 시작 행 좌표"
              className="w-16 px-1.5 py-0.5 text-xs font-mono tabular-nums text-right bg-white border border-slate-300 rounded"
            />
          </label>
          <label className="flex items-center justify-between gap-1.5 bg-slate-50 border border-slate-200 rounded px-2 py-1">
            <span className="text-slate-600 whitespace-nowrap">끝 행</span>
            <input
              type="number"
              min={1}
              max={CORRIDOR_HEIGHT}
              value={safeBounds.rowEnd}
              onChange={(e) => updateBoundField('rowEnd', e.target.value)}
              aria-label="마스크 끝 행 좌표"
              className="w-16 px-1.5 py-0.5 text-xs font-mono tabular-nums text-right bg-white border border-slate-300 rounded"
            />
          </label>
          <label className="flex items-center justify-between gap-1.5 bg-slate-50 border border-slate-200 rounded px-2 py-1">
            <span className="text-slate-600 whitespace-nowrap">시작 열</span>
            <input
              type="number"
              min={1}
              max={CORRIDOR_WIDTH}
              value={safeBounds.colStart}
              onChange={(e) => updateBoundField('colStart', e.target.value)}
              aria-label="마스크 시작 열 좌표"
              className="w-16 px-1.5 py-0.5 text-xs font-mono tabular-nums text-right bg-white border border-slate-300 rounded"
            />
          </label>
          <label className="flex items-center justify-between gap-1.5 bg-slate-50 border border-slate-200 rounded px-2 py-1">
            <span className="text-slate-600 whitespace-nowrap">끝 열</span>
            <input
              type="number"
              min={1}
              max={CORRIDOR_WIDTH}
              value={safeBounds.colEnd}
              onChange={(e) => updateBoundField('colEnd', e.target.value)}
              aria-label="마스크 끝 열 좌표"
              className="w-16 px-1.5 py-0.5 text-xs font-mono tabular-nums text-right bg-white border border-slate-300 rounded"
            />
          </label>
        </div>

      </div>

      {/* 4x4 Inspection Origin Controls */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-200">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-slate-900">
            확대 관찰 4×4 영역 시작 좌표
          </span>
          <button
            type="button"
            onClick={() => onChangeInspectOrigin(EXP3_DEFAULT_4X4_ORIGIN)}
            className="text-[11px] font-medium text-blue-700 hover:underline cursor-pointer"
          >
            표지판 경계 ({EXP3_DEFAULT_4X4_ORIGIN.row}, {EXP3_DEFAULT_4X4_ORIGIN.col}) 이동
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <label className="flex items-center justify-between gap-1.5 bg-slate-50 border border-slate-200 rounded px-2 py-1">
            <span className="text-slate-600 whitespace-nowrap">시작 행</span>
            <input
              type="number"
              min={1}
              max={CORRIDOR_HEIGHT - 3}
              value={safeOrigin.row}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!Number.isNaN(v)) {
                  onChangeInspectOrigin(clamp4x4Origin({ row: v, col: safeOrigin.col }));
                }
              }}
              aria-label="4x4 확대 영역 시작 행"
              className="w-16 px-1.5 py-0.5 text-xs font-mono tabular-nums text-right bg-white border border-slate-300 rounded"
            />
          </label>
          <label className="flex items-center justify-between gap-1.5 bg-slate-50 border border-slate-200 rounded px-2 py-1">
            <span className="text-slate-600 whitespace-nowrap">시작 열</span>
            <input
              type="number"
              min={1}
              max={CORRIDOR_WIDTH - 3}
              value={safeOrigin.col}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!Number.isNaN(v)) {
                  onChangeInspectOrigin(clamp4x4Origin({ row: safeOrigin.row, col: v }));
                }
              }}
              aria-label="4x4 확대 영역 시작 열"
              className="w-16 px-1.5 py-0.5 text-xs font-mono tabular-nums text-right bg-white border border-slate-300 rounded"
            />
          </label>
        </div>
      </div>
    </section>
  );
};
