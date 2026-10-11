"use client";

import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import type { OrderStatus } from "../../services/records";
import { STATUS_LABELS } from "../../services/operations";
import { Button } from "./button";
import { Select } from "./form";

export function PageHeader({
  title,
  eyebrow,
  meta,
  actions,
  back,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="a-page-header">
      <div style={{ minWidth: 0 }}>
        {back ? (
          <Link href={back.href} className="a-back">
            <ArrowLeft size={14} aria-hidden="true" />
            {back.label}
          </Link>
        ) : null}
        {eyebrow ? <span className="a-eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {meta ? <div className="a-page-header-meta">{meta}</div> : null}
      </div>
      {actions ? <div className="a-actions">{actions}</div> : null}
    </header>
  );
}

export function Panel({
  title,
  actions,
  children,
  flush,
  footer,
  id,
  className,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  flush?: boolean;
  footer?: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <section
      className={["a-panel", className].filter(Boolean).join(" ")}
      aria-labelledby={title && id ? `${id}-title` : undefined}
    >
      {title || actions ? (
        <div className="a-panel-head">
          {title ? <h2 id={id ? `${id}-title` : undefined}>{title}</h2> : <span />}
          {actions ? <div className="a-actions">{actions}</div> : null}
        </div>
      ) : null}
      <div className={flush ? "a-panel-body a-panel-body--flush" : "a-panel-body"}>{children}</div>
      {footer ? <div className="a-panel-foot">{footer}</div> : null}
    </section>
  );
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className="a-status" data-status={status}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function SortHeader({
  label,
  field,
  sort,
  onSort,
  sortable,
}: {
  label: string;
  field: string;
  sort: { field: string; direction: "asc" | "desc" } | null;
  onSort: (field: string) => void;
  sortable: boolean;
}) {
  const active = sort?.field === field;
  const ariaSort = active ? (sort?.direction === "asc" ? "ascending" : "descending") : undefined;
  if (!sortable) return <th scope="col">{label}</th>;
  const Icon = !active ? ArrowUpDown : sort?.direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <th scope="col" aria-sort={ariaSort}>
      <button type="button" onClick={() => onSort(field)}>
        {label}
        <Icon aria-hidden="true" />
      </button>
    </th>
  );
}

export function Pagination({
  total,
  page,
  pageSize,
  onPage,
  onPageSize,
}: {
  total: number;
  page: number;
  pageSize: number;
  onPage: (page: number) => void;
  onPageSize?: (size: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="a-table-foot">
      <span>
        {from}–{to} of {total}
      </span>
      <div className="a-row">
        {onPageSize ? (
          <Select
            className="a-select--sm"
            aria-label="Rows per page"
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
            style={{ width: 92 }}
          >
            {[25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </Select>
        ) : null}
        <Button
          size="sm"
          icon
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <span className="a-small">
          Page {page} of {pages}
        </span>
        <Button
          size="sm"
          icon
          aria-label="Next page"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

export function Empty({ children = "—" }: { children?: ReactNode }) {
  return <span className="a-empty-value">{children}</span>;
}
