import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { safeAdminNext } from "@/admin/lib/supabase/proxy";
import { createSupabaseServerClient } from "@/admin/lib/supabase/server";

const OTP_TYPES: readonly EmailOtpType[] = [
  "recovery",
  "invite",
  "email",
  "magiclink",
  "signup",
  "email_change",
];

/**
 * Landing point of Supabase Auth email links (password recovery, admin
 * invitations). Accepts the token-hash form recommended for server-side
 * auth and the PKCE code form, opens the session in cookies, then continues
 * to a same-site admin page.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeAdminNext(searchParams.get("next"));
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const supabase = await createSupabaseServerClient();

  if (supabase) {
    if (tokenHash && type && OTP_TYPES.includes(type)) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      if (!error) return NextResponse.redirect(new URL(next, request.url));
    } else if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(next, request.url));
    }
  }
  return NextResponse.redirect(new URL("/admin/login?error=link", request.url));
}
