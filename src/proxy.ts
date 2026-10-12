import type { NextRequest } from "next/server";

import { updateAdminSession } from "@/admin/server/proxy";

/**
 * Request proxy for the admin area only (sign-in redirect).
 * The matcher keeps it off every public route, so the public site's requests
 * are untouched.
 */
export function proxy(request: NextRequest) {
  return updateAdminSession(request);
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
