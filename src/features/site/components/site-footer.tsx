import { BrandLogo } from "@/components/brand/brand-logo";
import { Surface } from "@/components/layout/surface";
import { siteConfig } from "@/config/site";

import { siteFooter as footer, siteNavigation as nav } from "../config/site-navigation";

/** Footer links are compact (32px targets, above the WCAG 2.2 AA minimum of 24px). */
const LINK =
  "inline-flex min-h-8 items-center ed-small text-text-primary transition-colors duration-200 hover:text-success";

/**
 * Site footer (Server Component, Carbon) — the last technical page of the
 * system, about a third of a viewport. A thin green rule arriving on a red
 * destination opens it. Left: the brand and one line. Centre: the contacts
 * (phone, email, PEC). Right: the site (the chapters and the privacy page).
 * Bottom, on a hairline: the company data and the copyright, in mono.
 */
export function SiteFooter() {
  const { contact, company } = siteConfig;
  const { address } = company;
  const year = new Date().getFullYear();
  const siteLinks = [...nav.links.filter((link) => link.href !== "/"), ...footer.legal];

  return (
    <Surface as="footer" tone="carbon" aria-label={footer.label} className="relative">
      <span aria-hidden="true" className="absolute inset-x-0 top-0 flex h-px">
        <span className="flex-1 bg-success-graphic" />
        <span className="w-20 bg-action-primary sm:w-32" />
      </span>
      <div className="ed-frame flex flex-col gap-8 py-10 lg:py-12">
        <div className="ed-grid gap-y-8">
          <div className="col-span-4 flex flex-col gap-3 md:col-span-8 lg:col-span-5">
            <BrandLogo plate heightClass="h-14" className="self-start" />
            <p className="max-w-[30ch] ed-small text-text-secondary">{footer.tagline}</p>
          </div>

          <div
            id={footer.contactId}
            className="col-span-4 flex flex-col gap-2 md:col-span-4 lg:col-span-4 lg:col-start-7"
          >
            <h2 className="ed-meta text-text-secondary">{footer.contactHeading}</h2>
            <address className="flex flex-col not-italic">
              <a href={contact.phoneHref} className={`${LINK} tabular-nums`}>
                <span className="sr-only">{footer.labels.phone} </span>
                {contact.phoneDisplay}
              </a>
              <a href={`mailto:${contact.email}`} className={LINK}>
                <span className="sr-only">{footer.labels.email} </span>
                {contact.email}
              </a>
              <a href={`mailto:${contact.pec}`} className={`${LINK} gap-2`}>
                <span className="ed-meta text-text-secondary">{footer.labels.pec}</span>{" "}
                {contact.pec}
              </a>
            </address>
          </div>

          <nav
            aria-labelledby="footer-nav"
            className="col-span-4 flex flex-col gap-2 md:col-span-4 lg:col-span-5 lg:col-start-12"
          >
            <h2 id="footer-nav" className="ed-meta text-text-secondary">
              {footer.navHeading}
            </h2>
            <ul className="grid grid-cols-2 gap-x-6">
              {siteLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className={LINK}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <p className="border-t border-hairline pt-5 ed-meta leading-relaxed text-text-secondary">
          © {year} {footer.legalName} · {address.street}, {address.postalCode} {address.locality} (
          {address.province}) · {footer.vatLabel} {company.vatNumber} · {footer.reaLabel}{" "}
          {company.rea}
        </p>
        <p className="ed-meta leading-relaxed text-text-secondary">
          {footer.credits.lead}{" "}
          {footer.credits.works.map((work, i) => (
            <span key={work.href}>
              {i > 0 && " e "}
              <a href={work.href} className={LINK} rel="noopener noreferrer">
                “{work.title}”
              </a>{" "}
              di {work.author}
            </span>
          ))}
          , licenza{" "}
          <a href={footer.credits.licence.href} className={LINK} rel="noopener noreferrer license">
            {footer.credits.licence.label}
          </a>
          . {footer.credits.modified}
        </p>
      </div>
    </Surface>
  );
}
