import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingState } from "@/admin/components/ui/feedback";
import { AuditView } from "@/admin/features/audit/audit-view";

export const metadata: Metadata = { title: "Audit Log" };

export default function Page() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AuditView />
    </Suspense>
  );
}
