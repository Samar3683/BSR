import { Checkbox } from "@/components/forms/choice";
import { MOTION_DURATION, MOTION_PRESET } from "@/lib/animation/motion-tokens";

import { PreviewSection, SpecLabel } from "./preview-section";

const EASINGS = ["ui", "enter", "exit", "cinematic", "mechanical"] as const;

const LAYERS: Array<[string, string]> = [
  ["canvas", "WebGL scene, beneath HTML"],
  ["content", "Page content"],
  ["cinematic-ui", "HTML synchronised with a scene"],
  ["sticky", "Sticky in-page elements"],
  ["navigation", "Site navigation"],
  ["overlay", "Scrims, drawers"],
  ["modal", "Dialogs"],
  ["toast", "Transient notifications"],
  ["skip-link", "Skip link (always on top)"],
];

export function MotionPreview() {
  return (
    <PreviewSection
      id="motion"
      title="Motion & layers"
      description="Weighted, precise, no bounce. Frequent interactions stay fast; only scene-level motion is slow. Under reduced motion the demo jumps to its end state instead of travelling."
    >
      <div className="grid gap-10 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <SpecLabel>durations</SpecLabel>
          <dl className="grid grid-cols-[8rem_1fr] gap-y-2">
            {Object.entries(MOTION_DURATION).map(([name, seconds]) => (
              <div key={name} className="contents">
                <dt className="type-label-md">{name}</dt>
                <dd className="type-metadata text-text-muted">{Math.round(seconds * 1000)}ms</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="flex flex-col gap-3">
          <SpecLabel>categories (MOTION_PRESET)</SpecLabel>
          <dl className="grid grid-cols-[8rem_1fr] gap-y-2">
            {Object.entries(MOTION_PRESET).map(([name, preset]) => (
              <div key={name} className="contents">
                <dt className="type-label-md">{name}</dt>
                <dd className="type-metadata text-text-muted">
                  {Math.round(preset.duration * 1000)}ms · {preset.ease}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="group/demo flex flex-col gap-4">
        <Checkbox label="Run easing demo (800ms each)" />
        {EASINGS.map((ease) => (
          <div key={ease} className="flex items-center gap-4">
            <span className="w-28 shrink-0 type-metadata text-text-muted">ease-{ease}</span>
            <div className="relative h-3 flex-1 rounded-full bg-overlay-hover">
              <span
                data-easing-demo
                className="absolute top-0 left-0 size-3 rounded-full bg-success-graphic group-has-checked/demo:left-[calc(100%-0.75rem)] motion-safe:transition-[left] motion-safe:duration-(--duration-cinematic)"
                style={{ transitionTimingFunction: `var(--ease-${ease})` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <SpecLabel>layers (z-(--z-*)), bottom to top</SpecLabel>
        <ol className="grid gap-2 sm:grid-cols-3">
          {LAYERS.map(([name, use]) => (
            <li key={name} className="rounded-md border border-border-subtle px-4 py-3">
              <p className="type-label-md">--z-{name}</p>
              <p className="type-caption text-text-muted">{use}</p>
            </li>
          ))}
        </ol>
      </div>
    </PreviewSection>
  );
}
