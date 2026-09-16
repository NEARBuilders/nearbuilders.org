export const FIRST_DELAY_RANGE = [10_000, 15_000] as const;
export const REPEAT_DELAY_RANGE = [10_000, 15_000] as const;

export function getRandomDelay(
  [minimum, maximum]: readonly [number, number],
  random = Math.random,
) {
  return Math.round(minimum + random() * (maximum - minimum));
}
