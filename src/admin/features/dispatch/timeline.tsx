"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, GripVertical, Link2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type DragEvent } from "react";

import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/feedback";
import { Input, Segmented } from "../../components/ui/form";
import { StatusBadge } from "../../components/ui/layout";
import {
  addDays,
  businessToday,
  businessToInstant,
  formatLongDate,
  formatTime,
} from "../../lib/datetime";
import { fetchCalendarEvents, STATUS_LABELS, type CalendarEvent } from "../../services/operations";
import { listRecords, type ResourceRow } from "../../services/records";
import { useUrlState } from "../records/url-state";
import { AssignmentEditor } from "./assignment-editor";

type Lanes = "driver" | "vehicle";
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const DRAG_TYPE = "application/x-bsr-order";

/**
 * One day of dispatch: a row per driver (or vehicle), the day's hours across,
 * orders as bars. Orders still missing a driver / vehicle wait in a tray and
 * can be dragged onto a row (or assigned with their button), which opens the
 * assignment editor preset with that resource. Conflicts are still refused
 * by the database.
 */
export function DispatchTimeline() {
  const { get, update } = useUrlState();
  const today = businessToday();
  const day = /^\d{4}-\d{2}-\d{2}$/.test(get("day") ?? "") ? get("day")! : today;
  const lanes: Lanes = get("lanes") === "vehicle" ? "vehicle" : "driver";
  const dayStart = businessToInstant(day);
  const dayEnd = businessToInstant(addDays(day, 1));
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [target, setTarget] = useState<{ event: CalendarEvent; resourceId: string | null } | null>(
    null,
  );

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const events = useQuery({
    queryKey: ["calendar", day, "timeline"],
    queryFn: () => fetchCalendarEvents(dayStart, dayEnd, {}),
  });
  const resources = useQuery({
    queryKey: ["records", lanes, "timeline-resources"],
    queryFn: () =>
      listRecords<ResourceRow>(lanes, {
        sort: { field: "display_name", direction: "asc" },
        limit: 200,
      }),
  });

  const all = (events.data ?? []).filter((e) => e.status !== "cancelled");
  const laneOf = (e: CalendarEvent) => (lanes === "driver" ? e.driver_id : e.vehicle_id);
  const waiting = all.filter(
    (e) => !laneOf(e) && ["confirmed", "scheduled", "in_transit"].includes(e.status),
  );
  const span = dayEnd.getTime() - dayStart.getTime();
  const position = (e: CalendarEvent) => {
    const start = Math.max(Date.parse(e.starts_at), dayStart.getTime());
    const end = Math.min(Math.max(Date.parse(e.ends_at), start + 15 * 60_000), dayEnd.getTime());
    return {
      left: `${((start - dayStart.getTime()) / span) * 100}%`,
      width: `${Math.max(((end - start) / span) * 100, 1.2)}%`,
    };
  };
  const nowOffset = day === today ? ((now - dayStart.getTime()) / span) * 100 : null;

  const onDrop = (event: DragEvent, resourceId: string) => {
    event.preventDefault();
    setDragOver(null);
    const id = event.dataTransfer.getData(DRAG_TYPE);
    const order = all.find((e) => e.id === id);
    if (order) setTarget({ event: order, resourceId });
  };

  return (
    <div className="a-stack">
      <section className="a-panel" aria-label="Dispatch timeline">
        <div className="a-toolbar" style={{ justifyContent: "space-between" }}>
          <div className="a-row">
            <Button
              size="sm"
              icon
              aria-label="Previous day"
              onClick={() => update({ day: addDays(day, -1) })}
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button size="sm" onClick={() => update({ day: null })}>
              Today
            </Button>
            <Button
              size="sm"
              icon
              aria-label="Next day"
              onClick={() => update({ day: addDays(day, 1) })}
            >
              <ChevronRight aria-hidden="true" />
            </Button>
            <Input
              type="date"
              className="a-input--sm"
              aria-label="Day"
              value={day}
              style={{ width: "auto" }}
              onChange={(e) => e.target.value && update({ day: e.target.value })}
            />
            <h2 style={{ fontSize: 15 }} aria-live="polite">
              {formatLongDate(day)}
            </h2>
          </div>
          <Segmented
            label="Rows"
            value={lanes}
            onChange={(value) => update({ lanes: value === "driver" ? null : value })}
            options={[
              { value: "driver", label: "Drivers" },
              { value: "vehicle", label: "Vehicles" },
            ]}
          />
        </div>

        <div className="a-tl-tray" aria-label={`Orders without a ${lanes}`}>
          <span className="a-small a-muted">
            Without a {lanes} ({waiting.length}) — drag onto a row or use Assign:
          </span>
          {waiting.length === 0 ? <span className="a-small">none</span> : null}
          {waiting.map((e) => (
            <span
              key={e.id}
              className="a-tl-chip"
              draggable
              data-status={e.status}
              onDragStart={(ev) => {
                ev.dataTransfer.setData(DRAG_TYPE, e.id);
                ev.dataTransfer.effectAllowed = "link";
              }}
            >
              <GripVertical size={14} aria-hidden="true" />
              <span>
                <strong className="a-mono">{e.order_number}</strong> {formatTime(e.starts_at)}–
                {formatTime(e.ends_at)} · {e.customer_name}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setTarget({ event: e, resourceId: null })}
              >
                <Link2 aria-hidden="true" />
                Assign
              </Button>
            </span>
          ))}
        </div>

        {events.isError ? (
          <ErrorState error={events.error} onRetry={() => events.refetch()} />
        ) : resources.isError ? (
          <ErrorState error={resources.error} onRetry={() => resources.refetch()} />
        ) : events.isLoading || resources.isLoading ? (
          <LoadingState />
        ) : !resources.data?.rows.length ? (
          <EmptyState title={`No ${lanes}s yet`} message={`Add ${lanes}s to plan the day.`} />
        ) : (
          <div className="a-table-wrap">
            <div className="a-tl" role="table" aria-label={`${formatLongDate(day)} by ${lanes}`}>
              <div className="a-tl-row a-tl-row--head" role="row">
                <div role="columnheader" className="a-tl-name">
                  {lanes === "driver" ? "Driver" : "Vehicle"}
                </div>
                <div role="columnheader" className="a-tl-hours">
                  {HOURS.map((h) => (
                    <span key={h} style={{ left: `${(h / 24) * 100}%` }}>
                      {String(h).padStart(2, "0")}
                    </span>
                  ))}
                </div>
              </div>
              {resources.data.rows.map((resource) => {
                const rowEvents = all.filter((e) => laneOf(e) === resource.id);
                return (
                  <div
                    key={resource.id}
                    className="a-tl-row"
                    role="row"
                    data-drop={dragOver === resource.id || undefined}
                    data-unavailable={!resource.available || undefined}
                    onDragOver={(ev) => {
                      if (!ev.dataTransfer.types.includes(DRAG_TYPE)) return;
                      ev.preventDefault();
                      setDragOver(resource.id);
                    }}
                    onDragLeave={() => setDragOver((v) => (v === resource.id ? null : v))}
                    onDrop={(ev) => onDrop(ev, resource.id)}
                  >
                    <div role="rowheader" className="a-tl-name">
                      <Link className="a-row-link" href={`/admin/${lanes}s/${resource.id}`}>
                        {resource.display_name}
                      </Link>
                      {!resource.available ? (
                        <span className="a-help">Unavailable</span>
                      ) : resource.pairing ? (
                        <span className="a-help">
                          {lanes === "driver"
                            ? resource.pairing.vehicle_name
                            : resource.pairing.driver_name}
                        </span>
                      ) : null}
                    </div>
                    <div role="cell" className="a-tl-track">
                      {nowOffset !== null && nowOffset >= 0 && nowOffset <= 100 ? (
                        <span
                          className="a-tl-now"
                          style={{ left: `${nowOffset}%` }}
                          aria-hidden="true"
                        />
                      ) : null}
                      {rowEvents.map((e) => (
                        <Link
                          key={e.id}
                          href={`/admin/orders/${e.id}`}
                          className="a-tl-bar"
                          data-status={e.status}
                          style={position(e)}
                          title={`${e.order_number} · ${e.customer_name}\n${formatTime(e.starts_at)}–${formatTime(e.ends_at)} · ${STATUS_LABELS[e.status]}`}
                          aria-label={`${e.order_number}, ${formatTime(e.starts_at)} to ${formatTime(e.ends_at)}, ${e.customer_name}, ${STATUS_LABELS[e.status]}`}
                        >
                          <span className="a-mono">{e.order_number.slice(-5)}</span>{" "}
                          {e.customer_name}
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <Dialog
        open={target !== null}
        wide
        title={target ? `Assign ${target.event.order_number}` : ""}
        onClose={() => setTarget(null)}
      >
        {target ? (
          <div className="a-stack">
            <div className="a-row">
              <StatusBadge status={target.event.status} />
              <span className="a-muted">{target.event.customer_name}</span>
            </div>
            <AssignmentEditor
              orderId={target.event.id}
              status={target.event.status}
              initialDriverId={
                lanes === "driver"
                  ? (target.resourceId ?? target.event.driver_id)
                  : target.event.driver_id
              }
              initialVehicleId={
                lanes === "vehicle"
                  ? (target.resourceId ?? target.event.vehicle_id)
                  : target.event.vehicle_id
              }
              onDone={() => setTarget(null)}
            />
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
