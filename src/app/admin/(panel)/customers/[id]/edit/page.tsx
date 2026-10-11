import type { Metadata } from "next";

import { RecordFormView } from "@/admin/features/records/record-form";

export const metadata: Metadata = { title: "Edit customer" };

export default async function EditCustomerPage({
  params,
}: PageProps<"/admin/customers/[id]/edit">) {
  const { id } = await params;
  return <RecordFormView key={id} entity="customer" id={id} />;
}
