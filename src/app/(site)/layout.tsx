import { RevealController } from "@/components/motion/reveal-controller";
import { SiteFooter } from "@/features/site/components/site-footer";
import { SiteHeader } from "@/features/site/components/site-header";

/** Public site pages: global header and footer around each page's <main>, and the entry motion. */
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter />
      <RevealController />
    </>
  );
}
