"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Link2, TriangleAlert, Unlink, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button, ButtonLink } from "../../components/ui/button";
import { ConfirmDialog } from "../../components/ui/dialog";
import { Alert, ErrorState, FormError, LoadingState } from "../../components/ui/feedback";
import { Field, Input } from "../../components/ui/form";
import { useToast } from "../../components/ui/toast";
import { useAdminConfig, useInvalidateData } from "../../hooks/use-admin-config";
import { formatDateTime, formatTime } from "../../lib/datetime";
import { toAdminError } from "../../lib/errors";
import { requirementIssues, type DispatchRequirement } from "../../lib/requirements";
import type { AdminConfig } from "../../services/config";
import {
  assignOrder,
  fetchDispatchCandidates,
  fetchRequirements,
  unassignOrder,
  type DispatchCandidate,
  type DispatchCandidates,
} from "../../services/operations";
import type { OrderStatus } from "../../services/records";

/**
 * Choose the driver and vehicle of an order. Availability shown here is a
 * guide; the database decides (exclusion constraints), so a booking made
 * meanwhile by someone else is still refused with an explanation.
 * Licence / vehicle requirements (Settings → Dispatch rules) are warnings.
 */
export function AssignmentEditor({
  orderId,
  status,
  onDone,
  initialDriverId,
  initialVehicleId,
}: {
  orderId: string;
  status: OrderStatus;
  onDone?: () => void;
  /** Preselect (e.g. after dropping the order on a driver in the timeline). */
  initialDriverId?: string | null;
  initialVehicleId?: string | null;
}) {
  const query = useQuery({
    queryKey: ["dispatch-candidates", orderId],
    queryFn: () => fetchDispatchCandidates(orderId),
  });
  const requirements = useQuery({ queryKey: ["dispatch-requirements"], queryFn: fetchRequirements });
  const { data: config } = useAdminConfig();
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data || !config) return <LoadingState label="Checking availability…" />;
  return (
    <EditorBody
      key={`${orderId}:${query.data.current?.driver_id ?? ""}:${query.data.current?.vehicle_id ?? ""}`}
      orderId={orderId}
      status={status}
      data={query.data}
      config={config}
      requirements={requirements.data ?? []}
      onDone={onDone}
      initialDriverId={initialDriverId}
      initialVehicleId={initialVehicleId}
    />
  );
}

function EditorBody({
  orderId,
  status,
  data,
  config,
  requirements,
  onDone,
  initialDriverId,
  initialVehicleId,
}: {
  orderId: string;
  status: OrderStatus;
  data: DispatchCandidates;
  config: AdminConfig;
  requirements: DispatchRequirement[];
  onDone?: () => void;
  initialDriverId?: string | null;
  initialVehicleId?: string | null;
}) {
  const toast = useToast();
  const invalidate = useInvalidateData();
  const firstDriver = initialDriverId ?? data.current?.driver_id ?? null;
  const pairedForFirst = data.drivers.find((d) => d.id === firstDriver)?.paired_vehicle_id;
  const [driverId, setDriverId] = useState<string | null>(firstDriver);
  const [vehicleId, setVehicleId] = useState<string | null>(
    initialVehicleId ??
      data.current?.vehicle_id ??
      (pairedForFirst && data.vehicles.some((v) => v.id === pairedForFirst) ? pairedForFirst : null),
  );
  const [note, setNote] = useState("");
  const [confirmUnassign, setConfirmUnassign] = useState(false);

  const assign = useMutation({
    mutationFn: (pair?: { driverId: string; vehicleId: string }) =>
      assignOrder(orderId, pair?.driverId ?? driverId, pair?.vehicleId ?? vehicleId, note.trim() || undefined),
    onSuccess: async (_, pair) => {
      await invalidate();
      const both = pair || (driverId && vehicleId);
      toast.success(both ? "Driver and vehicle assigned." : "Assignment saved.");
      setNote("");
      onDone?.();
    },
  });

  const unassign = useMutation({
    mutationFn: () => unassignOrder(orderId),
    onSuccess: async () => {
      await invalidate();
      toast.success("Driver and vehicle released. The assignment stays in the history.");
      setConfirmUnassign(false);
      onDone?.();
    },
  });

  if (["draft", "delivered", "cancelled"].includes(status)) {
    return (
      <Alert>
        {status === "draft"
          ? "Confirm the order before dispatching it."
          : `A ${status} order cannot be dispatched. Its assignment history is kept.`}
      </Alert>
    );
  }
  if (!data.window) {
    return (
      <Alert tone="error" title="Pickup and delivery times are missing">
        <p>Dispatch reserves the driver and vehicle for the order&apos;s planned window.</p>
        <p>
          <Link className="a-link" href={`/admin/orders/${orderId}/edit`}>
            Edit the order
          </Link>
        </p>
      </Alert>
    );
  }

  const driverById = new Map(data.drivers.map((d) => [d.id, d]));
  const vehicleById = new Map(data.vehicles.map((v) => [v.id, v]));
  const issuesFor = (driver?: DispatchCandidate, vehicle?: DispatchCandidate) =>
    requirementIssues(config, requirements, vehicle?.attributes, driver?.attributes);
  const selectedIssues = issuesFor(
    driverId ? driverById.get(driverId) : undefined,
    vehicleId ? vehicleById.get(vehicleId) : undefined,
  );

  // Usual crews that are both free for this window.
  const usualPairs = data.drivers
    .filter((d) => !d.conflict && d.paired_vehicle_id)
    .map((d) => ({ driver: d, vehicle: vehicleById.get(d.paired_vehicle_id!) }))
    .filter((p): p is { driver: DispatchCandidate; vehicle: DispatchCandidate } =>
      Boolean(p.vehicle && !p.vehicle.conflict),
    )
    .slice(0, 3);

  const unchanged = data.current?.driver_id === driverId && data.current?.vehicle_id === vehicleId;

  const pickDriver = (candidate: DispatchCandidate) => {
    setDriverId(candidate.id);
    // Suggest the driver's paired vehicle when none is chosen yet.
    if (!vehicleId && candidate.paired_vehicle_id && vehicleById.has(candidate.paired_vehicle_id)) {
      setVehicleId(candidate.paired_vehicle_id);
    }
  };
  const pickVehicle = (candidate: DispatchCandidate) => {
    setVehicleId(candidate.id);
    if (!driverId && candidate.paired_driver_id && driverById.has(candidate.paired_driver_id)) {
      setDriverId(candidate.paired_driver_id);
    }
  };

  return (
    <div className="a-stack">
      <p className="a-muted">
        Window {formatDateTime(data.window.starts_at)} → {formatDateTime(data.window.ends_at)}
      </p>
      {usualPairs.length && !data.current ? (
        <div className="a-usual-pairs" role="group" aria-label="Usual pairs">
          <span className="a-small a-muted">
            <Users size={14} aria-hidden="true" /> Usual pairs, free for this window:
          </span>
          {usualPairs.map(({ driver, vehicle }) => (
            <Button
              key={driver.id}
              size="sm"
              onClick={() => {
                setDriverId(driver.id);
                setVehicleId(vehicle.id);
              }}
              aria-pressed={driverId === driver.id && vehicleId === vehicle.id}
            >
              {driver.display_name} + {vehicle.display_name}
            </Button>
          ))}
        </div>
      ) : null}
      <div className="a-grid a-grid--2">
        <CandidateList
          title="Driver"
          name={`driver-${orderId}`}
          candidates={data.drivers}
          selected={driverId}
          onSelect={pickDriver}
          onClear={status === "in_transit" ? undefined : () => setDriverId(null)}
          pairedLabel={(c) => (c.paired_vehicle_name ? `Paired with ${c.paired_vehicle_name}` : null)}
          warning={(c) =>
            vehicleId && issuesFor(c, vehicleById.get(vehicleId)).length
              ? "Does not meet the selected vehicle's requirements"
              : null
          }
        />
        <CandidateList
          title="Vehicle"
          name={`vehicle-${orderId}`}
          candidates={data.vehicles}
          selected={vehicleId}
          onSelect={pickVehicle}
          onClear={status === "in_transit" ? undefined : () => setVehicleId(null)}
          pairedLabel={(c) => (c.paired_driver_name ? `Usually driven by ${c.paired_driver_name}` : null)}
          warning={(c) =>
            driverId && issuesFor(driverById.get(driverId), c).length
              ? "The selected driver does not meet its requirements"
              : null
          }
        />
      </div>
      {selectedIssues.length ? (
        <Alert tone="error" title="Check the licence requirements">
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {selectedIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
          <p className="a-small">You can still assign; the rule is advisory.</p>
        </Alert>
      ) : null}
      <Field label="Dispatch note" help="Optional. Saved with the assignment.">
        <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      </Field>
      <FormError error={assign.error} />
      <div className="a-row" style={{ justifyContent: "flex-end" }}>
        {data.current && status !== "in_transit" ? (
          <Button
            variant="danger-ghost"
            onClick={() => setConfirmUnassign(true)}
            disabled={assign.isPending}
          >
            <Unlink aria-hidden="true" />
            Unassign
          </Button>
        ) : null}
        <Button
          variant="primary"
          loading={assign.isPending}
          disabled={(!driverId && !vehicleId) || unchanged}
          onClick={() => assign.mutate(undefined)}
        >
          {assign.isPending ? null : <Link2 aria-hidden="true" />}
          {data.current ? "Update assignment" : "Assign"}
        </Button>
      </div>
      <ConfirmDialog
        open={confirmUnassign}
        title="Unassign driver and vehicle?"
        message="The order goes back to Confirmed and the driver and vehicle become free for this window. The assignment remains in the history."
        confirmLabel="Unassign"
        busy={unassign.isPending}
        error={unassign.error ? toAdminError(unassign.error).message : null}
        onConfirm={() => unassign.mutate()}
        onClose={() => setConfirmUnassign(false)}
      />
    </div>
  );
}

function CandidateList({
  title,
  name,
  candidates,
  selected,
  onSelect,
  onClear,
  pairedLabel,
  warning,
}: {
  title: string;
  name: string;
  candidates: DispatchCandidate[];
  selected: string | null;
  onSelect: (candidate: DispatchCandidate) => void;
  onClear?: () => void;
  pairedLabel: (candidate: DispatchCandidate) => string | null;
  warning: (candidate: DispatchCandidate) => string | null;
}) {
  const [filter, setFilter] = useState("");
  const visible = candidates.filter((c) =>
    c.display_name.toLowerCase().includes(filter.trim().toLowerCase()),
  );
  return (
    <fieldset className="a-fieldset" style={{ gap: 8 }}>
      <legend>{title}</legend>
      {candidates.length === 0 ? (
        <div className="a-stack" style={{ gap: 6 }}>
          <p className="a-muted a-small">
            No available {title.toLowerCase()}s. Add one or mark one available.
          </p>
          <ButtonLink size="sm" href={title === "Driver" ? "/admin/drivers/new" : "/admin/vehicles/new"}>
            New {title.toLowerCase()}
          </ButtonLink>
        </div>
      ) : (
        <>
          {candidates.length > 6 ? (
            <Input
              className="a-input--sm"
              type="search"
              placeholder={`Find a ${title.toLowerCase()}…`}
              aria-label={`Find a ${title.toLowerCase()}`}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          ) : null}
          <div className="a-candidates" role="radiogroup" aria-label={title}>
            {visible.map((candidate) => {
              const busy = Boolean(candidate.conflict);
              const paired = pairedLabel(candidate);
              const warn = warning(candidate);
              return (
                <label
                  key={candidate.id}
                  className="a-candidate"
                  data-selected={selected === candidate.id}
                  data-busy={busy}
                >
                  <input
                    type="radio"
                    name={name}
                    checked={selected === candidate.id}
                    onChange={() => onSelect(candidate)}
                  />
                  <span style={{ display: "grid", gap: 2, minWidth: 0 }}>
                    <strong style={{ fontWeight: 500 }}>{candidate.display_name}</strong>
                    <span className="a-candidate-note">
                      {busy
                        ? `Busy: ${candidate.conflict!.order_number} ${formatTime(candidate.conflict!.starts_at)}–${formatTime(candidate.conflict!.ends_at)}`
                        : "Free for this window"}
                    </span>
                    {paired ? <span className="a-help">{paired}</span> : null}
                    {warn ? (
                      <span className="a-candidate-warn">
                        <TriangleAlert size={12} aria-hidden="true" /> {warn}
                      </span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </div>
          {selected && onClear ? (
            <Button size="sm" variant="ghost" onClick={onClear}>
              Clear {title.toLowerCase()}
            </Button>
          ) : null}
        </>
      )}
    </fieldset>
  );
}
