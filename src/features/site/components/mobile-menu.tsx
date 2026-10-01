"use client";

import { ArrowRight, Menu, MessageCircle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { BrandMark } from "@/components/brand/brand-mark";
import { ButtonLink, IconButton } from "@/components/ui/button";
import { TextLink } from "@/components/ui/text-link";
import { siteConfig } from "@/config/site";

import { siteNavigation as nav } from "../config/site-navigation";

const MENU_ID = "site-menu";

/**
 * Small-screen navigation: a full-screen modal <dialog>. The platform provides
 * focus containment, Escape to close and focus return to the menu button.
 * While open the page behind does not scroll: `overflow: hidden` on the root
 * for touch, and `data-lenis-prevent` so smooth scroll ignores the wheel.
 */
export function MobileMenu({ className }: { className?: string }) {
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
        data-surface="white"
        className="m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto overscroll-contain bg-background-primary text-text-primary backdrop:bg-transparent open:flex open:flex-col"
      >
        <div className="container-content flex h-(--header-height) shrink-0 items-center justify-between">
          <BrandMark />
          <IconButton icon={X} label={nav.menu.close} variant="ghost" onClick={close} autoFocus />
        </div>
        <div className="container-content flex flex-1 flex-col justify-between gap-12 pt-10 pb-12">
          <nav aria-label={nav.label}>
            <ul className="flex flex-col border-t border-border-default">
              {nav.links.map((link) => (
                <li key={link.href} className="border-b border-border-default">
                  <a
                    href={link.href}
                    onClick={close}
                    className="flex min-h-16 items-center justify-between gap-4 type-heading-md transition-ui hover:text-text-secondary"
                  >
                    {link.label}
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
              <ButtonLink href={nav.cta.href} size="lg" trailingIcon={ArrowRight} onClick={close}>
                {nav.cta.label}
              </ButtonLink>
              <ButtonLink
                href={siteConfig.contact.whatsappHref}
                variant="secondary"
                size="lg"
                leadingIcon={MessageCircle}
              >
                {nav.menu.whatsapp}
                <span className="sr-only"> {nav.menu.whatsappHint}</span>
              </ButtonLink>
            </div>
            <div className="flex flex-col gap-1">
              <TextLink variant="utility" href={siteConfig.contact.phoneHref}>
                {siteConfig.contact.phoneDisplay}
              </TextLink>
              <TextLink variant="utility" href={`mailto:${siteConfig.contact.email}`}>
                {siteConfig.contact.email}
              </TextLink>
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
