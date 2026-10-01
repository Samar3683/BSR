import { PreviewSection, SpecLabel } from "./preview-section";

const GROUPS: Array<{ title: string; tokens: string[] }> = [
  { title: "Dark materials", tokens: ["carbon", "graphite", "asphalt", "iron"] },
  {
    title: "Metal neutrals",
    tokens: ["slate", "mist", "shale", "pewter", "smoke", "titanium"],
  },
  { title: "Light materials", tokens: ["white", "soft-white", "warm-white", "line"] },
  { title: "Red", tokens: ["red-300", "red-400", "red-500", "red-600", "red-700"] },
  { title: "Green", tokens: ["green-300", "green-500", "green-600", "green-700", "green-800"] },
  {
    title: "Status tints",
    tokens: ["red-tint-dark", "green-tint-dark", "red-tint-light", "green-tint-light"],
  },
];

export function PalettePreview() {
  return (
    <PreviewSection
      id="palette"
      title="Palette primitives"
      description="Raw materials. Components never use these directly; they use the semantic roles shown under Surfaces."
    >
      <div className="grid gap-10 md:grid-cols-2">
        {GROUPS.map((group) => (
          <div key={group.title} className="flex flex-col gap-4">
            <h3 className="type-label-sm text-text-secondary">{group.title}</h3>
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6 md:grid-cols-3 xl:grid-cols-6">
              {group.tokens.map((token) => (
                <li key={token} className="flex flex-col gap-2">
                  <span
                    className="block aspect-square rounded-md border border-border-default"
                    style={{ backgroundColor: `var(--color-${token})` }}
                  />
                  <SpecLabel>{token}</SpecLabel>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </PreviewSection>
  );
}
