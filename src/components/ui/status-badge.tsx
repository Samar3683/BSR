import {
  Circle,
  CircleAlert,
  CircleCheck,
  CircleDot,
  CircleMinus,
  Clock,
  type LucideIcon,
  Route,
} from "lucide-react";

import { cx } from "@/lib/utils/cx";

import { Icon } from "./icon";

export type OperationalStatus =
  "active" | "in-transit" | "complete" | "available" | "delayed" | "error" | "inactive";

type StatusTone = "positive" | "attention" | "critical" | "neutral";

/*
 * Status grammar: every state is communicated by label + icon + tone, never
 * by colour alone (red/green are indistinguishable for many users).
 * Green = operation progressing or done; red outline = needs attention;
 * red fill = failure; neutral = not operating.
 */
export const STATUS_DEFINITIONS: Record<OperationalStatus, { tone: StatusTone; icon: LucideIcon }> =
  {
    active: { tone: "positive", icon: CircleDot },
    "in-transit": { tone: "positive", icon: Route },
    complete: { tone: "positive", icon: CircleCheck },
    available: { tone: "positive", icon: Circle },
    delayed: { tone: "attention", icon: Clock },
    error: { tone: "critical", icon: CircleAlert },
    inactive: { tone: "neutral", icon: CircleMinus },
  };

const TONES: Record<StatusTone, string> = {
  positive: "border-transparent bg-success-surface text-success",
  attention: "border-danger-graphic bg-transparent text-danger",
  critical: "border-transparent bg-danger-surface text-danger",
  neutral: "border-border-default bg-transparent text-text-muted",
};

interface StatusBadgeProps {
  status: OperationalStatus;
  /** Visible, human-readable label (required: the icon alone is not enough). */
  label: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const { tone, icon } = STATUS_DEFINITIONS[status];

  return (
    <span
      data-status={status}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 type-label-sm",
        TONES[tone],
        className,
      )}
    >
      <Icon icon={icon} size="sm" />
      {label}
    </span>
  );
}
