import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingState } from "@/admin/components/ui/feedback";
import { RecordListView } from "@/admin/features/records/record-list";

export const metadata: Metadata = { title: "Vehicles" };

export default function VehiclesPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <RecordListView entity="vehicle" />
    </Suspense>
  );
}
