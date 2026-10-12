/**
 * Placeholder for a panel page while its route loads (app/admin/(panel)/loading.tsx).
 * Server-renderable: no client hooks, so Next.js can show it instantly on navigation.
 */
export function PageSkeleton({ variant = "list" }: { variant?: "list" | "tabs" }) {
  return (
    <div className="a-page" aria-busy="true" aria-label="Loading">
      <div className="a-page-header">
        <div style={{ display: "grid", gap: 8, width: "min(320px, 60%)" }}>
          <span className="a-skeleton" style={{ height: 22, width: "70%" }} />
          <span className="a-skeleton" style={{ height: 12, width: "45%" }} />
        </div>
      </div>
      {variant === "tabs" ? null : (
        <section className="a-panel">
          <div className="a-toolbar">
            <span className="a-skeleton" style={{ height: 32, width: 260 }} />
            <span className="a-skeleton" style={{ height: 32, width: 90 }} />
          </div>
          <div className="a-panel-body" style={{ display: "grid", gap: 14 }}>
            {Array.from({ length: 7 }, (_, row) => (
              <span
                key={row}
                className="a-skeleton"
                style={{ height: 14, width: `${60 + ((row * 17) % 35)}%` }}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
