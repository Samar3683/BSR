import type { Metadata } from "next";

import { RecordFormView } from "@/admin/features/records/record-form";

export const metadata: Metadata = { title: "New customer" };

export default function NewCustomerPage() {
  return <RecordFormView entity="customer" />;
}
