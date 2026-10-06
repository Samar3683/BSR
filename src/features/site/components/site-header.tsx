"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { BrandMark } from "@/components/brand/brand-mark";
import { ButtonLink } from "@/components/ui/button";
import { TextLink } from "@/components/ui/text-link";

import { siteNavigation as nav } from "../config/site-navigation";
import { type HeaderScroll, type HeaderState, nextHeaderState } from "../lib/header-state";
import { MobileMenu } from "./mobile-menu";

/**
 * Site header (see docs/hero-ui-visual-map.md, "Navbar"):
 * - at the top of the home page it is transparent over the hero's dark
 *   opening frame, with light text; pages without the hero open on the bar;
 * - scrolling down past the threshold slides it away, so the page leads;
 * - scrolling up brings it back as a compact dark Carbon bar (64px, a light
 *   backdrop blur), underlined by the brand's route rule: green, arriving on a
 *   short red destination; the section in view is green;
 * - keyboard focus inside it always brings it back (CSS :focus-within);
 * - without JavaScript it stays a solid Carbon bar over every surface.
 * - on the home page the link of the section in view is marked (a green
 *   underline, aria-current="location"), tracked by one IntersectionObserver
 *   over a thin band across the middle of the viewport.
 * React state changes only when the header state or the section changes,
 * never per scroll event. The full navigation shows from `xl`; below it, the menu.
 */
export function SiteHeader() {
  const [state, setState] = useState<HeaderState>("top");
  const [current, setCurrent] = useState<string | null>(null);
  const home = usePathname() === "/";
  const overHero = home && state === "top";
  const scroll = useRef<HeaderScroll>({ state: "top", anchor: 0 });

  useEffect(() => {
    const onScroll = () => {
      const next = nextHeaderState(scroll.current, window.scrollY);
      scroll.current = next;
      setState(next.state);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!home) return;
    const regions = Object.keys(nav.sections)
      .map((id) => (id === "hero" ? document.querySelector("[data-hero]") : document.getElementById(id)))
      .filter((element): element is Element => element !== null);
    const regionOf = (element: Element) =>
      element.hasAttribute("data-hero") ? "hero" : element.id;
    const inBand = new Set<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) inBand.add(entry.target);
          else inBand.delete(entry.target);
        }
        // One link at a time: the innermost region in view ("Contatti" sits inside "Chi siamo").
        const inner = [...inBand].find(
          (element) => ![...inBand].some((other) => other !== element && element.contains(other)),
        );
        setCurrent(inner ? nav.sections[regionOf(inner)]! : null);
      },
      // A thin band at 40–45% of the viewport: one section at a time.
      { rootMargin: "-40% 0px -55% 0px" },
    );
    regions.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [home]);

  return (
    <header
      data-surface="carbon"
      data-state={state}
      data-transparent={overHero || undefined}
      className={
        "fixed inset-x-0 top-0 z-(--z-navigation) h-(--header-height) border-b border-border-subtle bg-background-primary/94 text-text-primary backdrop-blur-md " +
        "transition-[translate,background-color,border-color,height] duration-(--duration-normal) ease-ui data-[state=shown]:h-16 motion-reduce:transition-none " +
        "[@media(scripting:enabled)]:data-transparent:border-transparent [@media(scripting:enabled)]:data-transparent:bg-transparent " +
        "data-[state=hidden]:not-focus-within:-translate-y-full"
      }
    >
      <div className="container-content flex h-full items-center justify-between gap-6">
        <a
          href={nav.home.href}
          aria-label={nav.home.label}
          className="inline-flex min-h-(--target-min) items-center rounded-sm"
        >
          <BrandMark />
        </a>
        <nav aria-label={nav.label} className="hidden xl:block">
          <ul className="flex items-center gap-7">
            {nav.links.map((link) => (
              <li key={link.href}>
                <TextLink
                  variant="utility"
                  href={link.href}
                  aria-current={home && current === link.href ? "location" : undefined}
                  className="decoration-success-graphic! hover:text-text-primary hover:underline aria-[current=location]:text-success aria-[current=location]:underline"
                >
                  {link.label}
                </TextLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <ButtonLink href={nav.cta.href} size="sm" className="hidden sm:inline-flex">
            {nav.cta.label}
          </ButtonLink>
          <MobileMenu className="xl:hidden" current={home ? current : null} />
        </div>
      </div>
      {/* The brand's route rule, shown with the solid bar: green, then a red destination. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 flex h-0.5 opacity-0 transition-opacity duration-(--duration-normal) in-data-[state=shown]:opacity-100 motion-reduce:transition-none"
      >
        <span className="flex-1 bg-success-graphic" />
        <span className="w-16 bg-action-primary sm:w-24" />
      </span>
    </header>
  );
}
