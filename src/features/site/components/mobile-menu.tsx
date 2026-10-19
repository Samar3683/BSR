"use client";

import { ArrowRight, Menu, MessageCircle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { BrandLogo } from "@/components/brand/brand-logo";
import { ActionLink } from "@/components/editorial/action";
import { IconButton } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

import { siteNavigation as nav } from "../config/site-navigation";

const MENU_ID = "site-menu";

/**
 * Small-screen navigation: a full-screen modal <dialog>. The platform provides
 * focus containment, Escape to close and focus return to the menu button.
 * While open the page behind does not scroll: `overflow: hidden` on the root
 * for touch, and `data-lenis-prevent` so smooth scroll ignores the wheel.
 */
export function MobileMenu({
  className,
  current = null,
}: {
  className?: string;
  /** The href of the section in view (marked green), if any. */
  current?: string | null;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const onClose = () => {
      setOpen(false);
      document.documentElement.style.overflow = "";
    };
    element.addEventListener("close", onClose);
    return () => {
      element.removeEventListener("close", onClose);
      document.documentElement.style.overflow = "";
    };
  }, []);

  const show = () => {
    dialog.current?.showModal();
    document.documentElement.style.overflow = "hidden";
    setOpen(true);
  };
  const close = () => dialog.current?.close();

  return (
    <>
      <IconButton
        icon={Menu}
        label={nav.menu.open}
        variant="ghost"
        aria-expanded={open}
        aria-controls={MENU_ID}
        onClick={show}
        className={className}
      />
      <dialog
        id={MENU_ID}
        ref={dialog}
        aria-label={nav.menu.title}
        data-lenis-prevent
        data-surface="green"
        className="m-0 h-dvh max-h-none w-full max-w-none menu-in overflow-y-auto overscroll-contain bg-green-800 text-text-primary backdrop:bg-transparent open:flex open:flex-col"
      >
        <div className="ed-frame flex h-(--header-height) shrink-0 items-center justify-between">
          <BrandLogo plate />
          <IconButton icon={X} label={nav.menu.close} variant="ghost" onClick={close} autoFocus />
        </div>
        <div className="ed-frame flex flex-1 flex-col justify-between gap-12 pt-8 pb-12">
          <nav aria-label={nav.label}>
            <ul className="flex flex-col border-t border-hairline">
              {nav.links.map((link, i) => (
                <li key={link.href} className="border-b border-hairline">
                  <a
                    href={link.href}
                    onClick={close}
                    aria-current={link.href === current ? "location" : undefined}
                    className="group/link flex min-h-15 items-center justify-between gap-4 ed-h3 transition-colors duration-200 hover:text-success aria-[current=location]:text-success"
                  >
                    <span className="flex items-baseline gap-4">
                      <span aria-hidden="true" className="w-6 ed-meta text-text-secondary">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {link.label}
                    </span>
                    <ArrowRight
                      aria-hidden="true"
                      className="size-5 text-text-muted"
                      strokeWidth={1.75}
                    />
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3 sm:flex-row">
              <ActionLink href={nav.cta.href} size="lg" onClick={close}>
                {nav.cta.label}
              </ActionLink>
              <ActionLink
                href={siteConfig.contact.whatsappHref}
                variant="inverse"
                size="lg"
                leadingIcon={MessageCircle}
                icon={null}
              >
                {nav.menu.whatsapp}
                <span className="sr-only"> {nav.menu.whatsappHint}</span>
              </ActionLink>
            </div>
            <div className="flex flex-col">
              <a
                href={siteConfig.contact.phoneHref}
                className="inline-flex min-h-10 items-center ed-small tabular-nums"
              >
                {siteConfig.contact.phoneDisplay}
              </a>
              <a
                href={`mailto:${siteConfig.contact.email}`}
                className="inline-flex min-h-10 items-center ed-small"
              >
                {siteConfig.contact.email}
              </a>
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
