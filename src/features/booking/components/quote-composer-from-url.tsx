"use client";

import { useSearchParams } from "next/navigation";

import { QuoteComposer, valuesFromParams } from "./quote-composer";

/**
 * QuoteComposer, filled from the URL. The page stays static: render it inside
 * a Suspense boundary whose fallback is the empty `<QuoteComposer initial={{}} />`
 * — the same layout, so nothing moves when the values arrive. Unknown or
 * malformed parameters are dropped (valuesFromParams). The URL seeds the
 * state once; the composer then keeps the URL in step with what is typed.
 */
export function QuoteComposerFromUrl() {
  const params = useSearchParams();
  return (
    <QuoteComposer initial={valuesFromParams(new URLSearchParams(params.toString()))} fromUrl />
  );
}
