"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "../../components/ui/button";
import { Alert } from "../../components/ui/feedback";
import { getSupabase } from "../../lib/supabase/client";
import { AuthCard } from "./auth-card";

/** A signed-in user without (active) administrator access. */
export function NoAccess({ email, inactive }: { email: string | null; inactive: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <AuthCard
      title={inactive ? "Account inactive" : "No admin access"}
      intro={
        inactive
          ? "This administrator account has been deactivated. Another administrator can reactivate it."
          : "This account is signed in but is not an administrator of BSR Trasporti."
      }
    >
      {email ? <Alert>Signed in as {email}</Alert> : null}
      <Button
        variant="primary"
        block
        loading={busy}
        onClick={async () => {
          setBusy(true);
          await getSupabase().auth.signOut();
          router.replace("/admin/login");
          router.refresh();
        }}
      >
        Sign out
      </Button>
    </AuthCard>
  );
}

export function NotConfigured() {
  return (
    <AuthCard
      title="Backend not configured"
      intro="The admin panel needs a Supabase project. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then rebuild."
    >
      <Alert>See docs/admin-backend.md for the setup steps.</Alert>
    </AuthCard>
  );
}
