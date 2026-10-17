import { Link } from "@tanstack/react-router";
import type { ComponentProps } from "react";
import type { BuildFooterLink } from "@/lib/build-content";

export type SiteLinkTarget = BuildFooterLink;

export function SiteLink({
  link,
  ...props
}: Omit<ComponentProps<"a">, "href" | "target" | "rel"> & { link: SiteLinkTarget }) {
  if (link.kind === "external") {
    return <a {...props} href={link.href} target="_blank" rel="noopener noreferrer" />;
  }

  return <Link {...props} to={link.to} />;
}
