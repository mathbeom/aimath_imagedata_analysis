import React, { useEffect, useRef, useState } from 'react';
import {
  CORRIDOR_HEIGHT,
  CORRIDOR_WIDTH,
} from '../data/corridorImage';
import { ResultCompareMode } from '../types/lab';

interface ResultViewportProps {
  originalPixels: Uint8ClampedArray;
  resultPixels: Uint8ClampedArray;
  resultLabel: string;
}

export const ResultViewport: React.FC<ResultViewportProps> = ({
  originalPixels,
  resultPixels,
  resultLabel,
}) => {
  const [compareMode, setCompareMode] = useState<ResultCompareMode>('result');
  const [splitPercent, setSplitPercent] = useState<number>(50);

  const resultCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const origCompareCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const splitCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (resultCanvasRef.current) {
      const ctx = resultCanvasRef.current.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        ctx.putImageData(
          new ImageData(new Uint8ClampedArray(resultPixels), CORRIDOR_WIDTH, CORRIDOR_HEIGHT),
          0,
          0,
        );
      }
    }
    if (origCompareCanvasRef.current) {
      const ctx = origCompareCanvasRef.current.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        ctx.putImageData(
          new ImageData(new Uint8ClampedArray(originalPixels), CORRIDOR_WIDTH, CORRIDOR_HEIGHT),
          0,
          0,
        );
      }
    }
    if (splitCanvasRef.current) {
      const ctx = splitCanvasRef.current.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        const splitCol = Math.round((splitPercent / 100) * CORRIDOR_WIDTH);
        const merged = new Uint8ClampedArray(resultPixels.length);
        for (let row = 0; row < CORRIDOR_HEIGHT; row += 1) {
          for (let col = 0; col < CORRIDOR_WIDTH; col += 1) {
            const idx = (row * CORRIDOR_WIDTH + col) * 4;
            const src = col < splitCol ? originalPixels : resultPixels;
            merged[idx] = src[idx];
            merged[idx + 1] = src[idx + 1];
            merged[idx + 2] = src[idx + 2];
            merged[idx + 3] = 255;
          }
        }
        ctx.putImageData(
          new ImageData(merged, CORRIDOR_WIDTH, CORRIDOR_HEIGHT),
          0,
          0,
        );
      }
    }
  }, [originalPixels, resultPixels, compareMode, splitPercent]);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-slate-900">{resultLabel}</h3>
        <div
          role="group"
          aria-label="결과 비교 방식"
          className="inline-flex p-0.5 bg-slate-100 border border-slate-200 rounded-md text-[11px]"
        >
          {(
            [
              { id: 'result', label: '결과 크게' },
              { id: 'side-by-side', label: '나란히 비교' },
              { id: 'split', label: '분할 비교' },
            ] as const
          ).map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setCompareMode(mode.id)}
              className={`px-2 py-1 rounded transition-colors cursor-pointer whitespace-nowrap ${
                compareMode === mode.id
                  ? 'bg-white text-blue-900 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {compareMode === 'result' && (
        <div className="w-full aspect-square max-w-[256px] mx-auto bg-slate-200 border-2 border-slate-300 rounded overflow-hidden">
          <canvas
            ref={resultCanvasRef}
            width={CORRIDOR_WIDTH}
            height={CORRIDOR_HEIGHT}
            data-testid="result-image-canvas"
            className="w-full h-full block pixelated-canvas"
            aria-label={`${resultLabel} 64×64 캔버스`}
          />
        </div>
      )}

      {compareMode === 'side-by-side' && (
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-slate-600 text-center">
              원본 이미지
            </span>
            <div className="aspect-square bg-slate-200 border-2 border-slate-300 rounded overflow-hidden">
              <canvas
                ref={origCompareCanvasRef}
                width={CORRIDOR_WIDTH}
                height={CORRIDOR_HEIGHT}
                className="w-full h-full block pixelated-canvas"
                aria-label="원본 비교 캔버스"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-blue-900 text-center">
              {resultLabel}
            </span>
            <div className="aspect-square bg-slate-200 border-2 border-blue-400 rounded overflow-hidden">
              <canvas
                ref={resultCanvasRef}
                width={CORRIDOR_WIDTH}
                height={CORRIDOR_HEIGHT}
                data-testid="result-image-canvas"
                className="w-full h-full block pixelated-canvas"
                aria-label={`${resultLabel} 비교 캔버스`}
              />
            </div>
          </div>
        </div>
      )}

      {compareMode === 'split' && (
        <div className="flex flex-col gap-2">
          <div className="relative w-full aspect-square max-w-[256px] mx-auto bg-slate-200 border-2 border-slate-300 rounded overflow-hidden">
            <canvas
              ref={splitCanvasRef}
              width={CORRIDOR_WIDTH}
              height={CORRIDOR_HEIGHT}
              data-testid="result-image-canvas"
              className="w-full h-full block pixelated-canvas"
              aria-label="원본(왼쪽)과 결과(오른쪽) 분할 비교 캔버스"
            />
            <div
              style={{ left: `${splitPercent}%` }}
              className="pointer-events-none absolute inset-y-0 w-0.5 bg-amber-400 shadow-[0_0_0_1px_rgba(15,23,42,0.5)]"
            />
            <div className="pointer-events-none absolute top-2 left-2 px-1.5 py-0.5 bg-slate-900/75 text-white text-[10px] rounded">
              원본
            </div>
            <div className="pointer-events-none absolute top-2 right-2 px-1.5 py-0.5 bg-blue-900/80 text-white text-[10px] rounded">
              변환 결과
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600 max-w-[256px] mx-auto w-full">
            <span className="whitespace-nowrap">분할선</span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={splitPercent}
              onChange={(e) => setSplitPercent(parseInt(e.target.value, 10))}
              aria-label="원본과 결과 분할 비교 슬라이더"
              className="w-full accent-blue-700 cursor-pointer"
            />
            <span className="font-mono tabular-nums w-10 text-right">{splitPercent}%</span>
          </label>
        </div>
      )}
    </div>
  );
};
