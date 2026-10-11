import type { Metadata } from "next";

import { RecordFormView } from "@/admin/features/records/record-form";

export const metadata: Metadata = { title: "Edit driver" };

export default async function EditDriverPage({ params }: PageProps<"/admin/drivers/[id]/edit">) {
  const { id } = await params;
  return <RecordFormView key={id} entity="driver" id={id} />;
}
