import { Link } from "@tanstack/react-router";
import { Building2, Check, Loader2, Plus } from "lucide-react";
import type { Organization } from "@/app";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface OrgSwitcherProps {
  organizations: Organization[];
  activeOrgId?: string | null;
  isSwitching?: boolean;
  onSwitch: (orgId: string) => void;
}

export function OrgSwitcher({
  organizations,
  activeOrgId,
  isSwitching,
  onSwitch,
}: OrgSwitcherProps) {
  const activeOrg = organizations.find((o) => o.id === activeOrgId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-2 text-sm text-foreground max-w-48"
          disabled={isSwitching}
        >
          {isSwitching ? (
            <Loader2 className="size-3.5 shrink-0 animate-spin" />
          ) : (
            <Building2 className="size-3.5 shrink-0" />
          )}
          <span className="truncate min-w-0">{activeOrg?.name ?? "workspace"}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            className="flex items-center justify-between cursor-pointer"
            onClick={() => onSwitch(org.id)}
            disabled={isSwitching || org.id === activeOrgId}
          >
            <span className="truncate min-w-0 flex-1">{org.name}</span>
            {org.id === activeOrgId && <Check className="size-3.5 text-muted-foreground" />}
          </DropdownMenuItem>
        ))}
        {organizations.length === 0 && (
          <DropdownMenuItem disabled className="text-muted-foreground">
            no organizations
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/organizations/new" className="flex items-center gap-2 cursor-pointer">
            <Plus className="size-3.5" />
            new organization
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
