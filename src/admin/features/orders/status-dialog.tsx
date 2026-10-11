"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { FormError } from "../../components/ui/feedback";
import { Field, Textarea } from "../../components/ui/form";
import { StatusBadge } from "../../components/ui/layout";
import { useToast } from "../../components/ui/toast";
import { useInvalidateData } from "../../hooks/use-admin-config";
import { changeOrderStatus, STATUS_LABELS, STATUS_TRANSITIONS } from "../../services/operations";
import type { OrderStatus } from "../../services/records";

const HINTS: Partial<Record<OrderStatus, string>> = {
  draft: "Back to preparation; not offered to dispatch.",
  confirmed: "Ready for dispatch. Moving back from Scheduled releases the driver and vehicle.",
  scheduled: "Requires a driver and a vehicle.",
  in_transit: "The transport has started.",
  delivered: "The transport is complete.",
  cancelled: "Releases any assigned driver and vehicle.",
};

export function StatusDialog({
  orderId,
  status,
  open,
  onClose,
}: {
  orderId: string;
  status: OrderStatus;
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const invalidate = useInvalidateData();
  const options = STATUS_TRANSITIONS[status];
  const [next, setNext] = useState<OrderStatus | null>(options[0] ?? null);
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: () => changeOrderStatus(orderId, next!, note.trim() || undefined),
    onSuccess: async () => {
      await invalidate();
      toast.success(`Status changed to ${STATUS_LABELS[next!]}.`);
      setNote("");
      onClose();
    },
  });

  return (
    <Dialog
      open={open}
      onClose={() => {
        mutation.reset();
        onClose();
      }}
      busy={mutation.isPending}
      title="Change status"
      onSubmit={() => next && mutation.mutate()}
      footer={
        <>
          <Button onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={mutation.isPending} disabled={!next}>
            Change status
          </Button>
        </>
      }
    >
      <div className="a-row">
        <span className="a-muted">Current</span>
        <StatusBadge status={status} />
      </div>
      <fieldset className="a-fieldset">
        <legend>New status</legend>
        {options.map((option) => (
          <label key={option} className="a-check" style={{ alignItems: "flex-start" }}>
            <input
              type="radio"
              name="next-status"
              value={option}
              checked={next === option}
              onChange={() => setNext(option)}
            />
            <span style={{ display: "grid", gap: 2 }}>
              <StatusBadge status={option} />
              <span className="a-help">{HINTS[option]}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <Field label="Note" help="Recorded in the status history.">
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} />
      </Field>
      <FormError error={mutation.error} />
    </Dialog>
  );
}
