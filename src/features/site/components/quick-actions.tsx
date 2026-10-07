"use client";

import { MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { ActionLink } from "@/components/editorial/action";
import { siteConfig } from "@/config/site";
import { cx } from "@/lib/utils/cx";

import { siteNavigation as nav } from "../config/site-navigation";

/**
 * Quote access that stays at hand on the home page. It appears once the hero
 * has scrolled away and steps aside while a conversion section (marked
 * `data-conversion`: the request form, the closing chapter) or the footer is
 * in view — they carry the same actions — so it never duplicates or covers them.
 * - Phones: a compact bar — the quote request (red) and WhatsApp.
 * - From `lg`: one compact floating quote button, bottom right.
 * Hidden, it is `inert`: focus and assistive technology never reach an
 * invisible control. Pages without a hero or quote chapter just show it.
 */
export function QuickActions() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hero = document.querySelector("[data-hero]");
    const ends = [
      ...document.querySelectorAll<HTMLElement>("[data-conversion]"),
      document.querySelector("footer"),
    ].filter((element): element is HTMLElement => element !== null);
    let pastHero = hero === null;
    const endsInView = new Set<Element>();
    const update = () => setVisible(pastHero && endsInView.size === 0);

    const heroObserver = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      pastHero = !entry.isIntersecting && entry.boundingClientRect.top < 0;
      update();
    });
    const endObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) endsInView.add(entry.target);
        else endsInView.delete(entry.target);
      }
      update();
    });
    if (hero) heroObserver.observe(hero);
    ends.forEach((element) => endObserver.observe(element));
    update();
    return () => {
      heroObserver.disconnect();
      endObserver.disconnect();
    };
  }, []);

  return (
    <div
      data-quick-actions
      data-surface="white"
      data-visible={visible || undefined}
      inert={!visible}
      className={cx(
        "fixed inset-x-0 bottom-0 z-(--z-sticky) transition-[translate,opacity] duration-500 ease-enter motion-reduce:transition-none",
        "lg:inset-x-auto lg:right-6 lg:bottom-6",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0",
      )}
    >
      <div className="flex gap-2 border-t border-hairline bg-background-primary/96 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden">
        <ActionLink href={nav.cta.href} className="min-w-0 flex-1">
          {nav.cta.label}
        </ActionLink>
        {/* Icon-only on the narrowest phones; the name stays for assistive technology. */}
        <ActionLink
          href={siteConfig.contact.whatsappHref}
          variant="outline"
          leadingIcon={MessageCircle}
          icon={null}
          className="shrink-0 max-sm:px-3.5"
        >
          <span className="max-sm:sr-only">{nav.menu.whatsapp}</span>
          <span className="sr-only"> {nav.menu.whatsappHint}</span>
        </ActionLink>
      </div>
      <div className="hidden lg:block">
        <ActionLink href={nav.cta.href}>
          <span className="sr-only">Richiedi un </span>
          {nav.cta.shortLabel}
        </ActionLink>
      </div>
    </div>
  );
}
