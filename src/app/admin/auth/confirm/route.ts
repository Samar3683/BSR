import { NextResponse, type NextRequest } from "next/server";

import { safeAdminNext } from "@/admin/lib/paths";
import { consumeToken } from "@/admin/server/auth";
import { isBackendConfigured } from "@/server/config";
import { setSessionCookie } from "@/admin/server/http";

const KINDS = ["recovery", "invite"] as const;

/**
 * A redirect within this site. Relative, because request.url names the
 * server's listening address (http://0.0.0.0:3000 in Docker), not the site.
 */
function redirectTo(path: string): NextResponse {
  const url = new URL(path, "http://site.invalid"); // normalises and percent-encodes the path
  return new NextResponse(null, {
    status: 307,
    headers: { Location: `${url.pathname}${url.search}${url.hash}` },
  });
}

/**
 * Landing point of the emailed links (password recovery, administrator
 * invitations). The one-time token is consumed, a short session that may only
 * set a password is opened in the cookie, and the visitor continues to a
 * same-site admin page.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeAdminNext(searchParams.get("next"));
  const token = searchParams.get("token_hash");
  const kind = searchParams.get("type");

  if (isBackendConfigured() && token && (KINDS as readonly string[]).includes(kind ?? "")) {
    const session = await consumeToken(
      token,
      kind as (typeof KINDS)[number],
      request.headers.get("user-agent"),
    );
    if (session) {
      const response = redirectTo(next);
      setSessionCookie(response, session, request);
      return response;
    }
  }
  return redirectTo("/admin/login?error=link");
}
