import { ArrowDown, ArrowRight, MessageCircle } from "lucide-react";

import { Container } from "@/components/layout/container";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

import { HERO_STILLS } from "../config/hero-assets";
import { heroContent } from "../config/hero-content";
import styles from "./hero.module.css";
import { HeroCinematic } from "./hero-cinematic";
import { HeroPicture } from "./hero-picture";

/**
 * The hero's semantic shell (Server Component). Everything a visitor needs —
 * what BSR does, where, and how to start — is HTML here, readable and usable
 * before (and without) JavaScript. The client island only adds decorative
 * visual layers inside the stage.
 */
export function HeroSection() {
  const { eyebrow, headline, supporting, primaryCta, whatsapp, scrollCue, roadLine } = heroContent;

  return (
    <section className={styles.hero} aria-labelledby="hero-title" data-hero>
      <div className={styles.copyTrack}>
        <div className={styles.copy}>
          <Container className="flex flex-col gap-5 md:gap-6">
            <div className="flex max-w-[34rem] flex-col gap-4 lg:max-w-[38rem]">
              <p className="type-label-sm text-text-secondary">{eyebrow}</p>
              <h1
                id="hero-title"
                className="type-display-lg text-text-primary [@media(max-height:39.99rem)]:type-heading-xl"
              >
                {headline}
              </h1>
              <p className="max-w-text-narrow type-body-lg text-text-secondary">{supporting}</p>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <ButtonLink href={primaryCta.href} size="lg" trailingIcon={ArrowRight}>
                  {primaryCta.label}
                </ButtonLink>
                <ButtonLink
                  href={whatsapp.href}
                  variant="secondary"
                  size="lg"
                  leadingIcon={MessageCircle}
                >
                  {whatsapp.label}
                  <span className="sr-only"> {whatsapp.externalHint}</span>
                </ButtonLink>
              </div>
              <p className="type-caption text-text-muted">{primaryCta.note}</p>
            </div>
            <p
              aria-hidden="true"
              className="hidden items-center gap-2 type-label-sm text-text-muted md:flex"
            >
              <Icon icon={ArrowDown} size="sm" />
              {scrollCue}
            </p>
          </Container>
        </div>
      </div>

      <p
        className={`${styles.roadLine} container-content type-heading-md text-text-primary`}
        aria-hidden={roadLine.decorative || undefined}
      >
        {roadLine.text}
      </p>

      <div className={styles.stageTrack}>
        <div className={styles.stage}>
          <HeroPicture still={HERO_STILLS[0]!} priority />
          <HeroCinematic />
          <div className={styles.scrim} />
        </div>
      </div>
    </section>
  );
}
