import React from 'react';
import {
  ChannelMatrices,
  ChannelViewMode,
  PixelCoord,
} from '../types/lab';

interface SingleMatrixProps {
  title: string;
  symbol: string;
  accentClass: string;
  rows: number[];
  cols: number[];
  values: number[][];
  activeCoord: PixelCoord;
  compareValues?: number[][];
  onSelectCell?: (coord: PixelCoord) => void;
}

const SingleChannelMatrix: React.FC<SingleMatrixProps> = ({
  title,
  symbol,
  accentClass,
  rows,
  cols,
  values,
  activeCoord,
  compareValues,
  onSelectCell,
}) => {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className={`font-semibold ${accentClass}`}>{title}</span>
        <span className="font-mono text-[11px] text-slate-500">{symbol}</span>
      </div>

      <div className="overflow-x-auto bg-slate-50 border border-slate-200 rounded-md p-2">
        <div className="inline-flex items-stretch gap-1 min-w-full justify-center">
          {/* Left Mathematical Matrix Bracket */}
          <div
            aria-hidden="true"
            className="w-2 border-y-2 border-l-2 border-slate-700 rounded-l-xs my-4"
          />

          <table className="border-collapse font-mono tabular-nums text-xs">
            <thead>
              <tr>
                <th className="text-[10px] font-normal text-slate-400 pb-1 text-right pr-1.5 whitespace-nowrap">
                  행\열
                </th>
                {cols.map((col) => (
                  <th
                    key={col}
                    className="px-1 pb-1 text-[10px] font-medium text-slate-500 text-center"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => (
                <tr key={row}>
                  <th className="text-[10px] font-medium text-slate-500 text-right pr-1.5 whitespace-nowrap">
                    {row}
                  </th>
                  {cols.map((col, cIdx) => {
                    const val = values[rIdx][cIdx];
                    const prevVal = compareValues?.[rIdx]?.[cIdx];
                    const isChanged =
                      prevVal !== undefined && prevVal !== val;
                    const isActive =
                      activeCoord.row === row && activeCoord.col === col;
                    const sizeClass =
                      cols.length >= 5
                        ? 'min-w-[30px] px-1 py-1 text-[11px]'
                        : 'min-w-[38px] px-1.5 py-1 text-xs';

                    return (
                      <td key={`${row}-${col}`} className="p-0.5">
                        <button
                          type="button"
                          onClick={() => onSelectCell?.({ row, col })}
                          className={`${sizeClass} rounded text-center transition-colors cursor-pointer ${
                            isActive
                              ? 'bg-blue-900 text-white font-semibold'
                              : isChanged
                                ? 'bg-amber-100 text-amber-950 font-semibold border border-amber-300'
                                : 'bg-white text-slate-800 border border-slate-200 hover:bg-slate-100'
                          }`}
                          title={
                            isChanged
                              ? `(${row}, ${col}): ${prevVal} → ${val}`
                              : `(${row}, ${col}) = ${val}`
                          }
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

          {/* Right Mathematical Matrix Bracket */}
          <div
            aria-hidden="true"
            className="w-2 border-y-2 border-r-2 border-slate-700 rounded-r-xs my-4"
          />
        </div>
      </div>
    </div>
  );
};

interface MatrixDisplayProps {
  matrices: ChannelMatrices;
  compareMatrices?: ChannelMatrices;
  channelView: ChannelViewMode;
  activeCoord: PixelCoord;
  labelPrefix?: string;
  symbolSuffix?: string;
  onSelectCell?: (coord: PixelCoord) => void;
}

export const MatrixDisplay: React.FC<MatrixDisplayProps> = ({
  matrices,
  compareMatrices,
  channelView,
  activeCoord,
  labelPrefix = '',
  symbolSuffix = '',
  onSelectCell,
}) => {
  const showR = channelView === 'all' || channelView === 'r';
  const showG = channelView === 'all' || channelView === 'g';
  const showB = channelView === 'all' || channelView === 'b';

  return (
    <div className="flex flex-col gap-3">
      {showR && (
        <SingleChannelMatrix
          title={`${labelPrefix}R (빨강) 행렬`}
          symbol={`R${symbolSuffix}`}
          accentClass="text-rose-700"
          rows={matrices.rows}
          cols={matrices.cols}
          values={matrices.r}
          compareValues={compareMatrices?.r}
          activeCoord={activeCoord}
          onSelectCell={onSelectCell}
        />
      )}
      {showG && (
        <SingleChannelMatrix
          title={`${labelPrefix}G (초록) 행렬`}
          symbol={`G${symbolSuffix}`}
          accentClass="text-emerald-700"
          rows={matrices.rows}
          cols={matrices.cols}
          values={matrices.g}
          compareValues={compareMatrices?.g}
          activeCoord={activeCoord}
          onSelectCell={onSelectCell}
        />
      )}
      {showB && (
        <SingleChannelMatrix
          title={`${labelPrefix}B (파랑) 행렬`}
          symbol={`B${symbolSuffix}`}
          accentClass="text-blue-700"
          rows={matrices.rows}
          cols={matrices.cols}
          values={matrices.b}
          compareValues={compareMatrices?.b}
          activeCoord={activeCoord}
          onSelectCell={onSelectCell}
        />
      )}
    </div>
  );
};
