import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingState } from "@/admin/components/ui/feedback";
import { RequestsView } from "@/admin/features/requests/requests-view";

export const metadata: Metadata = { title: "Requests" };

export default function RequestsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <RequestsView />
    </Suspense>
  );
}
