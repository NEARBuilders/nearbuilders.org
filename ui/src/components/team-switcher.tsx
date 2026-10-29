import { Users } from "lucide-react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
          className="flex items-center gap-2 text-xs text-muted-foreground max-w-45"
        >
          <Users className="size-3.5 shrink-0" />
          <span className="truncate min-w-0">
            {teams.find((team) => team.id === activeTeamId)?.name ?? "no team"}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">teams</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="flex items-center justify-between cursor-pointer"
          onClick={() => handleSwitch(null)}
        >
          <span>no team</span>
          {!activeTeamId && <span className="text-xs text-muted-foreground">active</span>}
        </DropdownMenuItem>
        {teams.map((team) => (
          <DropdownMenuItem
            key={team.id}
            className="flex items-center justify-between cursor-pointer"
            onClick={() => handleSwitch(team.id)}
          >
            <span className="truncate min-w-0 flex-1">{team.name}</span>
            {team.id === activeTeamId && (
              <span className="text-xs text-muted-foreground">active</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
