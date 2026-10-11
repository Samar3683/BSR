import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { NotConfigured } from "@/admin/features/auth/access-states";
import { AuthCard } from "@/admin/features/auth/auth-card";
import { ResetPasswordForm } from "@/admin/features/auth/password-forms";
import { createSupabaseServerClient } from "@/admin/lib/supabase/server";

export const metadata: Metadata = { title: "Choose a password" };

/** Reached through a recovery or invitation link (the link opened a session). */
export default async function ResetPasswordPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <NotConfigured />;
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/admin/login?error=link");
  return (
    <AuthCard
      title="Choose a password"
      intro="Set the password you will use to sign in to the admin panel."
    >
      <ResetPasswordForm email={data.user.email ?? null} />
    </AuthCard>
  );
}
