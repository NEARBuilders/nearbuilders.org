export type ProgramState = "upcoming" | "open" | "closed";

export const RECENTLY_CLOSED_DAYS = 30;

type ProgramWindow = {
  opensAt: Date | null;
  closesAt: Date | null;
};

export function programState(program: ProgramWindow, now: Date): ProgramState {
  if (program.opensAt && program.opensAt.getTime() > now.getTime()) return "upcoming";
  if (program.closesAt && program.closesAt.getTime() <= now.getTime()) return "closed";
  return "open";
}

export function isRecentlyClosed(program: ProgramWindow, now: Date): boolean {
  if (!program.closesAt || programState(program, now) !== "closed") return false;
  const cutoff = now.getTime() - RECENTLY_CLOSED_DAYS * 24 * 60 * 60 * 1000;
  return program.closesAt.getTime() > cutoff;
}
