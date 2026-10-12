"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "../../components/ui/button";
import { Alert } from "../../components/ui/feedback";
import { signOut } from "../../lib/auth-client";
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
          await signOut().catch(() => undefined);
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
      intro="The admin panel needs a PostgreSQL database. Set DATABASE_URL and SESSION_SECRET, apply the migrations (pnpm db:migrate) and restart."
    >
      <Alert>See docs/admin-backend.md for the setup steps.</Alert>
    </AuthCard>
  );
}
