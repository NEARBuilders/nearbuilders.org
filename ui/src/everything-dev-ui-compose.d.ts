// TODO(#839): remove once a framework release ships dist/ui/compose.d.mts
declare module "everything-dev/ui/compose" {
  export function constructTree(
    input: import("everything-dev/ui/manifest").ConstructInput,
  ): Promise<import("everything-dev/ui/manifest").ConstructedTree>;
}
