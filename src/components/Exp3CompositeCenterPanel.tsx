import React from 'react';
import {
  ChannelViewMode,
  PixelCoord,
} from '../types/lab';
import {
  Composite4x4Inspection,
} from '../engine/compositeMath';
import { MatrixDisplay } from './MatrixDisplay';

interface Exp3CompositeCenterPanelProps {
  inspection: Composite4x4Inspection;
  activeCoord: PixelCoord;
  channelView: ChannelViewMode;
  onChangeChannelView: (mode: ChannelViewMode) => void;
  onSelectCoord: (coord: PixelCoord) => void;
}

export const Exp3CompositeCenterPanel: React.FC<Exp3CompositeCenterPanelProps> = ({
  inspection,
  activeCoord,
  channelView,
  onChangeChannelView,
  onSelectCoord,
}) => {
  // Locate active pixel inside the 4x4 grid (fallback to first cell if outside)
  let selectedCell = inspection.cells[0][0];
  for (const row of inspection.cells) {
    for (const cell of row) {
      if (cell.row === activeCoord.row && cell.col === activeCoord.col) {
        selectedCell = cell;
      }
    }
  }

  return (
    <section
      aria-label="아다마르 곱 연산 및 4x4 행렬 비교 영역"
      className="flex flex-col gap-3 bg-white border border-slate-200 rounded-lg p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            2. 아다마르 곱 · 4×4 마스크 및 RGB 행렬
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            R·G·B 각 채널에 공통 이진 마스크 P(0 또는 1)를 성분별로 곱하여 합성
          </p>
        </div>
        <span className="text-xs font-mono tabular-nums text-slate-500 whitespace-nowrap shrink-0">
          4×4 ({inspection.rows[0]}~{inspection.rows[3]}행, {inspection.cols[0]}~{inspection.cols[3]}열)
        </span>
      </div>

      {/* Hadamard Formula Card */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-md">
        <div className="text-xs text-slate-700">
          <span className="font-semibold text-slate-900">채널별 합성 식</span>
          <span className="text-slate-500 ml-2">
            (J: 모든 성분이 1인 행렬 · ⊙: 성분별 곱 · 빈칸은 답안란에서 선택)
          </span>
        </div>
        <div className="text-sm font-mono font-semibold text-blue-950">
          Z = X ⊙ <span className="px-1.5 border border-blue-300 rounded bg-white">?</span> + Y ⊙{' '}
          <span className="px-1.5 border border-blue-300 rounded bg-white">?</span>
        </div>
      </div>

      {/* 4x4 Visual Zoom Comparison: X, P, Y, Z */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-900">
            4×4 확대 픽셀 시각 비교 (셀 클릭 시 아래 계산식 갱신)
          </span>
          <span className="font-mono text-[11px] text-slate-500 whitespace-nowrap">
            선택 ({selectedCell.row}, {selectedCell.col})
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* X Zoom */}
          <div className="flex flex-col gap-1 p-1.5 bg-slate-50 border border-slate-200 rounded">
            <span className="text-[11px] font-semibold text-slate-800 text-center">
              원본 X (4×4)
            </span>
            <div className="grid grid-cols-4 gap-0.5 mx-auto">
              {inspection.cells.flat().map((cell) => {
                const isSel = cell.row === selectedCell.row && cell.col === selectedCell.col;
                return (
                  <button
                    key={`vx-${cell.row}-${cell.col}`}
                    type="button"
                    onClick={() => onSelectCoord({ row: cell.row, col: cell.col })}
                    style={{
                      backgroundColor: `rgb(${cell.x.r}, ${cell.x.g}, ${cell.x.b})`,
                    }}
                    title={`X(${cell.row},${cell.col}) = (${cell.x.r}, ${cell.x.g}, ${cell.x.b})`}
                    aria-label={`원본 X (${cell.row}, ${cell.col})`}
                    className={`w-6 h-6 border cursor-pointer ${
                      isSel ? 'border-amber-400 ring-2 ring-amber-400' : 'border-slate-300'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {/* P Mask Zoom */}
          <div className="flex flex-col gap-1 p-1.5 bg-slate-50 border border-slate-200 rounded">
            <span className="text-[11px] font-semibold text-slate-800 text-center">
              마스크 P (0/1)
            </span>
            <div className="grid grid-cols-4 gap-0.5 mx-auto">
              {inspection.cells.flat().map((cell) => {
                const isSel = cell.row === selectedCell.row && cell.col === selectedCell.col;
                return (
                  <button
                    key={`vp-${cell.row}-${cell.col}`}
                    type="button"
                    onClick={() => onSelectCoord({ row: cell.row, col: cell.col })}
                    title={`P(${cell.row},${cell.col}) = ${cell.p}`}
                    aria-label={`마스크 P (${cell.row}, ${cell.col}) 값 ${cell.p}`}
                    className={`w-6 h-6 text-[11px] font-mono font-semibold flex items-center justify-center border cursor-pointer ${
                      cell.p === 1
                        ? 'bg-blue-900 text-white'
                        : 'bg-white text-slate-600'
                    } ${
                      isSel ? 'border-amber-400 ring-2 ring-amber-400' : 'border-slate-300'
                    }`}
                  >
                    {cell.p}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Y Zoom */}
          <div className="flex flex-col gap-1 p-1.5 bg-slate-50 border border-slate-200 rounded">
            <span className="text-[11px] font-semibold text-slate-800 text-center">
              배경 Y (4×4)
            </span>
            <div className="grid grid-cols-4 gap-0.5 mx-auto">
              {inspection.cells.flat().map((cell) => {
                const isSel = cell.row === selectedCell.row && cell.col === selectedCell.col;
                return (
                  <button
                    key={`vy-${cell.row}-${cell.col}`}
                    type="button"
                    onClick={() => onSelectCoord({ row: cell.row, col: cell.col })}
                    style={{
                      backgroundColor: `rgb(${cell.y.r}, ${cell.y.g}, ${cell.y.b})`,
                    }}
                    title={`Y(${cell.row},${cell.col}) = (${cell.y.r}, ${cell.y.g}, ${cell.y.b})`}
                    aria-label={`배경 Y (${cell.row}, ${cell.col})`}
                    className={`w-6 h-6 border cursor-pointer ${
                      isSel ? 'border-amber-400 ring-2 ring-amber-400' : 'border-slate-300'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {/* Z Zoom */}
          <div className="flex flex-col gap-1 p-1.5 bg-blue-50/70 border border-blue-200 rounded">
            <span className="text-[11px] font-semibold text-blue-950 text-center">
              합성 결과 Z (4×4)
            </span>
            <div className="grid grid-cols-4 gap-0.5 mx-auto">
              {inspection.cells.flat().map((cell) => {
                const isSel = cell.row === selectedCell.row && cell.col === selectedCell.col;
                return (
                  <button
                    key={`vz-${cell.row}-${cell.col}`}
                    type="button"
                    onClick={() => onSelectCoord({ row: cell.row, col: cell.col })}
                    style={{
                      backgroundColor: `rgb(${cell.z.r}, ${cell.z.g}, ${cell.z.b})`,
                    }}
                    title={`Z(${cell.row},${cell.col}) = (${cell.z.r}, ${cell.z.g}, ${cell.z.b})`}
                    aria-label={`합성 Z (${cell.row}, ${cell.col})`}
                    className={`w-6 h-6 border cursor-pointer ${
                      isSel ? 'border-amber-400 ring-2 ring-amber-400' : 'border-blue-300'
                    }`}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 4x4 Numeric Mask Matrix P */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-900">
            확대 영역의 4×4 이진 마스크 행렬 P
          </span>
          <span className="font-mono text-[11px] text-slate-500">
            1: X 유지 · 0: Y로 교체
          </span>
        </div>

        <div className="overflow-x-auto bg-slate-50 border border-slate-200 rounded-md p-1.5">
          <div className="inline-flex items-stretch gap-1 min-w-full justify-center">
            <div
              aria-hidden="true"
              className="w-2 border-y-2 border-l-2 border-slate-700 rounded-l-xs my-3"
            />
            <table className="border-collapse font-mono tabular-nums text-xs">
              <thead>
                <tr>
                  <th className="text-[10px] font-normal text-slate-400 pb-0.5 text-right pr-1.5 whitespace-nowrap">
                    행\열
                  </th>
                  {inspection.cols.map((c) => (
                    <th key={c} className="px-1.5 pb-0.5 text-[10px] font-medium text-slate-500 text-center">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inspection.rows.map((r, rIdx) => (
                  <tr key={r}>
                    <th className="text-[10px] font-medium text-slate-500 text-right pr-1.5 whitespace-nowrap">
                      {r}
                    </th>
                    {inspection.cols.map((c, cIdx) => {
                      const val = inspection.pMatrix[rIdx][cIdx];
                      const isSel = selectedCell.row === r && selectedCell.col === c;
                      return (
                        <td key={`${r}-${c}`} className="p-0.5">
                          <button
                            type="button"
                            onClick={() => onSelectCoord({ row: r, col: c })}
                            className={`min-w-[34px] px-2 py-0.5 rounded text-center transition-colors cursor-pointer ${
                              isSel
                                ? 'ring-2 ring-amber-400 font-bold'
                                : ''
                            } ${
                              val === 1
                                ? 'bg-blue-900 text-white font-semibold'
                                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            {val}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div
              aria-hidden="true"
              className="w-2 border-y-2 border-r-2 border-slate-700 rounded-r-xs my-3"
            />
          </div>
        </div>
      </div>

      {/* Selected Pixel Arithmetic Breakdown */}
      <div className="flex flex-col gap-1.5 p-3 bg-slate-50 border border-slate-200 rounded-md">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-900">
            선택 픽셀 ({selectedCell.row}, {selectedCell.col}) 아다마르 곱 계산 과정
          </span>
          <span className="font-mono text-[11px] font-semibold text-blue-900">
            마스크 P = {selectedCell.p}
          </span>
        </div>
        <div className="overflow-x-auto bg-white border border-slate-200 rounded">
          <table className="w-full text-xs font-mono tabular-nums border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px]">
                <th className="py-1 px-2 text-left font-medium">채널</th>
                <th className="py-1 px-2 text-right font-medium">X</th>
                <th className="py-1 px-2 text-right font-medium">Y</th>
                <th className="py-1 px-2 text-left font-medium">성분별 계산</th>
                <th className="py-1 px-2 text-right font-medium">결과 Z</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(
                [
                  { label: 'R', color: 'text-rose-700', x: selectedCell.x.r, y: selectedCell.y.r, z: selectedCell.z.r },
                  { label: 'G', color: 'text-emerald-700', x: selectedCell.x.g, y: selectedCell.y.g, z: selectedCell.z.g },
                  { label: 'B', color: 'text-blue-700', x: selectedCell.x.b, y: selectedCell.y.b, z: selectedCell.z.b },
                ] as const
              ).map((ch) => (
                <tr key={ch.label}>
                  <td className={`py-1 px-2 font-semibold ${ch.color}`}>{ch.label}</td>
                  <td className="py-1 px-2 text-right">{ch.x}</td>
                  <td className="py-1 px-2 text-right">{ch.y}</td>
                  <td className="py-1 px-2 text-slate-600">
                    {ch.x}×{selectedCell.p} + {ch.y}×{1 - selectedCell.p}
                  </td>
                  <td className="py-1 px-2 text-right font-semibold text-slate-900">
                    {ch.z}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4x4 X, Y, Z RGB Matrices Comparison */}
      <div className="flex flex-col gap-2 pt-1 border-t border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-900">
            4×4 영역 X · Y · Z의 RGB 값 비교
          </span>
          <div
            role="group"
            aria-label="4x4 행렬 비교 채널"
            className="inline-flex p-0.5 bg-slate-100 border border-slate-200 rounded-md text-[11px]"
          >
            {(
              [
                { id: 'all', label: 'RGB 모두' },
                { id: 'r', label: 'R 채널' },
                { id: 'g', label: 'G 채널' },
                { id: 'b', label: 'B 채널' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChangeChannelView(tab.id)}
                className={`px-2 py-1 rounded transition-colors cursor-pointer whitespace-nowrap ${
                  channelView === tab.id
                    ? 'bg-white text-blue-900 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {channelView === 'all' ? (
          <div className="overflow-x-auto border border-slate-200 rounded-md">
            <table className="w-full text-[11px] font-mono tabular-nums border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="py-1 px-2 text-left font-medium whitespace-nowrap">좌표</th>
                  <th className="py-1 px-2 text-center font-medium">P</th>
                  <th className="py-1 px-2 text-left font-medium">원본 X RGB</th>
                  <th className="py-1 px-2 text-left font-medium">배경 Y RGB</th>
                  <th className="py-1 px-2 text-left font-medium text-blue-900">합성 Z RGB</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {inspection.cells.flat().map((cell) => {
                  const isSel = cell.row === selectedCell.row && cell.col === selectedCell.col;
                  return (
                    <tr
                      key={`tbl-${cell.row}-${cell.col}`}
                      onClick={() => onSelectCoord({ row: cell.row, col: cell.col })}
                      className={`cursor-pointer ${
                        isSel ? 'bg-amber-50' : 'bg-white hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-0.5 px-2 font-medium text-slate-800 whitespace-nowrap">
                        ({cell.row}, {cell.col})
                      </td>
                      <td className="py-0.5 px-2 text-center font-semibold">
                        <span className={cell.p === 1 ? 'text-blue-800' : 'text-slate-500'}>
                          {cell.p}
                        </span>
                      </td>
                      <td className={`py-0.5 px-2 whitespace-nowrap ${cell.p === 1 ? 'font-semibold text-slate-900' : 'text-slate-400'}`}>
                        ({cell.x.r}, {cell.x.g}, {cell.x.b})
                      </td>
                      <td className={`py-0.5 px-2 whitespace-nowrap ${cell.p === 0 ? 'font-semibold text-slate-900' : 'text-slate-400'}`}>
                        ({cell.y.r}, {cell.y.g}, {cell.y.b})
                      </td>
                      <td className="py-0.5 px-2 font-semibold text-blue-950 whitespace-nowrap">
                        ({cell.z.r}, {cell.z.g}, {cell.z.b})
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5">
            <MatrixDisplay
              matrices={inspection.xMatrices}
              channelView={channelView}
              activeCoord={{ row: selectedCell.row, col: selectedCell.col }}
              labelPrefix="원본 X · "
              onSelectCell={onSelectCoord}
            />
            <MatrixDisplay
              matrices={inspection.yMatrices}
              channelView={channelView}
              activeCoord={{ row: selectedCell.row, col: selectedCell.col }}
              labelPrefix="배경 Y · "
              onSelectCell={onSelectCoord}
            />
            <MatrixDisplay
              matrices={inspection.zMatrices}
              channelView={channelView}
              activeCoord={{ row: selectedCell.row, col: selectedCell.col }}
              labelPrefix="합성 Z · "
              onSelectCell={onSelectCoord}
            />
          </div>
        )}
      </div>
    </section>
  );
};
