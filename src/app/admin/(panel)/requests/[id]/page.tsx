import type { Metadata } from "next";

import { RequestDetailView } from "@/admin/features/requests/request-detail";

export const metadata: Metadata = { title: "Request" };

export default async function RequestPage({ params }: PageProps<"/admin/requests/[id]">) {
  const { id } = await params;
  return <RequestDetailView key={id} id={id} />;
}
