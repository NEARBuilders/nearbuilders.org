import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/app";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  cityNodePath,
  cityNodesQueryOptions,
  findCityNode,
  suggestCityNode,
} from "@/lib/city-nodes";

const NONE = "__none__";

const DEPTH_INDENT = ["", "pl-6", "pl-10", "pl-14"];

export function CityNodePicker({
  id,
  value,
  onChange,
  location,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  location?: string;
}) {
  const apiClient = useApiClient();
  const { data, isLoading } = useQuery(cityNodesQueryOptions(apiClient));
  const nodes = data?.data ?? [];
  const selected = findCityNode(nodes, value || null);
  const suggestion = value ? undefined : suggestCityNode(location, nodes);
  const unavailable = !isLoading && nodes.length === 0;

  return (
    <div className="space-y-2">
      <Select
        value={value || NONE}
        onValueChange={(next) => onChange(next === NONE ? "" : next)}
        disabled={isLoading || (unavailable && !value)}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={isLoading ? "Loading city nodes…" : "No city node"}>
            {value
              ? selected
                ? cityNodePath(selected, nodes)
                : value
              : isLoading
                ? "Loading city nodes…"
                : "No city node"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>No city node</SelectItem>
          {value && !selected ? <SelectItem value={value}>{value}</SelectItem> : null}
          {nodes.map((node) => (
            <SelectItem
              key={node.slug}
              value={node.slug}
              className={DEPTH_INDENT[Math.min(node.depth, DEPTH_INDENT.length - 1)]}
            >
              <span>{node.name}</span>
              <span className="text-xs capitalize text-muted-foreground">{node.kind}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {suggestion ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Your location matches {cityNodePath(suggestion, nodes)}.</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onChange(suggestion.slug)}
          >
            Use {suggestion.name}
          </Button>
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">
        {unavailable
          ? "City nodes can't be loaded right now. You can add one later."
          : "Optional. The CityNode community you belong to, shown on citynode.app."}
      </p>
    </div>
  );
}
