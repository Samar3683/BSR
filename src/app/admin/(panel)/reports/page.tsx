import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingState } from "@/admin/components/ui/feedback";
import { ReportsView } from "@/admin/features/reports/reports-view";

export const metadata: Metadata = { title: "Reports" };

export default function Page() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ReportsView />
    </Suspense>
  );
}
