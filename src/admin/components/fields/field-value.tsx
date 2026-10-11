"use client";

import { ExternalLink, Mail, MessageCircle, Phone } from "lucide-react";
import Link from "next/link";

import { formatFieldValue, type FormatContext } from "../../lib/fields/format";
import type { FieldDefinition, FileValue } from "../../lib/fields/types";
import { ENTITY_PATHS } from "../../services/records";
import { Empty } from "../ui/layout";
import { FilePreview } from "./file-input";

/** WhatsApp click-to-chat number: digits only, Italian numbers get +39. */
export function whatsappNumber(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits.slice(1);
  if (digits.startsWith("00")) return digits.slice(2);
  return digits.length >= 9 && /^3\d/.test(digits) ? `39${digits}` : digits;
}

export function ContactActions({ type, value }: { type: "phone" | "email"; value: string }) {
  if (type === "email") {
    return (
      <a className="a-btn a-btn--sm a-btn--ghost" href={`mailto:${value}`}>
        <Mail aria-hidden="true" />
        Email
      </a>
    );
  }
  return (
    <>
      <a className="a-btn a-btn--sm a-btn--ghost" href={`tel:${value.replace(/[^\d+]/g, "")}`}>
        <Phone aria-hidden="true" />
        Call
      </a>
      <a
        className="a-btn a-btn--sm a-btn--ghost"
        href={`https://wa.me/${whatsappNumber(value)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <MessageCircle aria-hidden="true" />
        WhatsApp
      </a>
    </>
  );
}

/** Full rendering of a value on a record page. */
export function FieldValue({
  def,
  value,
  ctx,
}: {
  def: FieldDefinition;
  value: unknown;
  ctx: FormatContext;
}) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  ) {
    return <Empty />;
  }
  switch (def.field_type) {
    case "email":
      return (
        <span className="a-row">
          <a className="a-link" href={`mailto:${String(value)}`}>
            {String(value)}
          </a>
        </span>
      );
    case "phone":
      return (
        <span className="a-row">
          <span>{String(value)}</span>
          <ContactActions type="phone" value={String(value)} />
        </span>
      );
    case "url":
      return (
        <a className="a-link" href={String(value)} target="_blank" rel="noopener noreferrer">
          {String(value)} <ExternalLink size={12} aria-hidden="true" />
        </a>
      );
    case "relation": {
      const id = String(value);
      const name = ctx.relationNames?.[id];
      return def.relation_entity ? (
        <Link className="a-link" href={`${ENTITY_PATHS[def.relation_entity]}/${id}`}>
          {name ?? "Open record"}
        </Link>
      ) : (
        <span>{name ?? id}</span>
      );
    }
    case "single_select": {
      const option = ctx.optionsByField[def.id]?.find((o) => o.id === value);
      return (
        <span className={option?.archived_at ? "a-muted" : undefined}>
          {option?.label ?? "Unknown option"}
          {option?.archived_at ? " (archived option)" : ""}
        </span>
      );
    }
    case "multi_select":
      return (
        <span className="a-chips">
          {(value as string[]).map((id) => {
            const option = ctx.optionsByField[def.id]?.find((o) => o.id === id);
            return (
              <span
                key={id}
                className="a-badge"
                title={option?.archived_at ? "Archived option" : undefined}
              >
                {option?.label ?? "Unknown option"}
                {option?.archived_at ? " · archived" : ""}
              </span>
            );
          })}
        </span>
      );
    case "image":
    case "file":
      return <FilePreview value={value as FileValue} image={def.field_type === "image"} />;
    default:
      return <span>{formatFieldValue(def, value, ctx)}</span>;
  }
}

/** Compact rendering in table cells. */
export function FieldCell({
  def,
  value,
  ctx,
}: {
  def: FieldDefinition;
  value: unknown;
  ctx: FormatContext;
}) {
  const text = formatFieldValue(def, value, ctx);
  if (!text) return <Empty />;
  if (def.field_type === "single_select") {
    return <span className="a-badge">{text}</span>;
  }
  return <span title={text}>{text}</span>;
}
