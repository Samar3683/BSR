import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingState } from "@/admin/components/ui/feedback";
import { DispatchView } from "@/admin/features/dispatch/dispatch-view";

export const metadata: Metadata = { title: "Dispatch" };

export default function Page() {
  return (
    <Suspense fallback={<LoadingState />}>
      <DispatchView />
    </Suspense>
  );
}
