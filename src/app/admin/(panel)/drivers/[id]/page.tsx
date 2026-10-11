import type { Metadata } from "next";

import { RecordDetailView } from "@/admin/features/records/record-detail";

export const metadata: Metadata = { title: "Driver" };

export default async function DriverPage({ params }: PageProps<"/admin/drivers/[id]">) {
  const { id } = await params;
  return <RecordDetailView key={id} entity="driver" id={id} />;
}
