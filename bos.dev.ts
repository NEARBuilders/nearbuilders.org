import type { AppDescriptor } from "everything-dev/descriptor";

/**
 * Dev overlay for the everything.dev runtime (bos.app.ts) — merged
 * child-wins over the resolved config when the environment is development.
 * Never published.
 */
export default {} satisfies Partial<AppDescriptor>;
