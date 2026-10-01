import { ArrowRight } from "lucide-react";

import { Field } from "@/components/forms/field";
import { TextInput } from "@/components/forms/text-input";
import { Surface, type SurfaceTone } from "@/components/layout/surface";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { TextLink } from "@/components/ui/text-link";

import { PreviewSection } from "./preview-section";

const TONES: SurfaceTone[] = ["carbon", "graphite", "asphalt", "white", "soft-white", "warm-white", "green"];

function SurfaceSample({ tone }: { tone: SurfaceTone }) {
  return (
    <Surface
      tone={tone}
      className="flex flex-col gap-6 rounded-lg border border-border-subtle p-6 sm:p-8"
    >
      <div className="flex flex-col gap-3">
        <p className="type-label-sm text-text-muted">Surface · {tone}</p>
        <h3 className="type-heading-md">Heading Example</h3>
        <p className="type-body-md text-text-secondary">
          Body Copy Example with an <TextLink href="#surfaces">inline link</TextLink> and supporting
          detail.
        </p>
        <p className="type-caption text-text-muted">Caption Example</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <StatusBadge status="in-transit" label="In transit" />
        <StatusBadge status="delayed" label="Delayed" />
        <StatusBadge status="error" label="Error" />
      </div>

      <div className="rounded-md bg-surface-elevated p-4 shadow-raised">
        <Field id={`surface-field-${tone}`} label="Field Label">
          {(control) => <TextInput {...control} placeholder="Placeholder" />}
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button trailingIcon={ArrowRight}>Primary Action</Button>
        <Button variant="secondary">Secondary Action</Button>
        <Button variant="inverse" size="sm">
          Inverse
        </Button>
      </div>
    </Surface>
  );
}

export function SurfacesPreview() {
  return (
    <PreviewSection
      id="surfaces"
      title="Surfaces"
      description="The same components on each environment. Semantic roles re-resolve per surface; focus any control to check the focus ring against each background."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        {TONES.map((tone) => (
          <SurfaceSample key={tone} tone={tone} />
        ))}
      </div>
    </PreviewSection>
  );
}
