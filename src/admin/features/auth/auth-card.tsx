import Image from "next/image";
import type { ReactNode } from "react";

import { MAIN_CONTENT_ID } from "@/constants/landmarks";

/** Centered card for sign-in, recovery and access pages. */
export function AuthCard({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main id={MAIN_CONTENT_ID} className="a-auth" tabIndex={-1}>
      <div className="a-auth-card">
        <div className="a-auth-brand">
          <Image
            className="a-auth-logo"
            src="/assets/images/content/logos/bsr-logo.webp"
            alt="BSR Trasporti"
            width={397}
            height={160}
            priority
          />
          <div className="a-brand-tag">Admin</div>
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          <h1>{title}</h1>
          {intro ? <p className="a-muted">{intro}</p> : null}
        </div>
        {children}
      </div>
    </main>
  );
}
