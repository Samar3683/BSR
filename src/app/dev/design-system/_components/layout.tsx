import { Surface } from "@/components/layout/surface";

import { PreviewSection, SpecLabel } from "./preview-section";

// Literal class names so Tailwind can detect them.
const SPACING: Array<[string, string]> = [
  ["1 · 4px", "w-1"],
  ["2 · 8px", "w-2"],
  ["3 · 12px", "w-3"],
  ["4 · 16px", "w-4"],
  ["6 · 24px", "w-6"],
  ["8 · 32px", "w-8"],
  ["12 · 48px", "w-12"],
  ["16 · 64px", "w-16"],
  ["24 · 96px", "w-24"],
  ["32 · 128px", "w-32"],
];

const LAYOUT_SPACING: Array<[string, string]> = [
  ["gutter", "w-gutter"],
  ["grid-gap", "w-grid-gap"],
  ["section-sm", "w-section-sm"],
  ["section", "w-section"],
  ["section-lg", "w-section-lg"],
];

const WIDTHS: Array<[string, string]> = [
  ["text-narrow · 32rem", "max-w-text-narrow"],
  ["text · 40rem", "max-w-text"],
  ["text-wide · 48rem", "max-w-text-wide"],
  ["content · 80rem", "max-w-content"],
  ["wide · 110rem", "max-w-wide"],
];

export function LayoutPreview() {
  return (
    <PreviewSection
      id="layout"
      title="Layout, spacing & depth"
      description="4px-based spacing steps, fluid layout spacing, content widths, and a 4 / 8 / 12-column grid. Resize the window to see gutters, gaps and columns adapt."
    >
      <div className="grid gap-10 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <SpecLabel>component spacing steps</SpecLabel>
          {SPACING.map(([label, width]) => (
            <div key={label} className="flex items-center gap-4">
              <span className={`${width} h-3 bg-text-secondary`} />
              <span className="type-metadata text-text-muted">{label}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <SpecLabel>layout spacing (fluid, current viewport)</SpecLabel>
          {LAYOUT_SPACING.map(([label, width]) => (
            <div key={label} className="flex items-center gap-4">
              <span className={`${width} h-3 bg-success-graphic`} />
              <span className="type-metadata text-text-muted">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <SpecLabel>grid — columns: 4 (base) · 8 (md) · 12 (lg)</SpecLabel>
        <div className="layout-grid" aria-hidden="true">
          {Array.from({ length: 12 }, (_, index) => (
            <span
              key={index}
              className="h-16 rounded-sm bg-overlay-pressed max-md:[&:nth-child(n+5)]:hidden max-lg:[&:nth-child(n+9)]:hidden"
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <SpecLabel>content widths</SpecLabel>
        {WIDTHS.map(([label, width]) => (
          <div key={label} className={`${width} rounded-sm border border-border-default px-3 py-2`}>
            <span className="type-metadata text-text-muted">{label}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {(["graphite", "soft-white"] as const).map((tone) => (
          <Surface key={tone} tone={tone} className="flex flex-col gap-6 rounded-lg p-6 sm:p-8">
            <SpecLabel>elevation & radius · {tone}</SpecLabel>
            <div className="grid grid-cols-3 gap-4">
              {(
                [
                  ["ambient · sm", "shadow-ambient rounded-sm"],
                  ["raised · md", "shadow-raised rounded-md"],
                  ["overlay · lg", "shadow-overlay rounded-lg"],
                ] as const
              ).map(([label, classes]) => (
                <div key={label} className={`${classes} bg-surface-elevated p-4`}>
                  <span className="type-metadata text-text-muted">{label}</span>
                </div>
              ))}
            </div>
          </Surface>
        ))}
      </div>
    </PreviewSection>
  );
}
