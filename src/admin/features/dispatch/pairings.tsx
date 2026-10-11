"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Link2, Unlink } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { RelationPicker } from "../../components/fields/relation-picker";
import { Button } from "../../components/ui/button";
import { ConfirmDialog } from "../../components/ui/dialog";
import { EmptyState, ErrorState, FormError, LoadingState } from "../../components/ui/feedback";
import { Field, Input } from "../../components/ui/form";
import { Panel } from "../../components/ui/layout";
import { useToast } from "../../components/ui/toast";
import { useInvalidateData } from "../../hooks/use-admin-config";
import { businessToInstant, formatDateTime } from "../../lib/datetime";
import { toAdminError } from "../../lib/errors";
import {
  endPairing,
  fetchPairings,
  isCurrentPairing,
  isOpenPairing,
  pairDriverVehicle,
  type Pairing,
} from "../../services/operations";

function period(p: Pairing) {
  const end = p.released_at ?? p.ends_at;
  return `${formatDateTime(p.starts_at)} → ${end ? formatDateTime(end) : "open-ended"}`;
}

/** Create a pairing. Fixed side (driver or vehicle) when shown on a resource page. */
export function PairingForm({
  driverId: fixedDriver,
  vehicleId: fixedVehicle,
  onDone,
}: {
  driverId?: string;
  vehicleId?: string;
  onDone?: () => void;
}) {
  const toast = useToast();
  const invalidate = useInvalidateData();
  const [driverId, setDriverId] = useState<string | null>(fixedDriver ?? null);
  const [vehicleId, setVehicleId] = useState<string | null>(fixedVehicle ?? null);
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [note, setNote] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      pairDriverVehicle({
        driverId: driverId!,
        vehicleId: vehicleId!,
        startsAt: startDate
          ? businessToInstant(startDate, startTime || "00:00").toISOString()
          : null,
        endsAt: endDate ? businessToInstant(endDate, endTime || "00:00").toISOString() : null,
        note,
      }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Driver and vehicle paired.");
      if (!fixedDriver) setDriverId(null);
      if (!fixedVehicle) setVehicleId(null);
      setStartDate("");
      setStartTime("");
      setEndDate("");
      setEndTime("");
      setNote("");
      onDone?.();
    },
  });

  return (
    <form
      className="a-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setLocalError(null);
        if (!driverId || !vehicleId) {
          setLocalError("Choose a driver and a vehicle.");
          return;
        }
        if ((startTime && !startDate) || (endTime && !endDate)) {
          setLocalError("Enter a date for each time.");
          return;
        }
        mutation.mutate();
      }}
    >
      <div className="a-form-grid">
        {fixedDriver ? null : (
          <Field label="Driver" required>
            <RelationPicker entity="driver" value={driverId} onChange={setDriverId} />
          </Field>
        )}
        {fixedVehicle ? null : (
          <Field label="Vehicle" required>
            <RelationPicker entity="vehicle" value={vehicleId} onChange={setVehicleId} />
          </Field>
        )}
        <Field label="From" help="Empty = now (Europe/Rome).">
          <div className="a-input-pair">
            <Input
              type="date"
              aria-label="From date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              type="time"
              aria-label="From time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
        </Field>
        <Field label="Until" help="Empty = until ended manually.">
          <div className="a-input-pair">
            <Input
              type="date"
              aria-label="Until date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            <Input
              type="time"
              aria-label="Until time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        </Field>
        <Field label="Note" wide>
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </Field>
      </div>
      {localError ? (
        <FormError error={new Error(localError)} />
      ) : (
        <FormError error={mutation.error} />
      )}
      <div className="a-row" style={{ justifyContent: "flex-end" }}>
        <Button type="submit" variant="primary" loading={mutation.isPending}>
          {mutation.isPending ? null : <Link2 aria-hidden="true" />}
          Pair
        </Button>
      </div>
    </form>
  );
}

function EndPairingButton({ pairing }: { pairing: Pairing }) {
  const toast = useToast();
  const invalidate = useInvalidateData();
  const [open, setOpen] = useState(false);
  const mutation = useMutation({
    mutationFn: () => endPairing(pairing.id),
    onSuccess: async () => {
      await invalidate();
      toast.success("Pairing ended. It stays in the history.");
      setOpen(false);
    },
  });
  return (
    <>
      <Button size="sm" variant="danger-ghost" onClick={() => setOpen(true)}>
        <Unlink aria-hidden="true" />
        End
      </Button>
      <ConfirmDialog
        open={open}
        title="End this pairing?"
        message={`${pairing.driver?.display_name} and ${pairing.vehicle?.display_name} will no longer be paired from now on.`}
        confirmLabel="End pairing"
        busy={mutation.isPending}
        error={mutation.error ? toAdminError(mutation.error).message : null}
        onConfirm={() => mutation.mutate()}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

function PairingTable({ pairings, showActions }: { pairings: Pairing[]; showActions: boolean }) {
  return (
    <div className="a-table-wrap">
      <table className="a-table">
        <thead>
          <tr>
            <th scope="col">Driver</th>
            <th scope="col">Vehicle</th>
            <th scope="col">Period</th>
            <th scope="col">State</th>
            {showActions ? (
              <th scope="col">
                <span className="a-sr-only">Actions</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {pairings.map((p) => {
            const current = isCurrentPairing(p);
            const open = isOpenPairing(p);
            return (
              <tr key={p.id}>
                <td>
                  <Link className="a-row-link" href={`/admin/drivers/${p.driver_id}`}>
                    {p.driver?.display_name}
                  </Link>
                </td>
                <td>
                  <Link className="a-row-link" href={`/admin/vehicles/${p.vehicle_id}`}>
                    {p.vehicle?.display_name}
                  </Link>
                </td>
                <td className="a-small">{period(p)}</td>
                <td>
                  {current ? (
                    <span className="a-badge a-badge--green">Current</span>
                  ) : open ? (
                    <span className="a-badge a-badge--outline">Upcoming</span>
                  ) : (
                    <span className="a-badge">Ended</span>
                  )}
                </td>
                {showActions ? <td>{open ? <EndPairingButton pairing={p} /> : null}</td> : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Pairings of one driver or vehicle, with the form to add one. */
export function ResourcePairingsPanel({
  resource,
  id,
  archived,
}: {
  resource: "driver" | "vehicle";
  id: string;
  archived: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const query = useQuery({
    queryKey: ["pairings", resource, id],
    queryFn: () =>
      fetchPairings(
        resource === "driver" ? { driverId: id, limit: 50 } : { vehicleId: id, limit: 50 },
      ),
  });
  const other = resource === "driver" ? "vehicle" : "driver";
  return (
    <Panel
      title={resource === "driver" ? "Vehicle pairings" : "Driver pairings"}
      flush
      actions={
        archived ? null : (
          <Button size="sm" onClick={() => setAdding((v) => !v)} aria-expanded={adding}>
            <Link2 aria-hidden="true" />
            Pair with a {other}
          </Button>
        )
      }
    >
      {adding ? (
        <div className="a-panel-body" style={{ borderBottom: "1px solid var(--a-border)" }}>
          <PairingForm
            driverId={resource === "driver" ? id : undefined}
            vehicleId={resource === "vehicle" ? id : undefined}
            onDone={() => setAdding(false)}
          />
        </div>
      ) : null}
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.isLoading ? (
        <LoadingState />
      ) : !query.data?.length ? (
        <EmptyState
          title="No pairings"
          message={`Pair this ${resource} with a ${other} to suggest it when dispatching.`}
        />
      ) : (
        <PairingTable pairings={query.data} showActions={!archived} />
      )}
    </Panel>
  );
}

/** Dispatch → Pairings tab: all open pairings and recent history. */
export function PairingsBoard() {
  const query = useQuery({
    queryKey: ["pairings", "all"],
    queryFn: () => fetchPairings({ limit: 200 }),
  });
  const open = (query.data ?? []).filter((p) => isOpenPairing(p));
  const ended = (query.data ?? []).filter((p) => !isOpenPairing(p)).slice(0, 30);
  return (
    <div className="a-stack">
      <Panel title="New pairing">
        <PairingForm />
      </Panel>
      <Panel title="Current and upcoming pairings" flush>
        {query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : query.isLoading ? (
          <LoadingState />
        ) : open.length === 0 ? (
          <EmptyState
            title="No pairings"
            message="Pair drivers with the vehicles they usually drive."
          />
        ) : (
          <PairingTable pairings={open} showActions />
        )}
      </Panel>
      {ended.length ? (
        <Panel title="Recently ended" flush>
          <PairingTable pairings={ended} showActions={false} />
        </Panel>
      ) : null}
    </div>
  );
}
