"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { BrandLogo } from "@/components/brand/brand-logo";
import { ActionLink } from "@/components/editorial/action";

import { siteNavigation as nav } from "../config/site-navigation";
import { type HeaderScroll, type HeaderState, nextHeaderState } from "../lib/header-state";
import { MobileMenu } from "./mobile-menu";

/**
 * Site header (see docs/hero-ui-visual-map.md, "Navbar"):
 * - at the top of the home page it is transparent over the hero's dark
 *   opening frame, with light text; pages without the hero open on the bar;
 * - scrolling down past the threshold slides it away, so the page leads;
 * - scrolling up brings it back as a compact White bar (64px, a light backdrop
 *   blur, a hairline), underlined by the brand's route rule: green, arriving on
 *   a short red destination; navigation in mono capitals, the section in view
 *   green, the request a red pill;
 * - keyboard focus inside it always brings it back (CSS :focus-within);
 * - without JavaScript it is a solid bar: Carbon over the home page's hero,
 *   White elsewhere.
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
      .map((id) =>
        id === "hero" ? document.querySelector("[data-hero]") : document.getElementById(id),
      )
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
      data-surface={overHero ? "carbon" : "white"}
      data-state={state}
      data-transparent={overHero || undefined}
      className={
        "fixed inset-x-0 top-0 z-(--z-navigation) h-(--header-height) border-b border-hairline bg-background-primary/95 text-text-primary backdrop-blur-md " +
        "transition-[translate,background-color,border-color,height] duration-(--duration-normal) ease-ui data-[state=shown]:h-16 motion-reduce:transition-none " +
        "[@media(scripting:enabled)]:data-transparent:border-transparent [@media(scripting:enabled)]:data-transparent:bg-transparent " +
        "data-[state=hidden]:not-focus-within:-translate-y-full"
      }
    >
      <div className="ed-frame flex h-full items-center justify-between gap-6">
        <a
          href={nav.home.href}
          aria-label={nav.home.label}
          className="inline-flex min-h-(--target-min) items-center rounded-sm"
        >
          {/* The logo is dark: over the hero's dark opening frame it sits on a light plate. */}
          <BrandLogo plate={overHero} priority />
        </a>
        <nav aria-label={nav.label} className="hidden xl:block">
          <ul className="flex items-center gap-7">
            {nav.links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  aria-current={home && current === link.href ? "location" : undefined}
                  className="group/nav relative inline-flex min-h-(--target-min) items-center ed-label text-text-secondary transition-colors duration-200 hover:text-text-primary aria-[current=location]:text-text-primary"
                >
                  {link.label}
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-2 h-0.5 origin-left scale-x-0 bg-success-graphic transition-transform duration-300 ease-ui group-aria-[current=location]/nav:scale-x-100 motion-reduce:transition-none"
                  />
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <ActionLink href={nav.cta.href} className="max-sm:hidden">
            {nav.cta.label}
          </ActionLink>
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
