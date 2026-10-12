"use client";

import { useEffect } from "react";

const ENDPOINT = "/api/contact-events";

type Channel = "whatsapp" | "phone" | "email";

/** The channel a link opens (WhatsApp, phone, email), or null for any other link. */
function channelOf(anchor: HTMLAnchorElement): Channel | null {
  const href = anchor.getAttribute("href") ?? "";
  if (href.startsWith("tel:")) return "phone";
  if (href.startsWith("mailto:")) return "email";
  try {
    const host = new URL(href, window.location.href).hostname;
    if (host === "wa.me" || host === "api.whatsapp.com" || host === "wa.link") return "whatsapp";
  } catch {
    // not a URL
  }
  return null;
}

/**
 * Counts clicks on the site's contact links (WhatsApp, phone, email) for the
 * dispatch team. Only the channel and the page path are sent — no cookie, no
 * identifier, nothing about the visitor — and with sendBeacon, so a click is
 * never delayed. Renders nothing.
 */
export function ContactTracker() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as
        HTMLAnchorElement | null | undefined;
      const channel = anchor ? channelOf(anchor) : null;
      if (!channel || typeof navigator.sendBeacon !== "function") return;
      try {
        navigator.sendBeacon(
          ENDPOINT,
          new Blob([JSON.stringify({ channel, page: window.location.pathname })], {
            type: "text/plain",
          }),
        );
      } catch {
        // Counting is best effort.
      }
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
