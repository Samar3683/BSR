import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { isDesignPreviewEnabled } from "@/config/dev";
import { SITE_LIVERY } from "@/config/media";
import {
  ARCHIVE,
  type Livery,
  MAPS,
  type MediaAsset,
  SCENES,
  type SceneId,
} from "@/config/media-manifest";
import { MAIN_CONTENT_ID } from "@/constants/landmarks";

export const metadata: Metadata = {
  title: "Media review (developer preview)",
  robots: { index: false, follow: false },
};

/** Where each scene appears on the public site (src/config/site-media.ts: each once). */
const USAGE: Record<SceneId, string> = {
  "express-motorway": "Home · Servizi — Trasporto espresso · social card",
  "dedicated-dock": "Home · Servizi — Trasporto dedicato",
  "wrapped-pallet": "Home · Per chi lavoriamo — shared preview stage",
  "forklift-loading": "Home · Come funziona — the journey's photograph",
  van: "Home · Flotta — Furgone",
  "rigid-truck": "Home · Flotta — Motrice",
  "articulated-truck": "Home · Flotta — Articolato",
  "coverage-aerial": "Home · Copertura — background layer",
  "secured-cargo": "Home · Sicurezza del carico",
  "direct-contact": "Home · Chi siamo (illustrative, captioned)",
  "truck-departure": "Home · Final call to action — background",
  "cargo-dispatch": "Not placed (extra scene, custom-wrap livery only)",
};

const LIVERIES: Livery[] = ["final", "custom-wrap", "black", "blue", "green", "red"];
const VEHICLE_SCENES: SceneId[] = [
  "express-motorway",
  "dedicated-dock",
  "direct-contact",
  "van",
  "rigid-truck",
  "articulated-truck",
  "cargo-dispatch",
];

function Thumb({ asset, label, note }: { asset: MediaAsset; label: string; note?: string }) {
  return (
    <figure className="flex flex-col gap-2">
      <div className="relative aspect-[3/2] overflow-hidden rounded-sm bg-surface-secondary">
        <Image
          src={asset.src}
          alt={label}
          fill
          sizes="(min-width: 64rem) 20vw, 50vw"
          placeholder="blur"
          blurDataURL={asset.blurDataURL}
          className="object-cover"
        />
      </div>
      <figcaption className="flex flex-col gap-0.5">
        <span className="type-label-md">{label}</span>
        <span className="type-metadata text-text-muted tabular-nums">
          {asset.width} × {asset.height} · {asset.src.replace("/assets/images/content/", "")}
        </span>
        {note && <span className="type-caption text-text-secondary">{note}</span>}
      </figcaption>
    </figure>
  );
}

/**
 * Internal review of the supplied image package: every file, what is live and
 * where, the alternative livery sets side by side (switch with SITE_LIVERY in
 * src/config/media.ts), the archive, and the map variants. Not linked publicly.
 */
export default function MediaReviewPage() {
  if (!isDesignPreviewEnabled(process.env)) notFound();
  const live = SCENES[SITE_LIVERY];
  const maps: Array<[string, string, string]> = [
    ["Light (full)", MAPS.light, "Quote-request page"],
    ["Dark (full)", MAPS.dark, "Source of the home coverage map"],
    ["Geography only", MAPS.geography, "Not-found page (backdrop)"],
    ["Routes only", MAPS.routes, "Home coverage map — animated route layer (inline)"],
    ["Dark geography (derived)", MAPS.geographyDark, "Home coverage map — base layer"],
  ];

  return (
    <main id={MAIN_CONTENT_ID} tabIndex={-1} lang="en">
      <Container className="flex flex-col gap-4 py-section-sm">
        <p className="type-label-sm text-text-muted">Developer preview · not public</p>
        <h1 className="type-display-lg">Media review</h1>
        <p className="max-w-text type-body-lg text-text-secondary">
          Every image of the supplied package (assets/source/BSR-All-Images-WebP-SVG), imported by
          tools/media/import-site-media.mjs. Live livery: <strong>{SITE_LIVERY}</strong>.
        </p>
      </Container>

      <Section spacing="sm" aria-labelledby="live" className="border-t border-border-subtle">
        <Container className="flex flex-col gap-8">
          <h2 id="live" className="type-heading-lg">
            Live on the site
          </h2>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {(Object.entries(live) as Array<[SceneId, MediaAsset]>).map(([id, asset]) => (
              <Thumb key={id} asset={asset} label={id} note={USAGE[id]} />
            ))}
          </div>
        </Container>
      </Section>

      <Section spacing="sm" aria-labelledby="liveries" className="border-t border-border-subtle">
        <Container className="flex flex-col gap-8">
          <h2 id="liveries" className="type-heading-lg">
            Livery sets
          </h2>
          <p className="max-w-text type-body-md text-text-secondary">
            The same scenes in each livery. Only the livery the real fleet carries should go live.
          </p>
          {VEHICLE_SCENES.map((id) => (
            <div key={id} className="flex flex-col gap-4">
              <h3 className="type-label-lg">{id}</h3>
              <div className="grid gap-6 sm:grid-cols-3 lg:grid-cols-6">
                {LIVERIES.map((livery) => {
                  const asset = SCENES[livery][id];
                  return asset ? (
                    <Thumb key={livery} asset={asset} label={livery} />
                  ) : (
                    <p key={livery} className="type-caption text-text-muted">
                      {livery}: not in this set
                    </p>
                  );
                })}
              </div>
            </div>
          ))}
        </Container>
      </Section>

      <Section spacing="sm" aria-labelledby="archive" className="border-t border-border-subtle">
        <Container className="flex flex-col gap-8">
          <h2 id="archive" className="type-heading-lg">
            Archive
          </h2>
          <p className="max-w-text type-body-md text-text-secondary">
            Superseded drafts, first renders and livery references — never on public pages.
          </p>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {ARCHIVE.map((asset) => (
              <Thumb key={asset.src} asset={asset} label={asset.name} note={asset.group} />
            ))}
          </div>
        </Container>
      </Section>

      <Section spacing="sm" aria-labelledby="maps" className="border-t border-border-subtle">
        <Container className="flex flex-col gap-8">
          <h2 id="maps" className="type-heading-lg">
            Coverage map
          </h2>
          <div className="grid gap-8 md:grid-cols-2">
            {maps.map(([label, src, note]) => (
              <figure key={src} className="flex flex-col gap-2">
                <div className="relative aspect-[1800/1000] overflow-hidden rounded-sm bg-surface-secondary">
                  <Image src={src} alt={label} fill unoptimized />
                </div>
                <figcaption className="flex flex-col gap-0.5">
                  <span className="type-label-md">{label}</span>
                  <span className="type-caption text-text-secondary">{note}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </Container>
      </Section>
    </main>
  );
}
