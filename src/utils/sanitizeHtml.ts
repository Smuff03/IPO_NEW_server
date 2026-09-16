/**
 * Minimal allowlist-based HTML sanitizer for ingested article/review content.
 * Strips scripts, event handlers, and anything not on the allowlist. For
 * production use with untrusted rich HTML, swap this for a battle-tested
 * library such as `sanitize-html` or `DOMPurify` (via `isomorphic-dompurify`).
 */
const ALLOWED_TAGS = new Set(["p", "b", "strong", "i", "em", "ul", "ol", "li", "a", "br", "h2", "h3"]);

export function sanitizeHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/ on\w+="[^"]*"/gi, "")
    .replace(/ on\w+='[^']*'/gi, "")
    .replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (match, tag: string) => {
      if (!ALLOWED_TAGS.has(tag.toLowerCase())) return "";
      return match.replace(/ on\w+=(".*?"|'.*?')/gi, "");
    });
}
