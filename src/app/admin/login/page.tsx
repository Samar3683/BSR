import type { Metadata } from "next";

import { AuthCard } from "@/admin/features/auth/auth-card";
import { NotConfigured } from "@/admin/features/auth/access-states";
import { LoginForm } from "@/admin/features/auth/login-form";
import { getSupabaseEnv } from "@/admin/lib/supabase/env";
import { safeAdminNext } from "@/admin/lib/supabase/proxy";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  if (!getSupabaseEnv()) return <NotConfigured />;
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const notice = typeof params.error === "string" ? params.error : undefined;
  return (
    <AuthCard title="Sign in" intro="Operations panel for BSR Trasporti administrators.">
      <LoginForm next={safeAdminNext(next)} notice={notice} />
    </AuthCard>
  );
}
