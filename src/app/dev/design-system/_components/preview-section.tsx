import type { ReactNode } from "react";

import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";

interface PreviewSectionProps {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}

export function PreviewSection({ id, title, description, children }: PreviewSectionProps) {
  return (
    <Section spacing="sm" aria-labelledby={id} className="border-t border-border-subtle">
      <Container className="flex flex-col gap-10">
        <header className="flex max-w-text flex-col gap-3">
          <h2 id={id} className="type-heading-lg">
            {title}
          </h2>
          {description && <p className="type-body-md text-text-secondary">{description}</p>}
        </header>
        {children}
      </Container>
    </Section>
  );
}

export function SpecLabel({ children }: { children: ReactNode }) {
  return <p className="type-metadata text-text-muted">{children}</p>;
}
