import type { Metadata } from "next";

import { RecordFormView } from "@/admin/features/records/record-form";

export const metadata: Metadata = { title: "New order" };

export default function NewOrderPage() {
  return <RecordFormView entity="order" />;
}
