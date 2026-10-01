import { BrandMark } from "@/components/brand/brand-mark";
import { Surface } from "@/components/layout/surface";
import { TextLink } from "@/components/ui/text-link";
import { siteConfig } from "@/config/site";

import { siteFooter as footer, siteNavigation as nav } from "../config/site-navigation";

/** Footer links are compact (32px targets, above the WCAG 2.2 AA minimum of 24px). */
const COMPACT = "min-h-8!";

/**
 * Site footer (Server Component, Carbon), compact — a quarter to a third of a
 * viewport. Left: the brand and one line. Centre: the contacts (phone, email,
 * PEC). Right: the site, as the header lists it. Bottom: the legal links that
 * exist, the address and the company identifiers, the copyright.
 */
export function SiteFooter() {
  const { contact, company } = siteConfig;
  const { address } = company;
  const year = new Date().getFullYear();

  return (
    <Surface as="footer" tone="carbon" aria-label={footer.label}>
      <div className="container-content flex flex-col gap-8 py-10 lg:py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-12 lg:gap-x-(--spacing-grid-gap)">
          <div className="flex flex-col gap-3 sm:col-span-2 lg:col-span-4">
            <BrandMark />
            <p className="max-w-[34ch] type-body-sm text-text-secondary">{footer.tagline}</p>
          </div>

          <div id={footer.contactId} className="flex flex-col gap-2 lg:col-span-4 lg:col-start-6">
            <h2 className="type-label-sm text-text-muted">{footer.contactHeading}</h2>
            <address className="flex flex-col not-italic">
              <TextLink
                variant="utility"
                href={contact.phoneHref}
                className={`${COMPACT} tabular-nums`}
              >
                <span className="sr-only">{footer.labels.phone} </span>
                {contact.phoneDisplay}
              </TextLink>
              <TextLink variant="utility" href={`mailto:${contact.email}`} className={COMPACT}>
                <span className="sr-only">{footer.labels.email} </span>
                {contact.email}
              </TextLink>
              <TextLink
                variant="utility"
                href={`mailto:${contact.pec}`}
                className={`${COMPACT} gap-2`}
              >
                <span className="text-text-muted">{footer.labels.pec}</span> {contact.pec}
              </TextLink>
            </address>
          </div>

          <nav aria-labelledby="footer-nav" className="flex flex-col gap-2 lg:col-span-3 lg:col-start-10">
            <h2 id="footer-nav" className="type-label-sm text-text-muted">
              {footer.navHeading}
            </h2>
            <ul className="grid grid-cols-2 gap-x-6">
              {nav.links.map((link) => (
                <li key={link.href}>
                  <TextLink variant="utility" href={link.href} className={COMPACT}>
                    {link.label}
                  </TextLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="flex flex-col gap-3 border-t border-border-default pt-5 type-caption text-text-muted lg:flex-row lg:items-center lg:justify-between">
          <nav aria-label={footer.legalLabel}>
            <ul className="flex flex-wrap gap-x-6">
              {footer.legal.map((link) => (
                <li key={link.href}>
                  <TextLink variant="utility" href={link.href} className={`${COMPACT} type-caption!`}>
                    {link.label}
                  </TextLink>
                </li>
              ))}
            </ul>
          </nav>
          <p className="tabular-nums">
            © {year} {footer.legalName} · {address.street}, {address.postalCode}{" "}
            {address.locality} ({address.province}) · {footer.vatLabel} {company.vatNumber} ·{" "}
            {footer.reaLabel} {company.rea}
          </p>
        </div>
      </div>
    </Surface>
  );
}
