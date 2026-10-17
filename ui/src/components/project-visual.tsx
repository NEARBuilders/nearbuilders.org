import { useQuery } from "@tanstack/react-query";
import { useAuthClient } from "@/app";
import type { ProjectDirectoryItem } from "@/components/project-directory-item";
import { isSafeImageUrl } from "@/lib/image-url";
import { getNearSocialAvatarUrl, resolveProjectNearAccount } from "@/lib/near-social";
import { nearProfileOptions } from "@/lib/queries/builders";
import { cn } from "@/lib/utils";

export type ProjectVisualSource = Pick<ProjectDirectoryItem, "ownerId" | "imageUrl" | "title">;

export function getProjectInitials(title: string) {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function ProjectVisual({
  project,
  className,
}: {
  project: ProjectVisualSource;
  className?: string;
}) {
  const auth = useAuthClient();
  const socialAccount = resolveProjectNearAccount({ ownerId: project.ownerId }) ?? "";
  const { data: socialProfile } = useQuery({
    ...nearProfileOptions(auth, socialAccount),
    enabled: Boolean(socialAccount) && !isSafeImageUrl(project.imageUrl),
  });
  const imageUrl = isSafeImageUrl(project.imageUrl)
    ? project.imageUrl
    : getNearSocialAvatarUrl(socialProfile);
  const initials = getProjectInitials(project.title);

  return imageUrl ? (
    <img
      src={imageUrl}
      alt=""
      className={cn("size-14 shrink-0 rounded-2xl border border-border object-cover", className)}
      loading="lazy"
    />
  ) : (
    <span
      className={cn(
        "flex size-14 shrink-0 items-center justify-center rounded-2xl bg-brand-accent-light text-lg font-black tracking-tight text-brand-accent",
        className,
      )}
      aria-hidden="true"
    >
      {initials || "NB"}
    </span>
  );
}
