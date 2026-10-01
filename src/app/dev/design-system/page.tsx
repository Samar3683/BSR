import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Container } from "@/components/layout/container";
import { isDesignPreviewEnabled } from "@/config/dev";
import { MAIN_CONTENT_ID } from "@/constants/landmarks";

import { ControlsPreview } from "./_components/controls";
import { EditorialPreview } from "./_components/editorial";
import { FormsPreview } from "./_components/forms";
import { LayoutPreview } from "./_components/layout";
import { MotionPreview } from "./_components/motion";
import { PalettePreview } from "./_components/palette";
import { SurfacesPreview } from "./_components/surfaces";
import { TypographyPreview } from "./_components/typography";

export const metadata: Metadata = {
  title: "Design system (developer preview)",
  robots: { index: false, follow: false },
};

/** Internal testing surface for the design system. Not linked publicly. */
export default function DesignSystemPreviewPage() {
  if (!isDesignPreviewEnabled(process.env)) notFound();

  return (
    <main id={MAIN_CONTENT_ID} tabIndex={-1} lang="en">
      <Container className="flex flex-col gap-4 py-section-sm">
        <p className="type-label-sm text-text-muted">Developer preview · not public</p>
        <h1 className="type-display-lg">Design System</h1>
        <p className="max-w-text type-body-lg text-text-secondary">
          Tokens, primitives and states for validation. Labels are neutral placeholders, not
          content.
        </p>
      </Container>
      <PalettePreview />
      <SurfacesPreview />
      <TypographyPreview />
      <ControlsPreview />
      <FormsPreview />
      <LayoutPreview />
      <EditorialPreview />
      <MotionPreview />
    </main>
  );
}
