import type { Metadata } from "next";

import { NotConfigured } from "@/admin/features/auth/access-states";
import { AuthCard } from "@/admin/features/auth/auth-card";
import { ForgotPasswordForm } from "@/admin/features/auth/password-forms";
import { getSupabaseEnv } from "@/admin/lib/supabase/env";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  if (!getSupabaseEnv()) return <NotConfigured />;
  return (
    <AuthCard
      title="Reset your password"
      intro="Enter your administrator email. We will send you a link to choose a new password."
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
