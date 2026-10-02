export const ENGINE_VERSION = 'b-1' as const;

// Version b-1: negative half-ties round away from zero, unlike Math.round.
export function roundHalfAwayFromZero(value: number): number {
  if (!Number.isFinite(value)) throw new Error('Cannot round a non-finite engine value.');
  const rounded = Math.floor(Math.abs(value) + 0.5);
  return value < 0 && rounded !== 0 ? -rounded : rounded;
}
