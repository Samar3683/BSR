"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { ConfirmDialog } from "../../components/ui/dialog";
import { useInvalidateData } from "../../hooks/use-admin-config";
import {
  addDays,
  businessToInstant,
  formatDateTime,
  formatLongDate,
  formatTime,
  instantToBusiness,
} from "../../lib/datetime";
import { toAdminError } from "../../lib/errors";
import { STATUS_LABELS, type CalendarEvent } from "../../services/operations";
import { updateRecord, type OrderStatus } from "../../services/records";

const HOUR_PX = 44;
const SNAP_MINUTES = 15;
const HOURS = Array.from({ length: 24 }, (_, h) => h);
/** Orders whose window may still be moved by dragging. */
const MOVABLE: readonly OrderStatus[] = ["draft", "confirmed", "scheduled"];

interface Segment {
  event: CalendarEvent;
  top: number;
  height: number;
  col: number;
  cols: number;
}

/**
 * Lays one day's orders out in side-by-side columns where they overlap
 * (top / height as fractions of the day).
 */
export function layoutDay(events: readonly CalendarEvent[], day: string): Segment[] {
  const dayStart = businessToInstant(day).getTime();
  const dayEnd = businessToInstant(addDays(day, 1)).getTime();
  const span = dayEnd - dayStart;
  const items = events
    .map((event) => {
      const s = Math.max(Date.parse(event.starts_at), dayStart);
      const e = Math.min(Math.max(Date.parse(event.ends_at), s + 20 * 60_000), dayEnd);
      return { event, s, e };
    })
    .filter((item) => item.s < dayEnd && item.e > dayStart)
    .sort((a, b) => a.s - b.s || b.e - a.e);

  const out: Segment[] = [];
  let cluster: typeof items = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    const columnEnds: number[] = [];
    const placed = cluster.map((item) => {
      let col = columnEnds.findIndex((end) => end <= item.s);
      if (col === -1) col = columnEnds.push(item.e) - 1;
      else columnEnds[col] = item.e;
      return { ...item, col };
    });
    for (const p of placed) {
      out.push({
        event: p.event,
        top: (p.s - dayStart) / span,
        height: (p.e - p.s) / span,
        col: p.col,
        cols: columnEnds.length,
      });
    }
    cluster = [];
  };
  for (const item of items) {
    if (cluster.length && item.s >= clusterEnd) {
      flush();
      clusterEnd = -Infinity;
    }
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.e);
  }
  if (cluster.length) flush();
  return out;
}

/** Moves an instant by whole business days and minutes, snapped to the quarter hour. */
export function shiftInstant(iso: string, days: number, minutes: number): Date {
  const { date, time } = instantToBusiness(iso);
  const [h, m] = time.split(":").map(Number) as [number, number];
  let total = Math.round((h * 60 + m + minutes) / SNAP_MINUTES) * SNAP_MINUTES;
  const dayShift = Math.floor(total / 1440);
  total -= dayShift * 1440;
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return businessToInstant(addDays(date, days + dayShift), `${hh}:${mm}`);
}

interface Drag {
  id: string;
  pointerId: number;
  x: number;
  y: number;
  colWidth: number;
  days: number;
  minutes: number;
  moved: boolean;
}

interface Move {
  event: CalendarEvent;
  pickup: Date;
  delivery: Date;
}

/**
 * Week by hour: days across, hours down, overlapping orders side by side.
 * Draft, confirmed and scheduled orders can be dragged to a new day / time
 * (quarter-hour steps); the move is confirmed first and the database still
 * refuses windows that clash with the crew's other work.
 */
export function WeekGrid({
  days,
  events,
  today,
}: {
  days: string[];
  events: CalendarEvent[];
  today: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const justDragged = useRef(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [move, setMove] = useState<Move | null>(null);
  const invalidate = useInvalidateData();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // Start the working day in view.
    if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_PX;
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const mutation = useMutation({
    mutationFn: (m: Move) =>
      updateRecord("order", m.event.id, {
        columns: { pickup_at: m.pickup.toISOString(), delivery_at: m.delivery.toISOString() },
      }),
    onSuccess: async () => {
      await invalidate();
      setMove(null);
    },
  });

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>, calendarEvent: CalendarEvent) => {
    if (event.button !== 0 || event.pointerType === "touch") return;
    if (!MOVABLE.includes(calendarEvent.status)) return;
    const column = event.currentTarget.closest<HTMLElement>(".a-wk-col");
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({
      id: calendarEvent.id,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      colWidth: column?.getBoundingClientRect().width ?? 120,
      days: 0,
      minutes: 0,
      moved: false,
    });
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    const moved = drag.moved || Math.abs(dx) > 4 || Math.abs(dy) > 4;
    const minutes = Math.round(((dy / HOUR_PX) * 60) / SNAP_MINUTES) * SNAP_MINUTES;
    const dayCount = Math.round(dx / drag.colWidth);
    if (moved !== drag.moved || minutes !== drag.minutes || dayCount !== drag.days) {
      setDrag({ ...drag, moved, minutes, days: dayCount });
    }
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLElement>, calendarEvent: CalendarEvent) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    setDrag(null);
    if (!drag.moved) return;
    justDragged.current = true;
    if (!drag.minutes && !drag.days) return;
    const pickup = shiftInstant(calendarEvent.starts_at, drag.days, drag.minutes);
    const duration = Date.parse(calendarEvent.ends_at) - Date.parse(calendarEvent.starts_at);
    mutation.reset();
    setMove({ event: calendarEvent, pickup, delivery: new Date(pickup.getTime() + duration) });
  };

  return (
    <>
      <div className="a-table-wrap a-wk-scroll" ref={scrollRef}>
        <div className="a-wk" role="table" aria-label="Week by hour">
          <div className="a-wk-head" role="row">
            <div role="columnheader" className="a-wk-gutter">
              <span className="a-sr-only">Time</span>
            </div>
            {days.map((day) => (
              <div
                key={day}
                role="columnheader"
                className="a-wk-day"
                data-today={day === today || undefined}
              >
                {formatLongDate(day).replace(/ \d{4}$/, "")}
              </div>
            ))}
          </div>
          <div className="a-wk-body" role="row" style={{ height: 24 * HOUR_PX }}>
            <div className="a-wk-gutter" role="rowheader">
              {HOURS.map((h) => (
                <span key={h} style={{ top: h * HOUR_PX }}>
                  {String(h).padStart(2, "0")}:00
                </span>
              ))}
            </div>
            {days.map((day) => {
              const segments = layoutDay(events, day);
              const dayStart = businessToInstant(day).getTime();
              const dayEnd = businessToInstant(addDays(day, 1)).getTime();
              const nowTop =
                now >= dayStart && now < dayEnd ? ((now - dayStart) / (dayEnd - dayStart)) * 24 * HOUR_PX : null;
              return (
                <div
                  key={day}
                  role="cell"
                  className="a-wk-col"
                  aria-label={`${formatLongDate(day)}, ${segments.length} orders`}
                  data-today={day === today || undefined}
                >
                  {nowTop !== null ? (
                    <span className="a-wk-now" style={{ top: nowTop }} aria-hidden="true" />
                  ) : null}
                  {segments.map(({ event, top, height, col, cols }) => {
                    const dragging = drag?.id === event.id && drag.moved;
                    const movable = MOVABLE.includes(event.status);
                    const crew =
                      event.driver_name || event.vehicle_name
                        ? `${event.driver_name ?? "no driver"} · ${event.vehicle_name ?? "no vehicle"}`
                        : "unassigned";
                    return (
                      <Link
                        key={event.id}
                        href={`/admin/orders/${event.id}`}
                        className="a-wk-event"
                        data-status={event.status}
                        data-movable={movable || undefined}
                        data-dragging={dragging || undefined}
                        draggable={false}
                        style={{
                          top: top * 24 * HOUR_PX,
                          height: Math.max(height * 24 * HOUR_PX, 20),
                          left: `calc(${(col / cols) * 100}% + 2px)`,
                          width: `calc(${100 / cols}% - 4px)`,
                          transform: dragging
                            ? `translate(${drag.days * drag.colWidth}px, ${(drag.minutes / 60) * HOUR_PX}px)`
                            : undefined,
                        }}
                        title={`${event.order_number} · ${event.customer_name}\n${formatTime(event.starts_at)}–${formatTime(event.ends_at)} · ${STATUS_LABELS[event.status]} · ${crew}${movable ? "\nDrag to reschedule" : ""}`}
                        aria-label={`${formatTime(event.starts_at)} to ${formatTime(event.ends_at)}, ${event.order_number}, ${event.customer_name}, ${STATUS_LABELS[event.status]}, ${crew}`}
                        onPointerDown={(e) => onPointerDown(e, event)}
                        onPointerMove={onPointerMove}
                        onPointerUp={(e) => onPointerUp(e, event)}
                        onPointerCancel={() => setDrag(null)}
                        onClick={(e) => {
                          if (justDragged.current) {
                            e.preventDefault();
                            justDragged.current = false;
                          }
                        }}
                      >
                        <span className="a-wk-time">
                          {dragging
                            ? formatTime(shiftInstant(event.starts_at, drag.days, drag.minutes))
                            : formatTime(event.starts_at)}
                        </span>{" "}
                        <span className="a-wk-title">{event.customer_name}</span>
                        <span className="a-wk-sub">{event.order_number}</span>
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <p className="a-help" style={{ marginTop: 8 }}>
        Drag a draft, confirmed or scheduled order to move it (15-minute steps). You can also edit
        the times on the order page.
      </p>

      <ConfirmDialog
        open={move !== null}
        title={move ? `Reschedule ${move.event.order_number}?` : ""}
        tone="primary"
        confirmLabel="Reschedule"
        busy={mutation.isPending}
        error={mutation.error ? toAdminError(mutation.error).message : null}
        onClose={() => setMove(null)}
        onConfirm={() => move && mutation.mutate(move)}
        message={
          move ? (
            <dl className="a-dl">
              <dt>Now</dt>
              <dd>
                {formatDateTime(move.event.starts_at)} – {formatDateTime(move.event.ends_at)}
              </dd>
              <dt>New window</dt>
              <dd>
                <strong>
                  {formatDateTime(move.pickup)} – {formatDateTime(move.delivery)}
                </strong>
              </dd>
              {move.event.driver_name || move.event.vehicle_name ? (
                <>
                  <dt>Crew</dt>
                  <dd>
                    {move.event.driver_name ?? "No driver"} · {move.event.vehicle_name ?? "No vehicle"}{" "}
                    <span className="a-help">(kept; refused if they are busy then)</span>
                  </dd>
                </>
              ) : null}
            </dl>
          ) : null
        }
      />
    </>
  );
}
