export const FIRST_DELAY_RANGE = [30_000, 75_000] as const;
export const REPEAT_DELAY_RANGE = [120_000, 240_000] as const;

export function getRandomDelay(
  [minimum, maximum]: readonly [number, number],
  random = Math.random,
) {
  return Math.round(minimum + random() * (maximum - minimum));
}
