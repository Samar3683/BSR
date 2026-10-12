/** Only same-site admin paths are accepted as a post-login destination. */
export function safeAdminNext(value: string | null | undefined): string {
  if (!value || !value.startsWith("/admin") || value.startsWith("//") || value.includes("\\"))
    return "/admin";
  // The API is not a page to land on.
  if (value.startsWith("/admin/api")) return "/admin";
  return value;
}
