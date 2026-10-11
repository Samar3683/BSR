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
          <span className="a-brand-mark" aria-hidden="true">
            BSR
          </span>
          <div>
            <div className="a-brand-name">BSR Trasporti</div>
            <div className="a-brand-tag">Admin</div>
          </div>
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
