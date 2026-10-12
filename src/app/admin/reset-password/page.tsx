import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { NotConfigured } from "@/admin/features/auth/access-states";
import { AuthCard } from "@/admin/features/auth/auth-card";
import { ResetPasswordForm } from "@/admin/features/auth/password-forms";
import { isBackendConfigured } from "@/admin/server/config";
import { getSessionUser } from "@/admin/server/gate";

export const metadata: Metadata = { title: "Choose a password" };

/** Reached through a recovery or invitation link (the link opened a session). */
export default async function ResetPasswordPage() {
  if (!isBackendConfigured()) return <NotConfigured />;
  const user = await getSessionUser();
  if (!user) redirect("/admin/login?error=link");
  return (
    <AuthCard
      title="Choose a password"
      intro="Set the password you will use to sign in to the admin panel."
    >
      <ResetPasswordForm email={user.email} />
    </AuthCard>
  );
}
