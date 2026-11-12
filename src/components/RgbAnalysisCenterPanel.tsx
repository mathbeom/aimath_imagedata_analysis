import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import {
  ChannelViewMode,
  PixelCoord,
  RgbPixel,
  SelectionSize,
} from '../types/lab';
import {
  clampByte,
  extractChannelMatrices,
  readPixel,
} from '../engine/imageMath';
import { MatrixDisplay } from './MatrixDisplay';

interface RgbAnalysisCenterPanelProps {
  originalPixels: Uint8ClampedArray;
  workingPixels: Uint8ClampedArray;
  activeCoord: PixelCoord;
  regionCenter: PixelCoord;
  selectionSize: SelectionSize;
  channelView: ChannelViewMode;
  onChangeChannelView: (mode: ChannelViewMode) => void;
  onSelectCoord: (coord: PixelCoord) => void;
  onUpdatePixel: (coord: PixelCoord, nextRgb: RgbPixel) => void;
  onResetPixel: (coord: PixelCoord) => void;
  onResetAll: () => void;
}

export const RgbAnalysisCenterPanel: React.FC<RgbAnalysisCenterPanelProps> = ({
  originalPixels,
  workingPixels,
  activeCoord,
  regionCenter,
  selectionSize,
  channelView,
  onChangeChannelView,
  onSelectCoord,
  onUpdatePixel,
  onResetPixel,
  onResetAll,
}) => {
  const [matrixSourceView, setMatrixSourceView] = useState<'working' | 'original' | 'compare'>('working');

  const origPixel = readPixel(originalPixels, activeCoord.row, activeCoord.col);
  const currPixel = readPixel(workingPixels, activeCoord.row, activeCoord.col);
  const isPixelModified =
    origPixel.r !== currPixel.r ||
    origPixel.g !== currPixel.g ||
    origPixel.b !== currPixel.b;

  const originalMatrices = extractChannelMatrices(
    originalPixels,
    regionCenter.row,
    regionCenter.col,
    selectionSize,
  );
  const workingMatrices = extractChannelMatrices(
    workingPixels,
    regionCenter.row,
    regionCenter.col,
    selectionSize,
  );

  const handleChannelChange = (channel: 'r' | 'g' | 'b', rawVal: string) => {
    const parsed = rawVal === '' ? 0 : parseInt(rawVal, 10);
    if (Number.isNaN(parsed)) return;
    const clamped = clampByte(parsed);
    onUpdatePixel(activeCoord, {
      ...currPixel,
      [channel]: clamped,
    });
  };

  return (
    <section
      aria-label="RGB 데이터 분석 연산 영역"
      className="flex flex-col gap-4 bg-white border border-slate-200 rounded-lg p-4"
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            2. 수학적 연산 · RGB 행렬 분석
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            채널별 행렬 계측 열람 및 개별 픽셀 RGB 성분 수정
          </p>
        </div>
      </div>

      {/* Selected Pixel RGB Editor */}
      <div className="flex flex-col gap-3 p-3 bg-slate-50 border border-slate-200 rounded-md">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-semibold text-slate-900">
              선택 픽셀 ({activeCoord.row}, {activeCoord.col}) RGB 수정기
            </h3>
            <p className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
              원본 RGB({origPixel.r}, {origPixel.g}, {origPixel.b}) → 현재 RGB({currPixel.r}, {currPixel.g}, {currPixel.b})
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="w-6 h-6 rounded border border-slate-300"
              style={{
                backgroundColor: `rgb(${origPixel.r}, ${origPixel.g}, ${origPixel.b})`,
              }}
              title={`원본 색: RGB(${origPixel.r}, ${origPixel.g}, ${origPixel.b})`}
            />
            <span className="text-xs text-slate-400" aria-hidden="true">→</span>
            <span
              className="w-6 h-6 rounded border border-slate-300"
              style={{
                backgroundColor: `rgb(${currPixel.r}, ${currPixel.g}, ${currPixel.b})`,
              }}
              title={`현재 색: RGB(${currPixel.r}, ${currPixel.g}, ${currPixel.b})`}
            />
          </div>
        </div>

        {/* R, G, B Sliders & Numeric Inputs */}
        <div className="flex flex-col gap-2.5">
          {([
            {
              key: 'r' as const,
              label: 'R (빨강)',
              val: currPixel.r,
              orig: origPixel.r,
              accent: 'accent-rose-600',
              text: 'text-rose-700',
            },
            {
              key: 'g' as const,
              label: 'G (초록)',
              val: currPixel.g,
              orig: origPixel.g,
              accent: 'accent-emerald-600',
              text: 'text-emerald-700',
            },
            {
              key: 'b' as const,
              label: 'B (파랑)',
              val: currPixel.b,
              orig: origPixel.b,
              accent: 'accent-blue-600',
              text: 'text-blue-700',
            },
          ]).map((ch) => (
            <div key={ch.key} className="grid grid-cols-[68px_minmax(0,1fr)_68px] items-center gap-2">
              <label
                htmlFor={`pixel-edit-${ch.key}`}
                className={`text-xs font-semibold ${ch.text}`}
              >
                {ch.label}
              </label>
              <input
                type="range"
                min={0}
                max={255}
                step={1}
                value={ch.val}
                onChange={(e) => handleChannelChange(ch.key, e.target.value)}
                aria-label={`${ch.label} 슬라이더 (0~255)`}
                className={`w-full cursor-pointer ${ch.accent}`}
              />
              <input
                id={`pixel-edit-${ch.key}`}
                type="number"
                min={0}
                max={255}
                step={1}
                value={ch.val}
                onChange={(e) => handleChannelChange(ch.key, e.target.value)}
                aria-label={`${ch.label} 숫자 입력 (0~255)`}
                className="w-full px-2 py-1 text-xs font-mono tabular-nums text-right bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-600"
              />
            </div>
          ))}
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
            <span>허용 범위: 0 ~ 255 정수 (즉시 작업 이미지에 반영)</span>
            <div className="flex items-center gap-2">
              {isPixelModified && (
                <button
                  type="button"
                  onClick={() => onResetPixel(activeCoord)}
                  className="text-blue-700 hover:text-blue-900 font-medium underline underline-offset-2 cursor-pointer"
                >
                  이 픽셀 복원
                </button>
              )}
              <button
                type="button"
                onClick={onResetAll}
                className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" aria-hidden="true" />
                <span>전체 초기화</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Channel Filter & Matrix Mode Selector */}
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-900">
            선택 영역 ({selectionSize}×{selectionSize}) 계측 행렬 열람
          </span>
          <div
            role="group"
            aria-label="행렬 상태 보기 전환"
            className="inline-flex p-0.5 bg-slate-100 border border-slate-200 rounded-md text-[11px]"
          >
            {(
              [
                { id: 'working', label: '작업 행렬' },
                { id: 'original', label: '원본 행렬' },
                { id: 'compare', label: '전후 비교' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setMatrixSourceView(opt.id)}
                className={`px-2 py-1 rounded transition-colors cursor-pointer whitespace-nowrap ${
                  matrixSourceView === opt.id
                    ? 'bg-white text-blue-900 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Channel View Filter */}
        <div
          role="group"
          aria-label="RGB 채널 필터"
          className="grid grid-cols-4 gap-1 p-1 bg-slate-100 border border-slate-200 rounded-md"
        >
          {(
            [
              { id: 'all', label: 'RGB 함께' },
              { id: 'r', label: 'R 채널' },
              { id: 'g', label: 'G 채널' },
              { id: 'b', label: 'B 채널' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangeChannelView(tab.id)}
              className={`px-2 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                channelView === tab.id
                  ? 'bg-white text-blue-900 border border-slate-200 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Matrices Display */}
        {matrixSourceView === 'original' && (
          <MatrixDisplay
            matrices={originalMatrices}
            channelView={channelView}
            activeCoord={activeCoord}
            labelPrefix="원본 "
            onSelectCell={onSelectCoord}
          />
        )}

        {matrixSourceView === 'working' && (
          <MatrixDisplay
            matrices={workingMatrices}
            compareMatrices={originalMatrices}
            channelView={channelView}
            activeCoord={activeCoord}
            labelPrefix="현재 "
            symbolSuffix="′"
            onSelectCell={onSelectCoord}
          />
        )}

        {matrixSourceView === 'compare' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <MatrixDisplay
              matrices={originalMatrices}
              channelView={channelView}
              activeCoord={activeCoord}
              labelPrefix="수정 전 "
              onSelectCell={onSelectCoord}
            />
            <MatrixDisplay
              matrices={workingMatrices}
              compareMatrices={originalMatrices}
              channelView={channelView}
              activeCoord={activeCoord}
              labelPrefix="수정 후 "
              symbolSuffix="′"
              onSelectCell={onSelectCoord}
            />
          </div>
        )}
      </div>
    </section>
  );
};
