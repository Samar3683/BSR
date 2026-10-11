import type { Metadata } from "next";

import { RecordFormView } from "@/admin/features/records/record-form";

export const metadata: Metadata = { title: "Edit order" };

export default async function EditOrderPage({ params }: PageProps<"/admin/orders/[id]/edit">) {
  const { id } = await params;
  return <RecordFormView key={id} entity="order" id={id} />;
}
