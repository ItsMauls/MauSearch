/** URL-safe slug from free text. Collision handling (short id suffix) lives at the call site. */
export const slugify = (text: string): string =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
