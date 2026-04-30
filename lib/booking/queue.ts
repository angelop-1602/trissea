export function compactQueuePositionsAfterRemoval(positions: number[], removedPosition: number): number[] {
  return positions.map((position) => (position > removedPosition ? position - 1 : position));
}
