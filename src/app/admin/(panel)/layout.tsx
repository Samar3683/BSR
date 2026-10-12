import { redirect } from "next/navigation";

import { AdminShell } from "@/admin/components/shell/admin-shell";
import { AdminSessionProvider } from "@/admin/components/shell/session";
import { NoAccess, NotConfigured } from "@/admin/features/auth/access-states";
import { resolveAdminGate } from "@/admin/server/gate";

/**
 * Every panel page passes this server-side gate: a valid session of
 * a user with an active administrator profile. RLS enforces the same rule on
 * each query, so the gate is a user-experience boundary, not the only one.
 */
export default async function PanelLayout({ children }: LayoutProps<"/admin">) {
  const gate = await resolveAdminGate();
  if (gate.state === "unconfigured") return <NotConfigured />;
  if (gate.state === "signed-out") redirect("/admin/login");
  if (gate.state === "no-access") return <NoAccess email={gate.email} inactive={false} />;
  if (gate.state === "inactive") return <NoAccess email={gate.admin.email} inactive />;

  const { admin } = gate;
  return (
    <AdminSessionProvider
      admin={{
        id: admin.id,
        user_id: admin.user_id,
        display_name: admin.display_name,
        email: admin.email,
        role: admin.role,
      }}
    >
      <AdminShell>{children}</AdminShell>
    </AdminSessionProvider>
  );
}
