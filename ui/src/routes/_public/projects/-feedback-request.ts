const FEEDBACK_REQUEST_ORIGIN = "https://feedback.nearbuilders.org/manage/new";

export function feedbackRequestUrl(slug: string | null | undefined) {
  const project = slug?.trim();
  if (!project) return null;
  const url = new URL(FEEDBACK_REQUEST_ORIGIN);
  url.searchParams.set("project", project);
  return url.toString();
}
