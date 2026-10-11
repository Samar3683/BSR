import type { Metadata } from "next";

import { RecordDetailView } from "@/admin/features/records/record-detail";

export const metadata: Metadata = { title: "Order" };

export default async function OrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  const { id } = await params;
  return <RecordDetailView key={id} entity="order" id={id} />;
}
