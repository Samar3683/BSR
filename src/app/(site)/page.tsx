import { MAIN_CONTENT_ID } from "@/constants/landmarks";
import { HeroSection } from "@/experiences/home/components/hero-section";
import { AboutSection } from "@/features/about/components/about-section";
import { BookingSection } from "@/features/booking/components/booking-section";
import { RequestProcessSection } from "@/features/booking/components/request-process-section";
import { QuoteSection } from "@/features/contact/components/quote-section";
import { FaqSection } from "@/features/faq/components/faq-section";
import { VehiclesSection } from "@/features/fleet/components/vehicles-section";
import { IdentitySection } from "@/features/home/components/identity-section";
import { RouteTransition } from "@/features/home/components/route-transition";
import { ReviewsSection } from "@/features/reviews/components/reviews-section";
import { CoverageSection } from "@/features/routes/components/coverage-section";
import { SectorsSection } from "@/features/sectors/components/sectors-section";
import { ServicesSection } from "@/features/services/components/services-section";
import { QuickActions } from "@/features/site/components/quick-actions";
import { NetworkSection } from "@/features/trust/components/network-section";
import { ProtectionSection } from "@/features/trust/components/protection-section";
import { jsonLdScript, organizationJsonLd } from "@/features/seo/structured-data";

/**
 * Home page (composition only). The hero is a locked, replaceable module
 * (docs/hero-baseline.md); nothing below it imports it or any WebGL code.
 *
 * The story — cargo arrives → BSR understands the need → chooses the
 * solution → manages the journey → the cargo arrives safely → the customer
 * trusts BSR — in the approved order: hero → who BSR is → services → who we
 * work for → how it works → fleet → coverage → cargo security → clients and
 * reviews (verified only; hidden until then) → who we are → the request →
 * FAQ → the close.
 *
 * Surfaces: Soft White and White alternate as the page's base; Deep Green for
 * cargo security; Carbon only for the cinematic moments (the hero and its
 * transition, coverage, the close) and the compact footer.
 */
export default function HomePage() {
  return (
    <>
      <main id={MAIN_CONTENT_ID} tabIndex={-1}>
        <HeroSection />
        <RouteTransition />
        <IdentitySection />
        <ServicesSection />
        <SectorsSection />
        <RequestProcessSection />
        <VehiclesSection />
        <CoverageSection />
        <ProtectionSection />
        <NetworkSection />
        <ReviewsSection />
        <AboutSection />
        <BookingSection />
        <FaqSection />
        <QuoteSection />
      </main>
      <QuickActions />
      {/* The organisation as structured data (verified facts only). */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(organizationJsonLd()) }}
      />
    </>
  );
}
