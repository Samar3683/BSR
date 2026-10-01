import type { Metadata } from "next";

import { MAIN_CONTENT_ID } from "@/constants/landmarks";
import { quoteRequestContent } from "@/features/booking/config/quote-request-content";
import { QuoteRequestPage } from "@/features/booking/components/quote-request-page";

export const metadata: Metadata = {
  title: quoteRequestContent.title,
  description: quoteRequestContent.description,
  alternates: { canonical: "/preventivo" },
  openGraph: { url: "/preventivo" },
};

/** Quote-request route (composition only). */
export default function PreventivoPage() {
  return (
    <main id={MAIN_CONTENT_ID} tabIndex={-1}>
      <QuoteRequestPage />
    </main>
  );
}
