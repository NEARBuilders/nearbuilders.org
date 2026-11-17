import { Check, Users } from "lucide-react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface TeamSwitcherProps {
  teams: Array<{ id: string; name: string }>;
  activeTeamId?: string | null;
  onSwitch?: (teamId: string | null) => void;
}

export function TeamSwitcher({ teams, activeTeamId, onSwitch }: TeamSwitcherProps) {
  const apiClient = useApiClient();

  const handleSwitch = async (teamId: string | null) => {
    if (teamId === (activeTeamId ?? null)) return;
    try {
      await apiClient.auth.setActiveTeam({ teamId });
      onSwitch?.(teamId);
    } catch {
      toast.error("Failed to switch team");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-2 text-sm text-foreground max-w-48"
        >
          <Users className="size-3.5 shrink-0" />
          <span className="truncate min-w-0">
            {teams.find((team) => team.id === activeTeamId)?.name ?? "no team"}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem
          className="flex items-center justify-between cursor-pointer"
          onClick={() => handleSwitch(null)}
        >
          <span>no team</span>
          {!activeTeamId && <Check className="size-3.5 text-muted-foreground" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {teams.map((team) => (
          <DropdownMenuItem
            key={team.id}
            className="flex items-center justify-between cursor-pointer"
            onClick={() => handleSwitch(team.id)}
          >
            <span className="truncate min-w-0 flex-1">{team.name}</span>
            {team.id === activeTeamId && <Check className="size-3.5 text-muted-foreground" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
