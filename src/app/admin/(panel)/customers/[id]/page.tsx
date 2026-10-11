import type { Metadata } from "next";

import { RecordDetailView } from "@/admin/features/records/record-detail";

export const metadata: Metadata = { title: "Customer" };

export default async function CustomerPage({ params }: PageProps<"/admin/customers/[id]">) {
  const { id } = await params;
  return <RecordDetailView key={id} entity="customer" id={id} />;
}
