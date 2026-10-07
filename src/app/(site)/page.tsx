import { MAIN_CONTENT_ID } from "@/constants/landmarks";
import { HeroSection } from "@/experiences/home/components/hero-section";
import { AboutSection } from "@/features/about/components/about-section";
import { BookingSection } from "@/features/booking/components/booking-section";
import { RequestProcessSection } from "@/features/booking/components/request-process-section";
import { QuoteSection } from "@/features/contact/components/quote-section";
import { FaqSection } from "@/features/faq/components/faq-section";
import { VehiclesSection } from "@/features/fleet/components/vehicles-section";
import { IdentitySection } from "@/features/home/components/identity-section";
import { HeroInView } from "@/features/home/components/hero-in-view";
import { ReviewsSection } from "@/features/reviews/components/reviews-section";
import { CoverageSection } from "@/features/routes/components/coverage-section";
import { SectorsSection } from "@/features/sectors/components/sectors-section";
import { ServicesSection } from "@/features/services/components/services-section";
import { QuickActions } from "@/features/site/components/quick-actions";
import { JourneyIndicator } from "@/features/story/components/journey-indicator";
import { SceneDirector } from "@/features/story/components/scene-director";
import { NetworkSection } from "@/features/trust/components/network-section";
import { ProtectionSection } from "@/features/trust/components/protection-section";
import { jsonLdScript, organizationJsonLd } from "@/features/seo/structured-data";

/**
 * Home page (composition only). The hero is a locked, replaceable module
 * (docs/hero-baseline.md); nothing below it imports it or any WebGL code.
 *
 * Below the hero, one continuous shipment story in twelve marked chapters
 * (components/editorial: each opens on the same hairline, its green segment
 * drawing as the route continues, "04 / 12"): who BSR is → services → who we
 * work for → how it works → fleet → coverage → cargo security → clients →
 * reviews → who we are → the request → FAQ, then the close and the footer.
 *
 * Surfaces: White and Soft White alternate and dominate; Carbon only for the
 * hero and its transition, the coverage map, the close and the compact footer.
 * Green is route and state; red is the request and the destination.
 */
export default function HomePage() {
  return (
    <>
      <main id={MAIN_CONTENT_ID} tabIndex={-1}>
        <HeroSection />
        <IdentitySection />
        <SectorsSection />
        <ServicesSection />
        <RequestProcessSection />
        <ProtectionSection />
        <VehiclesSection />
        <CoverageSection />
        <NetworkSection />
        <ReviewsSection />
        <AboutSection />
        <BookingSection />
        <FaqSection />
        <QuoteSection />
      </main>
      <QuickActions />
      <JourneyIndicator />
      <HeroInView />
      <SceneDirector />
      {/* The organisation as structured data (verified facts only). */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(organizationJsonLd()) }}
      />
    </>
  );
}
