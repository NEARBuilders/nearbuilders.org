import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { useApiClient } from "@/app";
import { Badge } from "@/components/ui/badge";
import { cityNodesQueryOptions, cityNodeUrl, findCityNode } from "@/lib/city-nodes";

export function CityNodeChip({ cityNode }: { cityNode: string | null | undefined }) {
  const apiClient = useApiClient();
  const { data } = useQuery({ ...cityNodesQueryOptions(apiClient), enabled: Boolean(cityNode) });
  if (!cityNode) return null;
  const node = findCityNode(data?.data, cityNode);

  return (
    <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-medium" asChild>
      <a
        href={cityNodeUrl(cityNode, node, data?.meta.baseUrl)}
        target="_blank"
        rel="noopener noreferrer"
        title="Open this community on citynode.app"
      >
        <MapPin />
        {node?.name ?? cityNode}
      </a>
    </Badge>
  );
}
