import type { Metadata } from "next";

import { RecordFormView } from "@/admin/features/records/record-form";

export const metadata: Metadata = { title: "New order" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function NewOrderPage({ searchParams }: PageProps<"/admin/orders/new">) {
  const { request } = await searchParams;
  const fromRequest = typeof request === "string" && UUID.test(request) ? request : undefined;
  return <RecordFormView entity="order" fromRequest={fromRequest} />;
}
