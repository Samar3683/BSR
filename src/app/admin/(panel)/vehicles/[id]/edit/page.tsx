import type { Metadata } from "next";

import { RecordFormView } from "@/admin/features/records/record-form";

export const metadata: Metadata = { title: "Edit vehicle" };

export default async function EditVehiclePage({ params }: PageProps<"/admin/vehicles/[id]/edit">) {
  const { id } = await params;
  return <RecordFormView key={id} entity="vehicle" id={id} />;
}
