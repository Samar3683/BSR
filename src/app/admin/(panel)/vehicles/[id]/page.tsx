import type { Metadata } from "next";

import { RecordDetailView } from "@/admin/features/records/record-detail";

export const metadata: Metadata = { title: "Vehicle" };

export default async function VehiclePage({ params }: PageProps<"/admin/vehicles/[id]">) {
  const { id } = await params;
  return <RecordDetailView key={id} entity="vehicle" id={id} />;
}
