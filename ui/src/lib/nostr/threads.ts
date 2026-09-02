import type { NearNostrComment } from "./types";

export type OrphanPolicy = "promote" | "hide";
export type ThreadNode = NearNostrComment & { children: ThreadNode[] };

export function buildThreads(
  comments: NearNostrComment[],
  opts?: { orphans?: OrphanPolicy },
): ThreadNode[] {
  const orphans = opts?.orphans ?? "promote";
  const nodes = new Map<string, ThreadNode>(
    comments.map((c) => [c.eventId, { ...c, children: [] }]),
  );
  const roots: ThreadNode[] = [];

  for (const comment of comments) {
    const node = nodes.get(comment.eventId)!;
    if (comment.parentId && nodes.has(comment.parentId)) {
      nodes.get(comment.parentId)!.children.push(node);
    } else if (comment.parentId) {
      if (orphans === "promote") roots.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortChildren = (node: ThreadNode) => {
    node.children.sort((a, b) => a.createdAt - b.createdAt);
    for (const child of node.children) sortChildren(child);
  };

  roots.sort((a, b) => b.createdAt - a.createdAt);
  for (const root of roots) sortChildren(root);

  return roots;
}
