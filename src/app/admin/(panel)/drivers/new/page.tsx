import type { Metadata } from "next";

import { RecordFormView } from "@/admin/features/records/record-form";

export const metadata: Metadata = { title: "New driver" };

export default function NewDriverPage() {
  return <RecordFormView entity="driver" />;
}
