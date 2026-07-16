import { CalendarRange, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { calendarSourceId, type LumaCalendar } from "./-event-sources";

export function CalendarFilters({
  calendars,
  disabledSourceIds,
  onToggle,
}: {
  calendars: LumaCalendar[];
  disabledSourceIds: Set<string>;
  onToggle: (sourceId: string) => void;
}) {
  const sources = [
    { id: "internal", label: "NEAR Builders" },
    ...calendars.map((calendar) => ({
      id: calendarSourceId(calendar.id),
      label: calendar.name,
    })),
  ];
  const selectedCount = sources.filter((source) => !disabledSourceIds.has(source.id)).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <CalendarRange size={14} />
          Calendars
          <span className="text-muted-foreground">
            {selectedCount}/{sources.length}
          </span>
          <ChevronDown size={13} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Show events from</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {sources.map((source) => (
          <DropdownMenuCheckboxItem
            key={source.id}
            checked={!disabledSourceIds.has(source.id)}
            onCheckedChange={() => onToggle(source.id)}
            onSelect={(event) => event.preventDefault()}
          >
            <span className="truncate">{source.label}</span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
