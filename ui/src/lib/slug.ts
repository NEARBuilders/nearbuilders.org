import { customAlphabet } from "nanoid";

const slugId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 4);

export async function proposeUniqueSlug(
  check: (slug: string) => Promise<{ status: boolean }>,
  baseSlug: string,
): Promise<string | null> {
  let candidate = baseSlug;
  for (let attempt = 0; attempt < 5; attempt++) {
    const result = await check(candidate);
    if (result.status) return candidate;
    candidate = `${baseSlug}-${slugId()}`;
  }
  return null;
}
