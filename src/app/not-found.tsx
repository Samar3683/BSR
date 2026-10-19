import type { Metadata } from "next";
import Image from "next/image";

import { BrandLogo } from "@/components/brand/brand-logo";
import { Container } from "@/components/layout/container";
import { Eyebrow } from "@/components/layout/eyebrow";
import { Surface } from "@/components/layout/surface";
import { ButtonLink } from "@/components/ui/button";
import { MAPS } from "@/config/media-manifest";
import { siteConfig } from "@/config/site";
import { MAIN_CONTENT_ID } from "@/constants/landmarks";

export const metadata: Metadata = {
  title: "Pagina non trovata",
};

/**
 * Not found, on Soft White: plain words and two ways back — home or the quote
 * request. Behind them, the supplied coverage map's geography only, quiet
 * (decorative): no route leads here.
 */
export default function NotFound() {
  return (
    <main id={MAIN_CONTENT_ID} tabIndex={-1}>
      <Surface as="section" tone="soft-white" className="relative isolate overflow-clip">
        <Image
          src={MAPS.geography}
          alt=""
          fill
          unoptimized
          className="-z-10 [mask-image:radial-gradient(ellipse_60%_60%_at_60%_50%,black_40%,transparent_95%)] object-cover opacity-50"
        />
        <Container className="flex min-h-svh flex-col justify-center gap-6 py-section-sm">
          <BrandLogo heightClass="h-16" className="self-start" />
          <Eyebrow>Errore 404 · Pagina non trovata</Eyebrow>
          <h1 className="max-w-[14ch] type-display-lg max-sm:text-[2.375rem]">
            Questa pagina non esiste.
          </h1>
          <p className="max-w-text type-body-lg text-text-secondary">
            Il link potrebbe essere errato o la pagina è stata spostata.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={siteConfig.routes.quoteRequest} size="lg">
              Richiedi un preventivo
            </ButtonLink>
            <ButtonLink href="/" variant="secondary" size="lg">
              Torna alla pagina principale
            </ButtonLink>
          </div>
        </Container>
      </Surface>
    </main>
  );
}
