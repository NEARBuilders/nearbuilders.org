import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const authExportPath = join(root, ".bos", "generated", "auth", "auth-export.d.ts");

if (existsSync(authExportPath)) {
  const authExport = readFileSync(authExportPath, "utf8");

  if (authExport.includes("export type GetFullOrganizationInput")) {
    const workspaces = ["ui", "api"];
    const pluginsPath = join(root, "plugins");

    if (existsSync(pluginsPath)) {
      for (const entry of readdirSync(pluginsPath, { withFileTypes: true })) {
        if (entry.isDirectory()) workspaces.push(join("plugins", entry.name));
      }
    }

    for (const workspace of workspaces) {
      const authTypesPath = join(root, workspace, "src", "lib", "auth-types.gen.ts");
      if (!existsSync(authTypesPath)) continue;

      const source = readFileSync(authTypesPath, "utf8");
      const updated = source.replaceAll("  GetOrganizationInput,", "  GetFullOrganizationInput,");

      if (updated !== source) writeFileSync(authTypesPath, updated);
    }
  }
}
