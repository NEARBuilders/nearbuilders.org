export function getBuilderOnboardingProgress(completedItems: readonly boolean[]): number {
  if (completedItems.length === 0) return 0;
  return Math.round(
    (completedItems.filter((completed) => completed).length / completedItems.length) * 100,
  );
}
