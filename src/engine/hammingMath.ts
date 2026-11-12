import {
  BINARY_REF_A,
  BINARY_REF_B,
  BINARY_REF_C,
} from '../data/experimentAssets';
import { BinaryEditEntry, BinaryImageId } from '../types/lab';

export interface HammingDistances {
  A: number;
  B: number;
  C: number;
}

export interface ClassificationResult {
  distances: HammingDistances;
  minDistance: number;
  winners: Array<'A' | 'B' | 'C'>;
  predictedClass: 'A' | 'B' | 'C' | 'TIE';
  predictedDigitLabel: string;
}

export const REFERENCE_DIGIT_META: Record<
  'A' | 'B' | 'C',
  { title: string; digit: string }
> = {
  A: { title: '기준 이미지 A', digit: '숫자 0' },
  B: { title: '기준 이미지 B', digit: '숫자 1' },
  C: { title: '기준 이미지 C', digit: '숫자 7' },
};

export function cloneBinaryGrid(grid: number[][]): number[][] {
  return grid.map((row) => [...row]);
}

export function toggleBinaryCellImmutable(
  grid: number[][],
  row1: number,
  col1: number,
): number[][] {
  const r0 = Math.max(0, Math.min(grid.length - 1, Math.round(row1) - 1));
  const c0 = Math.max(0, Math.min(grid[0].length - 1, Math.round(col1) - 1));
  return grid.map((row, r) =>
    r === r0 ? row.map((val, c) => (c === c0 ? (val === 1 ? 0 : 1) : val)) : [...row],
  );
}

export function computeHammingDistance(grid1: number[][], grid2: number[][]): number {
  let distance = 0;
  for (let r = 0; r < grid1.length; r += 1) {
    for (let c = 0; c < grid1[r].length; c += 1) {
      if (grid1[r][c] !== grid2[r][c]) {
        distance += 1;
      }
    }
  }
  return distance;
}

export function computeXorMatrix(grid1: number[][], grid2: number[][]): boolean[][] {
  return grid1.map((row, r) =>
    row.map((val, c) => val !== grid2[r][c]),
  );
}

export function computeAllDistances(xGrid: number[][]): HammingDistances {
  return {
    A: computeHammingDistance(xGrid, BINARY_REF_A),
    B: computeHammingDistance(xGrid, BINARY_REF_B),
    C: computeHammingDistance(xGrid, BINARY_REF_C),
  };
}

export function getBinaryGridById(
  id: BinaryImageId,
  xGrid: number[][],
): number[][] {
  if (id === 'A') return BINARY_REF_A;
  if (id === 'B') return BINARY_REF_B;
  if (id === 'C') return BINARY_REF_C;
  return xGrid;
}

export function classifyByHammingDistance(xGrid: number[][]): ClassificationResult {
  const distances = computeAllDistances(xGrid);
  const entries: Array<{ id: 'A' | 'B' | 'C'; d: number }> = [
    { id: 'A', d: distances.A },
    { id: 'B', d: distances.B },
    { id: 'C', d: distances.C },
  ];

  const minDistance = Math.min(distances.A, distances.B, distances.C);
  const winners = entries.filter((e) => e.d === minDistance).map((e) => e.id);

  if (winners.length === 1) {
    const winner = winners[0];
    return {
      distances,
      minDistance,
      winners,
      predictedClass: winner,
      predictedDigitLabel: `${winner} (${REFERENCE_DIGIT_META[winner].digit})`,
    };
  }

  return {
    distances,
    minDistance,
    winners,
    predictedClass: 'TIE',
    predictedDigitLabel: `동률 (${winners.map((w) => `${w}:${REFERENCE_DIGIT_META[w].digit}`).join(', ')})`,
  };
}

export function formatCoordList(entries: BinaryEditEntry[]): string {
  if (entries.length === 0) return '수정 없음';
  return entries
    .map((e) => `(${e.coord.row}, ${e.coord.col})`)
    .join(', ');
}
