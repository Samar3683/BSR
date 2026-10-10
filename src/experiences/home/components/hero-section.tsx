import { ArrowRight } from "lucide-react";
import Image from "next/image";
import type { CSSProperties } from "react";

import { heroContent } from "../config/hero-content";
import { HERO_VIDEO } from "../config/hero-video";
import styles from "./hero.module.css";
import { HeroVideo } from "./hero-video";

/**
 * The hero's semantic shell (Server Component). Everything a visitor needs —
 * what BSR does, where, and how to start — is HTML here, readable and usable
 * before (and without) JavaScript, over the poster: the video's own first frame.
 * The client island (HeroVideo) only adds the scroll-scrubbed video and drives
 * the copy and cue opacities.
 *
 * Without JavaScript, under reduced motion and when the video cannot play, the
 * hero is static: one viewport, the poster and the copy, no pinned scroll.
 */
export function HeroSection() {
  const { eyebrow, headline, supporting, primaryCta, whatsapp } = heroContent;
  const config = {
    "--hero-story-regular": HERO_VIDEO.scroll.regular,
    "--hero-story-compact": HERO_VIDEO.scroll.compact,
    "--hero-framing-regular": HERO_VIDEO.framing.regular,
    "--hero-framing-compact": HERO_VIDEO.framing.compact,
  } as CSSProperties;

  return (
    <section className={styles.hero} aria-labelledby="hero-title" data-hero style={config}>
      {/* No JavaScript: a static hero, never a long pinned still. */}
      <noscript>
        <style>{`[data-hero]{--hero-story:0px!important}[data-hero-cue]{display:none!important}`}</style>
      </noscript>
      <div className={styles.stage} data-hero-stage>
        <div className={styles.media}>
          {/* The poster is the LCP: eager, high priority, the encoded video's first frame. */}
          <Image
            src={HERO_VIDEO.poster.src}
            alt=""
            fill
            priority
            fetchPriority="high"
            sizes="100vw"
            className={styles.poster}
          />
          <HeroVideo />
          <div className={styles.scrim} aria-hidden="true" />
          <div className={styles.shade} aria-hidden="true" />
        </div>

        <div className={styles.panel}>
          {/* The page container the header uses (ed-frame): the copy aligns with the logo. */}
          <div className={styles.copy} data-hero-copy>
            <div className={`ed-frame ${styles.frame}`}>
              <div className={styles.block}>
                <p className={styles.eyebrow}>{eyebrow}</p>
                <h1 id="hero-title" className={styles.title}>
                  <span className={styles.titleMain}>
                    {headline.main.map((line, i) => (
                      <span key={line} className={styles.titleLine}>
                        {i > 0 && " "}
                        {line}
                      </span>
                    ))}
                  </span>{" "}
                  <span className={styles.titleSub}>{headline.sub}</span>
                </h1>
                <p className={styles.lead}>{supporting}</p>
                <div className={styles.actions}>
                  <a href={primaryCta.href} className={styles.primary}>
                    {primaryCta.label}
                    <ArrowRight aria-hidden="true" className={styles.arrow} strokeWidth={2} />
                  </a>
                  <a href={whatsapp.href} className={styles.secondary}>
                    <WhatsAppGlyph className={styles.glyph} />
                    {whatsapp.label}
                    <span className="sr-only"> {whatsapp.externalHint}</span>
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Text cues placed on the footage (config/hero-video.ts); hidden until their scene. */}
          {HERO_VIDEO.cues.map((cue) => (
            <div key={cue.id} className={styles.cue} data-hero-cue={cue.id} inert>
              <div className={`ed-frame ${styles.frame}`}>
                <div className={styles.block}>
                  <p className={styles.eyebrow}>
                    <span aria-hidden="true" className={styles.rule} />
                    {cue.label}
                  </p>
                  <p className={styles.cueText}>{cue.text}</p>
                  {"action" in cue && cue.action && (
                    <div className={styles.actions}>
                      <a href={primaryCta.href} className={styles.primary}>
                        {primaryCta.label}
                        <ArrowRight aria-hidden="true" className={styles.arrow} strokeWidth={2} />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** WhatsApp's glyph (Simple Icons, CC0), drawn in the current text colour. */
function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className}>
      <path
        fill="currentColor"
        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"
      />
    </svg>
  );
}
