import type { Metadata } from "next";

import { MAIN_CONTENT_ID } from "@/constants/landmarks";
import { MessagePage } from "@/features/contact/components/message-page";
import { messageContent } from "@/features/contact/config/message-content";

export const metadata: Metadata = {
  title: messageContent.title,
  description: messageContent.description,
  alternates: { canonical: "/contatti" },
  openGraph: { url: "/contatti" },
};

/** "Scrivici un messaggio" route (composition only). */
export default function ContattiPage() {
  return (
    <main id={MAIN_CONTENT_ID} tabIndex={-1}>
      <MessagePage />
    </main>
  );
}
