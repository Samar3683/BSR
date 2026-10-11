import type { Metadata } from "next";

import { RecordFormView } from "@/admin/features/records/record-form";

export const metadata: Metadata = { title: "New vehicle" };

export default function NewVehiclePage() {
  return <RecordFormView entity="vehicle" />;
}
