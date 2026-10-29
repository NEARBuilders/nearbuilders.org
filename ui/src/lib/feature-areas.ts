export const FEATURE_AREAS = ["organizations"] as const;

export type FeatureArea = (typeof FEATURE_AREAS)[number];

export const FEATURE_AREA_LABELS: Record<FeatureArea, string> = {
  organizations: "Organizations",
};

export function isFeatureArea(value: string): value is FeatureArea {
  return (FEATURE_AREAS as readonly string[]).includes(value);
}
