import React, { useEffect, useRef, useState } from 'react';
import { Crosshair, RotateCcw } from 'lucide-react';
import {
  AnchorPreset,
  PixelCoord,
  RgbPixel,
  SelectionSize,
} from '../types/lab';
import {
  CORRIDOR_HEIGHT,
  CORRIDOR_WIDTH,
} from '../data/corridorImage';
import {
  clampCenterCoord,
  clampCoord,
  extractChannelMatrices,
  readPixel,
} from '../engine/imageMath';

interface PixelCanvasStageProps {
  imageLabel: string;
  pixels: Uint8ClampedArray;
  alternatePixels?: Uint8ClampedArray;
  activeCoord: PixelCoord;
  regionCenter: PixelCoord;
  selectionSize: SelectionSize;
  presets: AnchorPreset[];
  onSelectCoord: (coord: PixelCoord) => void;
  onChangeSelectionSize: (size: SelectionSize) => void;
  onSelectPreset: (preset: AnchorPreset) => void;
  onResetAll?: () => void;
  resetLabel?: string;
}

export const PixelCanvasStage: React.FC<PixelCanvasStageProps> = ({
  imageLabel,
  pixels,
  alternatePixels,
  activeCoord,
  regionCenter,
  selectionSize,
  presets,
  onSelectCoord,
  onChangeSelectionSize,
  onSelectPreset,
  onResetAll,
  resetLabel = '원본으로 초기화',
}) => {
  const mainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const [hoverCoord, setHoverCoord] = useState<PixelCoord | null>(null);
  const [showCoordOverlay, setShowCoordOverlay] = useState<boolean>(true);
  const [zoomSource, setZoomSource] = useState<'original' | 'modified'>('original');

  useEffect(() => {
    const canvas = mainCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = new ImageData(
      new Uint8ClampedArray(pixels),
      CORRIDOR_WIDTH,
      CORRIDOR_HEIGHT,
    );
    ctx.imageSmoothingEnabled = false;
    ctx.putImageData(imageData, 0, 0);
  }, [pixels]);

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
    isDraggingRef.current = true;
    const rect = e.currentTarget.getBoundingClientRect();
    const coord = coordFromPointer(e.clientX, e.clientY, rect);
    setHoverCoord(coord);
    onSelectCoord(coord);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const coord = coordFromPointer(e.clientX, e.clientY, rect);
    setHoverCoord(coord);
    if (isDraggingRef.current) {
      onSelectCoord(coord);
    }
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  const safeCenter = clampCenterCoord(
    regionCenter.row,
    regionCenter.col,
    selectionSize,
  );
  const radius = Math.floor(selectionSize / 2);

  const zoomPixelSource =
    alternatePixels && zoomSource === 'modified' ? alternatePixels : pixels;

  const activeRgb: RgbPixel = readPixel(pixels, activeCoord.row, activeCoord.col);
  const hoverRgb: RgbPixel | null = hoverCoord
    ? readPixel(pixels, hoverCoord.row, hoverCoord.col)
    : null;

  const zoomMatrices = extractChannelMatrices(
    zoomPixelSource,
    safeCenter.row,
    safeCenter.col,
    selectionSize,
  );

  // Selection box percentages on the 128x128 main canvas
  const boxLeftPct = ((safeCenter.col - radius - 1) / CORRIDOR_WIDTH) * 100;
  const boxTopPct = ((safeCenter.row - radius - 1) / CORRIDOR_HEIGHT) * 100;
  const boxWidthPct = (selectionSize / CORRIDOR_WIDTH) * 100;
  const boxHeightPct = (selectionSize / CORRIDOR_HEIGHT) * 100;

  const activeLeftPct = ((activeCoord.col - 1) / CORRIDOR_WIDTH) * 100;
  const activeTopPct = ((activeCoord.row - 1) / CORRIDOR_HEIGHT) * 100;
  const singlePixelPct = (1 / CORRIDOR_WIDTH) * 100;

  const handleRowInput = (val: string) => {
    const parsed = parseInt(val, 10);
    if (Number.isNaN(parsed)) return;
    onSelectCoord(clampCoord(parsed, activeCoord.col));
  };

  const handleColInput = (val: string) => {
    const parsed = parseInt(val, 10);
    if (Number.isNaN(parsed)) return;
    onSelectCoord(clampCoord(activeCoord.row, parsed));
  };

  return (
    <section
      aria-label="이미지 관찰 영역"
      className="flex flex-col gap-4 bg-white border border-slate-200 rounded-lg p-4"
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900">
            1. 이미지 관찰
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 truncate">
            {imageLabel} · 64×64 · (행, 열) 1부터 시작
          </p>
        </div>
        {onResetAll && (
          <button
            type="button"
            onClick={onResetAll}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{resetLabel}</span>
          </button>
        )}
      </div>

      {/* Main 128x128 Image Viewport */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span>클릭 또는 드래그하여 픽셀·영역 선택</span>
          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showCoordOverlay}
              onChange={(e) => setShowCoordOverlay(e.target.checked)}
              className="rounded border-slate-300 text-blue-700 focus:ring-blue-600"
            />
            <span>영역 표시</span>
          </label>
        </div>

        <div className="relative w-full aspect-square max-w-[288px] mx-auto bg-slate-200 border-2 border-slate-300 rounded overflow-hidden select-none touch-none">
          <canvas
            ref={mainCanvasRef}
            width={CORRIDOR_WIDTH}
            height={CORRIDOR_HEIGHT}
            data-testid="source-image-canvas"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerLeave={() => setHoverCoord(null)}
            className="w-full h-full block pixelated-canvas cursor-crosshair"
            aria-label="학교 복도 및 안전 표지판 64×64 원본 관찰 캔버스"
          />

          {/* Selection Overlay (non-interactive) */}
          {showCoordOverlay && (
            <div className="pointer-events-none absolute inset-0">
              {/* Selected 3x3 or 5x5 region outline */}
              <div
                style={{
                  left: `${boxLeftPct}%`,
                  top: `${boxTopPct}%`,
                  width: `${boxWidthPct}%`,
                  height: `${boxHeightPct}%`,
                }}
                className="absolute border-2 border-blue-600 bg-blue-500/10 shadow-[0_0_0_1px_rgba(255,255,255,0.9)]"
              />
              {/* Active single pixel crosshair */}
              <div
                style={{
                  left: `${activeLeftPct}%`,
                  top: `${activeTopPct}%`,
                  width: `${singlePixelPct}%`,
                  height: `${singlePixelPct}%`,
                }}
                className="absolute border border-amber-400 bg-amber-400/20"
              />
            </div>
          )}
        </div>

        {/* Live Hover / Active Readout */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-2 bg-slate-50 border border-slate-200 rounded text-xs font-mono tabular-nums">
          <div className="flex items-center gap-2">
            <span
              className="w-4 h-4 rounded-sm border border-slate-300 shrink-0"
              style={{
                backgroundColor: `rgb(${activeRgb.r}, ${activeRgb.g}, ${activeRgb.b})`,
              }}
              aria-hidden="true"
            />
            <span className="text-slate-700 font-medium">
              선택 ({activeCoord.row}, {activeCoord.col})
            </span>
            <span className="text-slate-500">
              RGB({activeRgb.r}, {activeRgb.g}, {activeRgb.b})
            </span>
          </div>
          {hoverCoord && hoverRgb && (
            <span className="text-slate-500">
              커서 ({hoverCoord.row}, {hoverCoord.col}): ({hoverRgb.r}, {hoverRgb.g}, {hoverRgb.b})
            </span>
          )}
        </div>
      </div>

      {/* Direct Coordinate & Region Size Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-slate-700">선택 영역 크기</span>
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-md border border-slate-200">
            <button
              type="button"
              onClick={() => onChangeSelectionSize(3)}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                selectionSize === 3
                  ? 'bg-white text-blue-900 border border-slate-200 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              3×3 영역
            </button>
            <button
              type="button"
              onClick={() => onChangeSelectionSize(5)}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                selectionSize === 5
                  ? 'bg-white text-blue-900 border border-slate-200 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              5×5 영역
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-slate-700">좌표 직접 이동 (1~{CORRIDOR_WIDTH})</span>
          <div className="flex items-center gap-1.5">
            <label className="flex items-center gap-1 text-xs text-slate-600 flex-1">
              <span className="whitespace-nowrap">행</span>
              <input
                type="number"
                min={1}
                max={CORRIDOR_HEIGHT}
                value={activeCoord.row}
                onChange={(e) => handleRowInput(e.target.value)}
                aria-label="선택 픽셀 행 좌표"
                className="w-full px-2 py-1 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-600"
              />
            </label>
            <label className="flex items-center gap-1 text-xs text-slate-600 flex-1">
              <span className="whitespace-nowrap">열</span>
              <input
                type="number"
                min={1}
                max={CORRIDOR_WIDTH}
                value={activeCoord.col}
                onChange={(e) => handleColInput(e.target.value)}
                aria-label="선택 픽셀 열 좌표"
                className="w-full px-2 py-1 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-600"
              />
            </label>
          </div>
        </div>
      </div>

      {/* >= 8x Magnified Grid View with Exact Pixel Boundaries and Coordinates (Above Presets for Immediate Visibility) */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-200">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold text-slate-900">
            선택 영역 확대 뷰 ({selectionSize}×{selectionSize} · {selectionSize === 3 ? '44배' : '34배'} 확대)
          </h3>
          <span className="text-[11px] font-mono tabular-nums text-slate-500 whitespace-nowrap">
            중심 ({safeCenter.row}, {safeCenter.col})
          </span>
        </div>

        {alternatePixels && (
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="text-slate-500">확대 대상</span>
            <div className="inline-flex p-0.5 bg-slate-100 border border-slate-200 rounded">
              <button
                type="button"
                onClick={() => setZoomSource('original')}
                className={`px-2 py-0.5 rounded cursor-pointer whitespace-nowrap ${
                  zoomSource === 'original'
                    ? 'bg-white text-blue-900 font-semibold shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                원본 픽셀
              </button>
              <button
                type="button"
                onClick={() => setZoomSource('modified')}
                className={`px-2 py-0.5 rounded cursor-pointer whitespace-nowrap ${
                  zoomSource === 'modified'
                    ? 'bg-white text-blue-900 font-semibold shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                변환·수정 후
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto pb-1">
          <table
            className="mx-auto border-collapse select-none"
            aria-label="선택 영역 확대 픽셀 격자"
          >
            <thead>
              <tr>
                <th className="px-1.5 py-1 text-[11px] font-mono text-slate-500 font-normal border-b border-r border-slate-200 whitespace-nowrap">
                  행\열
                </th>
                {zoomMatrices.cols.map((c) => (
                  <th
                    key={c}
                    className="px-1 py-1 text-[11px] font-mono tabular-nums text-slate-600 font-medium border-b border-slate-200 text-center"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {zoomMatrices.rows.map((r, rIdx) => (
                <tr key={r}>
                  <th className="px-1.5 py-1 text-[11px] font-mono tabular-nums text-slate-600 font-medium border-r border-slate-200 text-right whitespace-nowrap">
                    {r}
                  </th>
                  {zoomMatrices.cols.map((c, cIdx) => {
                    const pr = zoomMatrices.r[rIdx][cIdx];
                    const pg = zoomMatrices.g[rIdx][cIdx];
                    const pb = zoomMatrices.b[rIdx][cIdx];
                    const isSelectedPixel =
                      activeCoord.row === r && activeCoord.col === c;
                    const cellSizePx = selectionSize === 3 ? 44 : 34;
                    const luminance = 0.299 * pr + 0.587 * pg + 0.114 * pb;
                    const textContrastClass =
                      luminance > 140 ? 'text-slate-900' : 'text-white';

                    return (
                      <td key={`${r}-${c}`} className="p-0 border border-slate-300">
                        <button
                          type="button"
                          onClick={() => onSelectCoord({ row: r, col: c })}
                          style={{
                            width: `${cellSizePx}px`,
                            height: `${cellSizePx}px`,
                            backgroundColor: `rgb(${pr}, ${pg}, ${pb})`,
                          }}
                          title={`(${r}, ${c}) = RGB(${pr}, ${pg}, ${pb})`}
                          aria-label={`픽셀 (${r}행, ${c}열) RGB (${pr}, ${pg}, ${pb})`}
                          className={`flex flex-col items-center justify-center font-mono tabular-nums leading-tight transition-transform cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600 ${textContrastClass} ${
                            isSelectedPixel
                              ? 'ring-2 ring-inset ring-amber-400 shadow-inner font-semibold'
                              : 'hover:opacity-90'
                          }`}
                        >
                          <span className="text-[10px]">
                            {r},{c}
                          </span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Teacher-Designated Quick Anchor Presets */}
      {presets.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-200">
          <span className="text-xs font-medium text-slate-700 flex items-center gap-1">
            <Crosshair className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
            <span>실험 지정 위치 바로가기</span>
          </span>
          <div className="flex flex-col gap-1.5">
            {presets.map((preset) => {
              const isActive =
                activeCoord.row === preset.coord.row &&
                activeCoord.col === preset.coord.col;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onSelectPreset(preset)}
                  className={`text-left px-2.5 py-2 rounded-md border text-xs transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-blue-50 border-blue-300 text-blue-950'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{preset.label}</span>
                    <span className="font-mono tabular-nums text-slate-500 whitespace-nowrap">
                      ({preset.coord.row}, {preset.coord.col})
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {preset.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};
