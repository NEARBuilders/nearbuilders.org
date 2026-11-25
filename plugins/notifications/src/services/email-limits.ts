export const EMAIL_CODE_COOLDOWN_MS = 60_000;
export const EMAIL_CODE_WINDOW_MS = 60 * 60_000;
export const EMAIL_CODE_MAX_PER_USER = 5;
export const EMAIL_CODE_MAX_PER_ADDRESS = 3;
export const EMAIL_CODE_MAX_ATTEMPTS = 5;

export function normalizeEmailAddress(email: string) {
  return email.trim().toLowerCase();
}

export function formatWait(seconds: number) {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export function codeRequestRetryAfterMs(
  byUser: readonly Date[],
  byAddress: readonly Date[],
  now: number,
) {
  const cooldown = byUser[0] ? byUser[0].getTime() + EMAIL_CODE_COOLDOWN_MS - now : 0;
  const waitFor = (requests: readonly Date[], max: number) => {
    const blocking = requests[max - 1];
    return blocking ? blocking.getTime() + EMAIL_CODE_WINDOW_MS - now : 0;
  };
  return Math.max(
    cooldown,
    waitFor(byUser, EMAIL_CODE_MAX_PER_USER),
    waitFor(byAddress, EMAIL_CODE_MAX_PER_ADDRESS),
    0,
  );
}
