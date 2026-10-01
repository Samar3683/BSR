import type { Metadata } from "next";

import { MAIN_CONTENT_ID } from "@/constants/landmarks";
import { PrivacyPage } from "@/features/legal/components/privacy-page";
import { privacyContent } from "@/features/legal/config/privacy-content";

export const metadata: Metadata = {
  title: privacyContent.title,
  description: privacyContent.intro,
  alternates: { canonical: "/privacy" },
  openGraph: { url: "/privacy" },
};

/** Privacy and cookie notice route (composition only). */
export default function PrivacyRoute() {
  return (
    <main id={MAIN_CONTENT_ID} tabIndex={-1}>
      <PrivacyPage />
    </main>
  );
}
