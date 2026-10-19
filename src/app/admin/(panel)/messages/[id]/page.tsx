import type { Metadata } from "next";

import { MessageDetailView } from "@/admin/features/messages/message-detail";

export const metadata: Metadata = { title: "Message" };

export default async function MessagePage({ params }: PageProps<"/admin/messages/[id]">) {
  const { id } = await params;
  return <MessageDetailView key={id} id={id} />;
}
