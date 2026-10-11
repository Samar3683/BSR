import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingState } from "@/admin/components/ui/feedback";
import { RecordListView } from "@/admin/features/records/record-list";

export const metadata: Metadata = { title: "Orders" };

export default function OrdersPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <RecordListView entity="order" />
    </Suspense>
  );
}
