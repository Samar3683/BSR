import type { Metadata } from "next";

import { MAIN_CONTENT_ID } from "@/constants/landmarks";
import { TrackingPage } from "@/features/tracking/components/tracking-page";
import { trackingContent } from "@/features/tracking/config/tracking-content";

export const metadata: Metadata = {
  title: trackingContent.title,
  description: trackingContent.description,
  alternates: { canonical: "/tracciamento" },
  // The page shows what a code unlocks: it is not for search engines.
  robots: { index: false, follow: true },
};

/** Tracking route (composition only). */
export default function TracciamentoPage() {
  return (
    <main id={MAIN_CONTENT_ID} tabIndex={-1}>
      <TrackingPage />
    </main>
  );
}
