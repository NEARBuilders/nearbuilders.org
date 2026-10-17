import { Link } from "@tanstack/react-router";
import type { ComponentProps } from "react";
import type { BuildFooterLink, BuildGetInvolvedAction } from "@/lib/build-content";

export type SiteLinkTarget = BuildFooterLink | BuildGetInvolvedAction;

export function SiteLink({
  link,
  ...props
}: Omit<ComponentProps<"a">, "href" | "target" | "rel"> & { link: SiteLinkTarget }) {
  if (link.kind === "external") {
    return <a {...props} href={link.href} target="_blank" rel="noopener noreferrer" />;
  }

  if ("params" in link) {
    return <Link {...props} to={link.to} params={link.params} search={link.search} />;
  }

  return <Link {...props} to={link.to} />;
}
