import { PreviewSection, SpecLabel } from "./preview-section";

// Literal class names so Tailwind can detect them.
const STYLES: Array<{ name: string; className: string; sample: string; use: string }> = [
  {
    name: "display-xl",
    className: "type-display-xl",
    sample: "Display",
    use: "One cinematic statement per view",
  },
  {
    name: "display-lg",
    className: "type-display-lg",
    sample: "Display Large",
    use: "Section openers",
  },
  {
    name: "heading-xl",
    className: "type-heading-xl",
    sample: "Heading Example",
    use: "Primary section heading",
  },
  {
    name: "heading-lg",
    className: "type-heading-lg",
    sample: "Heading Example",
    use: "Sub-section heading",
  },
  {
    name: "heading-md",
    className: "type-heading-md",
    sample: "Heading Example",
    use: "Group / card heading",
  },
  {
    name: "heading-sm",
    className: "type-heading-sm",
    sample: "Heading Example",
    use: "Minor heading",
  },
  {
    name: "body-lg",
    className: "type-body-lg",
    sample: "Body Copy Example for introductory paragraphs.",
    use: "Lead paragraphs",
  },
  {
    name: "body-md",
    className: "type-body-md",
    sample: "Body Copy Example for standard reading text.",
    use: "Default body",
  },
  {
    name: "body-sm",
    className: "type-body-sm",
    sample: "Body Copy Example for dense supporting text.",
    use: "Hints, secondary copy",
  },
  {
    name: "label-lg",
    className: "type-label-lg",
    sample: "Label Example",
    use: "Buttons, prominent labels",
  },
  {
    name: "label-md",
    className: "type-label-md",
    sample: "Label Example",
    use: "Form labels, utility links",
  },
  {
    name: "label-sm",
    className: "type-label-sm",
    sample: "Eyebrow Example",
    use: "Eyebrows, badges",
  },
  { name: "stat-xl", className: "type-stat-xl", sample: "1 234", use: "Headline figures" },
  { name: "stat-lg", className: "type-stat-lg", sample: "56 789", use: "Supporting figures" },
  {
    name: "caption",
    className: "type-caption",
    sample: "Caption Example",
    use: "Media captions, notes",
  },
  {
    name: "metadata",
    className: "type-metadata",
    sample: "REF 00-000 · 00:00",
    use: "Codes, timestamps",
  },
];

export function TypographyPreview() {
  return (
    <PreviewSection
      id="typography"
      title="Typography"
      description="Archivo, one variable family. Display and stat styles use the width axis (expanded); reading styles stay at normal width. Figures in stats and metadata are tabular."
    >
      <dl className="flex flex-col">
        {STYLES.map((style) => (
          <div
            key={style.name}
            className="grid gap-3 border-b border-border-subtle py-6 md:grid-cols-[14rem_1fr] md:gap-8"
          >
            <dt className="flex flex-col gap-1">
              <SpecLabel>type-{style.name}</SpecLabel>
              <span className="type-caption text-text-muted">{style.use}</span>
            </dt>
            <dd className={`${style.className} min-w-0 break-words`}>{style.sample}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-8 md:grid-cols-2">
        <article className="flex max-w-text flex-col gap-4">
          <p className="type-label-sm text-text-muted">Eyebrow Example</p>
          <h3 className="type-heading-xl">Headline Example</h3>
          <p className="type-body-lg text-text-secondary">
            Supporting copy example. Hierarchy reads eyebrow → headline → supporting copy → metadata
            → actions.
          </p>
          <p className="type-metadata text-text-muted">Metadata Example · 00:00</p>
        </article>
        <article className="flex max-w-text flex-col gap-4">
          <p className="type-body-md">
            Reading measure example. Body copy is constrained with max-w-text (40rem) so lines stay
            comfortable on very wide displays. Paragraphs never span the full width of a cinematic
            layout, no matter how large the viewport becomes, because long lines make it harder for
            the eye to find the start of the next line.
          </p>
        </article>
      </div>
    </PreviewSection>
  );
}
