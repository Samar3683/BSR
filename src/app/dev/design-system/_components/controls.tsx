import { ArrowRight, ArrowUpRight, Menu, Plus, Search, X } from "lucide-react";

import { Button, ButtonLink, IconButton } from "@/components/ui/button";
import type { ButtonSize, ButtonVariant } from "@/components/ui/button-styles";
import { Icon, type IconSize } from "@/components/ui/icon";
import { type OperationalStatus, StatusBadge } from "@/components/ui/status-badge";
import { TextLink } from "@/components/ui/text-link";

import { PreviewSection, SpecLabel } from "./preview-section";

const VARIANTS: ButtonVariant[] = ["primary", "secondary", "ghost", "inverse"];
const SIZES: ButtonSize[] = ["sm", "md", "lg"];

const STATUSES: Array<[OperationalStatus, string]> = [
  ["active", "Active"],
  ["in-transit", "In transit"],
  ["complete", "Complete"],
  ["available", "Available"],
  ["delayed", "Delayed"],
  ["error", "Error"],
  ["inactive", "Inactive"],
];

const ICON_SIZES: Array<[IconSize, string]> = [
  ["sm", "16px"],
  ["md", "20px"],
  ["lg", "24px"],
];

export function ControlsPreview() {
  return (
    <PreviewSection
      id="controls"
      title="Buttons, links & status"
      description="Hover, press (pointer) and Tab (keyboard) through every control. Red is the action colour; green only ever means operational state."
    >
      <div className="flex flex-col gap-8">
        {VARIANTS.map((variant) => (
          <div key={variant} className="flex flex-col gap-3">
            <SpecLabel>{variant}</SpecLabel>
            <div className="flex flex-wrap items-center gap-3">
              {SIZES.map((size) => (
                <Button key={size} variant={variant} size={size} trailingIcon={ArrowRight}>
                  {variant === "primary" ? "Primary Action" : "Secondary Action"} · {size}
                </Button>
              ))}
              <Button variant={variant} disabled>
                Disabled
              </Button>
              <Button variant={variant} loading>
                Loading
              </Button>
            </div>
          </div>
        ))}

        <div className="flex flex-col gap-3">
          <SpecLabel>icon buttons (accessible name required) · link styled as button</SpecLabel>
          <div className="flex flex-wrap items-center gap-3">
            <IconButton icon={Menu} label="Open menu example" />
            <IconButton icon={Search} label="Search example" variant="ghost" />
            <IconButton icon={Plus} label="Add example" variant="primary" />
            <IconButton icon={X} label="Close example" size="sm" />
            <ButtonLink href="#controls" variant="secondary" trailingIcon={ArrowUpRight}>
              Link as Button
            </ButtonLink>
          </div>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        <div className="flex flex-col gap-3">
          <SpecLabel>inline</SpecLabel>
          <p className="type-body-md text-text-secondary">
            Running text with an <TextLink href="#controls">inline link example</TextLink> that is
            always underlined.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <SpecLabel>utility / navigation</SpecLabel>
          <nav aria-label="Utility link example" className="flex flex-wrap gap-6">
            <TextLink variant="utility" href="#controls" aria-current="page">
              Current Item
            </TextLink>
            <TextLink variant="utility" href="#controls">
              Utility Item
            </TextLink>
          </nav>
        </div>
        <div className="flex flex-col gap-3">
          <SpecLabel>action / directional</SpecLabel>
          <TextLink variant="action" href="#controls">
            Action Link Example
          </TextLink>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <SpecLabel>operational status — label + icon + tone</SpecLabel>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map(([status, label]) => (
              <StatusBadge key={status} status={status} label={label} />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <SpecLabel>icons — lucide outline, 1.75px stroke at every size</SpecLabel>
          <div className="flex items-end gap-6">
            {ICON_SIZES.map(([size, px]) => (
              <div key={size} className="flex flex-col items-center gap-2">
                <Icon icon={ArrowRight} size={size} />
                <SpecLabel>
                  {size} · {px}
                </SpecLabel>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PreviewSection>
  );
}
