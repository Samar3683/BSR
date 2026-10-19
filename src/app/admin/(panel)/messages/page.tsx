import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingState } from "@/admin/components/ui/feedback";
import { MessagesView } from "@/admin/features/messages/messages-view";

export const metadata: Metadata = { title: "Messages" };

export default function MessagesPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <MessagesView />
    </Suspense>
  );
}
