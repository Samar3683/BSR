import { describe, expect, it } from "vitest";

import type { AuditEntry } from "../../services/audit";
import { auditSentence } from "./audit-diff";

const entry = (over: Partial<AuditEntry>): AuditEntry => ({
  id: 1,
  occurred_at: "2026-10-12T10:00:00Z",
  actor_id: "u",
  actor_label: "Admin",
  action: "update",
  entity_type: "order",
  entity_id: "o1",
  entity_label: "ORD-1001",
  before_state: null,
  after_state: null,
  changed_fields: [],
  context: {},
  transaction_id: 1,
  ...over,
});

describe("auditSentence", () => {
  it("describes a status change in words", () => {
    const text = auditSentence(
      entry({
        action: "status_change",
        before_state: { status: "confirmed" },
        after_state: { status: "scheduled" },
      }),
      undefined,
      {},
    );
    expect(text).toBe("Moved ORD-1001 from Confirmed to Scheduled");
  });

  it("names the crew instead of showing ids", () => {
    const text = auditSentence(
      entry({
        action: "assign",
        entity_type: "order_assignment",
        after_state: { driver_id: "d1", vehicle_id: "v1" },
      }),
      undefined,
      { d1: "Luca Bianchi", v1: "AB123CD" },
    );
    expect(text).toBe("Assigned Luca Bianchi and AB123CD to ORD-1001");
  });

  it("describes creations with the record", () => {
    expect(auditSentence(entry({ action: "create" }), undefined, {})).toBe(
      "Created order ORD-1001",
    );
  });
});
