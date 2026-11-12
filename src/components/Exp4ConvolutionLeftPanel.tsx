import React, { useEffect, useRef, useState } from 'react';
import { Crosshair, RotateCcw } from 'lucide-react';
import {
  CORRIDOR_HEIGHT,
  CORRIDOR_WIDTH,
} from '../data/corridorImage';
import { EXP4_EVAL_CENTER, EXP4_INITIAL_X } from '../data/experimentAssets';
import {
  Grayscale5x5Patch,
  grayscaleToRgbaPixels,
} from '../engine/convolutionMath';
import { clampCenterCoord } from '../engine/imageMath';
import { PixelCoord } from '../types/lab';

interface Exp4ConvolutionLeftPanelProps {
  grayscale: Uint8Array;
  patch: Grayscale5x5Patch;
  xValue: number;
  selectedOutRow: number;
  selectedOutCol: number;
  onSelectPatchCenter: (center: PixelCoord) => void;
  onChangeXValue: (nextX: number) => void;
  onResetAll: () => void;
}

const EXP4_PRESETS: Array<{ id: string; label: string; desc: string; coord: PixelCoord }> = [
  {
    id: 'eval-patch',
    label: '평가 지정 5×5 영역 (x 포함)',
    desc: `20과 140이 만나는 수직 경계 · 중앙 (${EXP4_EVAL_CENTER.row}, ${EXP4_EVAL_CENTER.col}) 픽셀이 x`,
    coord: EXP4_EVAL_CENTER,
  },
  {
    id: 'sign-edge',
    label: '표지판 왼쪽 경계 영역',
    desc: '밝은 안내 표지판과 회색 복도 벽면의 경계 변화 관찰',
    coord: { row: 24, col: 25 },
  },
  {
    id: 'door-frame',
    label: '복도 문틀 수직 경계',
    desc: '세로 경계 필터 K₂가 반응하는 교실 문틀 모서리',
    coord: { row: 28, col: 17 },
  },
];

export const Exp4ConvolutionLeftPanel: React.FC<Exp4ConvolutionLeftPanelProps> = ({
  grayscale,
  patch,
  xValue,
  selectedOutRow,
  selectedOutCol,
  onSelectPatchCenter,
  onChangeXValue,
  onResetAll,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const [hoverCoord, setHoverCoord] = useState<PixelCoord | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rgba = grayscaleToRgbaPixels(grayscale);
    ctx.imageSmoothingEnabled = false;
    ctx.putImageData(
      new ImageData(new Uint8ClampedArray(rgba), CORRIDOR_WIDTH, CORRIDOR_HEIGHT),
      0,
      0,
    );
  }, [grayscale]);

  const coordFromPointer = (
    clientX: number,
    clientY: number,
    rect: DOMRect,
  ): PixelCoord => {
    const normX = Math.max(0, Math.min(rect.width - 0.001, clientX - rect.left));
    const normY = Math.max(0, Math.min(rect.height - 0.001, clientY - rect.top));
    const col1 = Math.floor((normX / rect.width) * CORRIDOR_WIDTH) + 1;
    const row1 = Math.floor((normY / rect.height) * CORRIDOR_HEIGHT) + 1;
    return clampCenterCoord(row1, col1, 5);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    const rect = e.currentTarget.getBoundingClientRect();
    const coord = coordFromPointer(e.clientX, e.clientY, rect);
    setHoverCoord(coord);
    onSelectPatchCenter(coord);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const coord = coordFromPointer(e.clientX, e.clientY, rect);
    setHoverCoord(coord);
    if (isDraggingRef.current) {
      onSelectPatchCenter(coord);
    }
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  // 5x5 selection box percentages
  const boxLeftPct = ((patch.center.col - 2 - 1) / CORRIDOR_WIDTH) * 100;
  const boxTopPct = ((patch.center.row - 2 - 1) / CORRIDOR_HEIGHT) * 100;
  const boxSizePct = (5 / CORRIDOR_WIDTH) * 100;

  const isEvalPatchSelected =
    patch.center.row === EXP4_EVAL_CENTER.row &&
    patch.center.col === EXP4_EVAL_CENTER.col;

  return (
    <section
      aria-label="흑백 원본 이미지 및 5x5 분석 영역 선택"
      className="flex flex-col gap-4 bg-white border border-slate-200 rounded-lg p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900">
            1. 흑백 이미지 · 5×5 영역
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            64×64 흑백 · 클릭해 5×5 영역 선택
          </p>
        </div>
        <button
          type="button"
          onClick={onResetAll}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>초기화</span>
        </button>
      </div>

      {/* 128x128 Grayscale Canvas */}
      <div className="flex flex-col gap-2">
        <div className="relative w-full aspect-square max-w-[256px] mx-auto bg-slate-200 border-2 border-slate-300 rounded overflow-hidden select-none touch-none">
          <canvas
            ref={canvasRef}
            width={CORRIDOR_WIDTH}
            height={CORRIDOR_HEIGHT}
            data-testid="exp4-grayscale-canvas"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerLeave={() => setHoverCoord(null)}
            className="w-full h-full block pixelated-canvas cursor-crosshair"
            aria-label="학교 복도 흑백 64×64 원본 이미지"
          />
          <div className="pointer-events-none absolute inset-0">
            <div
              style={{
                left: `${boxLeftPct}%`,
                top: `${boxTopPct}%`,
                width: `${boxSizePct}%`,
                height: `${boxSizePct}%`,
              }}
              className="absolute border-2 border-blue-500 bg-blue-500/15 shadow-[0_0_0_1px_rgba(255,255,255,0.9)]"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-[11px] font-mono tabular-nums">
          <span className="text-slate-800 font-medium">
            5×5 중심 ({patch.center.row}, {patch.center.col})
          </span>
          <span className="text-slate-500">
            {hoverCoord
              ? `커서 (${hoverCoord.row}, ${hoverCoord.col})`
              : `${patch.rows[0]}~${patch.rows[4]}행, ${patch.cols[0]}~${patch.cols[4]}열`}
          </span>
        </div>

        {/* Direct Center Coordinates */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <label className="flex items-center justify-between gap-1.5 bg-slate-50 border border-slate-200 rounded px-2 py-1">
            <span className="text-slate-600 whitespace-nowrap">중심 행 (3~{CORRIDOR_HEIGHT - 2})</span>
            <input
              type="number"
              min={3}
              max={CORRIDOR_HEIGHT - 2}
              value={patch.center.row}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!Number.isNaN(v)) {
                  onSelectPatchCenter(clampCenterCoord(v, patch.center.col, 5));
                }
              }}
              aria-label="5x5 영역 중심 행"
              className="w-16 px-1.5 py-0.5 text-xs font-mono tabular-nums text-right bg-white border border-slate-300 rounded"
            />
          </label>
          <label className="flex items-center justify-between gap-1.5 bg-slate-50 border border-slate-200 rounded px-2 py-1">
            <span className="text-slate-600 whitespace-nowrap">중심 열 (3~{CORRIDOR_WIDTH - 2})</span>
            <input
              type="number"
              min={3}
              max={CORRIDOR_WIDTH - 2}
              value={patch.center.col}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!Number.isNaN(v)) {
                  onSelectPatchCenter(clampCenterCoord(patch.center.row, v, 5));
                }
              }}
              aria-label="5x5 영역 중심 열"
              className="w-16 px-1.5 py-0.5 text-xs font-mono tabular-nums text-right bg-white border border-slate-300 rounded"
            />
          </label>
        </div>
      </div>

      {/* Magnified 5x5 Grayscale Values Matrix (highlights active 3x3 subwindow & editable x) */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-200">
        <div className="flex flex-wrap items-baseline justify-between gap-1.5 text-xs">
          <h3 className="font-semibold text-slate-900 whitespace-nowrap">
            선택된 5×5 영역 픽셀값
          </h3>
          <span className="text-[11px] font-mono text-blue-800 whitespace-nowrap">
            파란 테두리: 3×3 필터 위치
          </span>
        </div>

        <div className="overflow-x-auto pb-1">
          <table
            className="mx-auto border-collapse font-mono tabular-nums text-xs"
            aria-label="선택된 5x5 흑백 픽셀값 행렬"
          >
            <thead>
              <tr>
                <th className="px-1.5 py-1 text-[10px] font-normal text-slate-400 border-b border-r border-slate-200 whitespace-nowrap">
                  행\열
                </th>
                {patch.cols.map((c) => (
                  <th
                    key={c}
                    className="px-1 py-1 text-[11px] font-medium text-slate-600 border-b border-slate-200 text-center"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {patch.rows.map((r, rIdx) => (
                <tr key={r}>
                  <th className="px-1.5 py-1 text-[11px] font-medium text-slate-600 border-r border-slate-200 text-right whitespace-nowrap">
                    {r}
                  </th>
                  {patch.cols.map((c, cIdx) => {
                    const val = patch.values[rIdx][cIdx];
                    const inActive3x3 =
                      rIdx >= selectedOutRow &&
                      rIdx <= selectedOutRow + 2 &&
                      cIdx >= selectedOutCol &&
                      cIdx <= selectedOutCol + 2;
                    const isCenterX =
                      r === EXP4_EVAL_CENTER.row && c === EXP4_EVAL_CENTER.col;
                    const textContrast =
                      val > 135 ? 'text-slate-900' : 'text-white';

                    return (
                      <td
                        key={`${r}-${c}`}
                        className={`p-0 border ${
                          inActive3x3 ? 'border-blue-600' : 'border-slate-300'
                        }`}
                      >
                        <div
                          style={{
                            width: '40px',
                            height: '40px',
                            backgroundColor: `rgb(${val}, ${val}, ${val})`,
                          }}
                          title={
                            isCenterX
                              ? `중앙 수정 픽셀 x (${r}, ${c}) = ${val}`
                              : `(${r}, ${c}) = ${val}`
                          }
                          className={`flex flex-col items-center justify-center leading-tight ${textContrast} ${
                            isCenterX
                              ? 'ring-2 ring-inset ring-amber-400 font-bold'
                              : inActive3x3
                                ? 'ring-1 ring-inset ring-blue-300 font-semibold'
                                : ''
                          }`}
                        >
                          <span className="text-xs">{val}</span>
                          {isCenterX && (
                            <span className="text-[9px] text-amber-300 font-sans leading-none">
                              x
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Editable Center Pixel x Control (ONLY (50, 42) is editable) */}
      <div className="flex flex-col gap-2 p-3 bg-slate-50 border border-slate-200 rounded-md">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-slate-900">
            수정 가능한 중앙 픽셀 x ({EXP4_EVAL_CENTER.row}, {EXP4_EVAL_CENTER.col})
          </span>
          <button
            type="button"
            onClick={() => onChangeXValue(EXP4_INITIAL_X)}
            className="text-[11px] text-slate-600 hover:text-slate-900 underline cursor-pointer"
          >
            x = {EXP4_INITIAL_X} 복원
          </button>
        </div>

        <p className="text-[11px] text-slate-600 leading-relaxed">
          원본 이미지에서 <span className="font-mono font-semibold text-slate-900">({EXP4_EVAL_CENTER.row}행, {EXP4_EVAL_CENTER.col}열)</span>의 픽셀값 <span className="font-mono font-semibold">x</span>만 바꿀 수 있으며, 나머지 픽셀은 고정되어 있습니다.
        </p>

        <div className="grid grid-cols-[minmax(0,1fr)_72px] items-center gap-2">
          <input
            type="range"
            min={0}
            max={255}
            step={5}
            value={xValue}
            onChange={(e) => onChangeXValue(parseInt(e.target.value, 10))}
            aria-label="중앙 픽셀 x 값 슬라이더"
            className="w-full accent-blue-700 cursor-pointer"
          />
          <input
            type="number"
            min={0}
            max={255}
            step={1}
            value={xValue}
            onChange={(e) => {
              const parsed = parseInt(e.target.value, 10);
              if (!Number.isNaN(parsed)) {
                onChangeXValue(Math.max(0, Math.min(255, parsed)));
              }
            }}
            data-testid="exp4-x-input"
            aria-label="중앙 픽셀 x 값 숫자 입력"
            className="w-full px-2 py-1 text-xs font-mono tabular-nums text-right bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-600"
          />
        </div>

        {!isEvalPatchSelected && (
          <button
            type="button"
            onClick={() => onSelectPatchCenter(EXP4_EVAL_CENTER)}
            className="text-left text-[11px] font-medium text-blue-700 hover:underline cursor-pointer"
          >
            x가 포함된 평가 5×5 영역 ({EXP4_EVAL_CENTER.row}, {EXP4_EVAL_CENTER.col})으로 이동하기
          </button>
        )}
      </div>

      {/* Presets */}
      <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-200">
        <span className="text-xs font-medium text-slate-700 flex items-center gap-1">
          <Crosshair className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
          <span>관찰 영역 바로가기</span>
        </span>
        <div className="flex flex-col gap-1.5">
          {EXP4_PRESETS.map((p) => {
            const isActive =
              patch.center.row === p.coord.row && patch.center.col === p.coord.col;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectPatchCenter(p.coord)}
                className={`text-left px-2.5 py-2 rounded-md border text-xs transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-blue-50 border-blue-300 text-blue-950'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{p.label}</span>
                  <span className="font-mono tabular-nums text-slate-500 whitespace-nowrap">
                    ({p.coord.row}, {p.coord.col})
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">{p.desc}</p>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
