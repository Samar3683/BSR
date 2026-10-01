import { BrandMark } from "@/components/brand/brand-mark";
import { ProofList } from "@/components/data/proof-list";
import { Stat, StatList } from "@/components/data/stat";
import { RouteMarker } from "@/components/graphics/route-marker";
import { Thread } from "@/components/graphics/thread";
import { Divider } from "@/components/layout/divider";
import { Eyebrow } from "@/components/layout/eyebrow";
import { SectionHeader } from "@/components/layout/section-header";
import { Surface, type SurfaceTone } from "@/components/layout/surface";
import { MediaSlot } from "@/components/media/media-slot";
import { TextLink } from "@/components/ui/text-link";

import { PreviewSection, SpecLabel } from "./preview-section";

const PLATE_TONES: SurfaceTone[] = ["carbon", "soft-white"];

export function EditorialPreview() {
  return (
    <PreviewSection
      id="editorial"
      title="Editorial & media-ready"
      description="Page-level building blocks below the hero. Media slots reserve a fixed proportion for future photography or video and collapse (or show designed artwork) until it exists — never a stand-in photograph."
    >
      <div className="flex flex-col gap-3">
        <SpecLabel>BrandMark (placeholder wordmark until the official logo)</SpecLabel>
        <div className="grid gap-6 sm:grid-cols-2">
          {PLATE_TONES.map((tone) => (
            <Surface key={tone} tone={tone} className="rounded-lg border border-border-subtle p-8">
              <BrandMark />
            </Surface>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <SpecLabel>Eyebrow, Divider, RouteMarker</SpecLabel>
        <Surface tone="soft-white" className="flex flex-col gap-6 rounded-lg p-6 sm:p-8">
          <Eyebrow>Eyebrow</Eyebrow>
          <Divider />
          <div className="relative flex flex-col gap-4">
            <Divider tone="strong" />
            <RouteMarker className="absolute top-0 left-0 -translate-y-1/2" />
            <p className="type-body-sm text-text-secondary">
              RouteMarker on a Divider · a process step or a stage on a route
            </p>
          </div>
        </Surface>
      </div>

      <div className="flex flex-col gap-3">
        <SpecLabel>SectionHeader · row (default), stacked</SpecLabel>
        <Surface tone="soft-white" className="flex flex-col gap-16 rounded-lg p-6 sm:p-10">
          <SectionHeader
            id="preview-header-split"
            eyebrow="Eyebrow"
            title="Section Heading Example across two lines."
            intro="Intro paragraph example in the reading measure, one or two sentences long."
            action={<TextLink href="#editorial">Secondary Action</TextLink>}
          />
          <SectionHeader
            id="preview-header-stacked"
            eyebrow="Eyebrow"
            title="Stacked Heading."
            intro="For narrow columns and split sections."
            layout="stacked"
          />
        </Surface>
      </div>

      <div className="flex flex-col gap-3">
        <SpecLabel>StatList / Stat (confirmed figures only)</SpecLabel>
        <Surface tone="carbon" className="rounded-lg p-6 sm:p-10">
          <StatList>
            <Stat value="00" unit="unit" label="Stat Label" detail="One-line detail example." />
            <Stat value="0" label="Stat Label" detail="One-line detail example." />
            <Stat value="Word" label="Stat Label" />
          </StatList>
        </Surface>
      </div>

      <div className="flex flex-col gap-3">
        <SpecLabel>ProofList · Divider draw · Thread</SpecLabel>
        <Surface tone="carbon" className="grid gap-10 rounded-lg p-6 sm:grid-cols-2 sm:p-10">
          <ProofList
            items={[
              { headline: "Proof Headline", detail: "One-line detail example." },
              { headline: "Proof Headline" },
            ]}
          />
          <div className="flex flex-col gap-6">
            <Divider tone="strong" draw />
            <Thread className="relative h-32" />
          </div>
        </Surface>
      </div>

      <div className="flex flex-col gap-3">
        <SpecLabel>MediaSlot · empty (collapses) and with designed fallback artwork</SpecLabel>
        <Surface tone="soft-white" className="grid gap-6 rounded-lg p-6 sm:grid-cols-2 sm:p-8">
          <div className="flex flex-col gap-2">
            <MediaSlot name="preview-empty" aspect="3/2" />
            <p className="type-caption text-text-muted">Empty slot: nothing renders.</p>
          </div>
          <MediaSlot
            name="preview-fallback"
            aspect="3/2"
            className="bg-surface-secondary"
            fallback={
              <span className="absolute inset-0 grid place-items-center type-metadata text-text-muted">
                Fallback artwork
              </span>
            }
          />
        </Surface>
      </div>
    </PreviewSection>
  );
}
