"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { RelationPicker } from "../../components/fields/relation-picker";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/feedback";
import { Checkbox, Field, Segmented } from "../../components/ui/form";
import { PageHeader, StatusBadge } from "../../components/ui/layout";
import {
  addDays,
  addMonths,
  businessToday,
  businessToInstant,
  formatCalendarDate,
  formatLongDate,
  formatMonth,
  formatTime,
  startOfMonth,
  startOfWeek,
} from "../../lib/datetime";
import {
  fetchCalendarEvents,
  STATUS_LABELS,
  type CalendarEvent,
  type CalendarFilters,
} from "../../services/operations";
import { useUrlState } from "../records/url-state";
import { WeekGrid } from "./week-grid";

type View = "month" | "week" | "agenda";
type Group = "none" | "driver" | "vehicle";
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]; // translated on screen

/** Does an event overlap the business day? */
function onDay(event: CalendarEvent, day: string): boolean {
  const start = businessToInstant(day).getTime();
  const end = businessToInstant(addDays(day, 1)).getTime();
  const s = Date.parse(event.starts_at);
  const e = Math.max(Date.parse(event.ends_at), s + 1);
  return s < end && e > start;
}

function eventTime(event: CalendarEvent, day: string) {
  const startsToday = onDay({ ...event, ends_at: event.starts_at }, day);
  return startsToday ? formatTime(event.starts_at) : "…";
}

/** A calendar entry: time and customer on screen; order, status and crew in its name. */
function EventChip({ event, day }: { event: CalendarEvent; day: string }) {
  const crew =
    event.driver_name || event.vehicle_name
      ? `${event.driver_name ?? "no driver"} · ${event.vehicle_name ?? "no vehicle"}`
      : "unassigned";
  const name = `${event.order_number}, ${event.customer_name}, ${STATUS_LABELS[event.status]}, ${crew}`;
  return (
    <Link
      className="a-event"
      data-status={event.status}
      href={`/admin/orders/${event.id}`}
      title={`${event.order_number} · ${event.customer_name}
${STATUS_LABELS[event.status]} · ${crew}`}
      aria-label={`${eventTime(event, day)} ${name}`}
    >
      {eventTime(event, day)} {event.customer_name}
    </Link>
  );
}

export function CalendarView() {
  const { get, update } = useUrlState();
  const today = businessToday();
  const viewParam = get("view");
  const view: View =
    viewParam === "week" || viewParam === "agenda" || viewParam === "month" ? viewParam : "month";
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(get("date") ?? "") ? get("date")! : today;
  const group = (
    ["driver", "vehicle"].includes(get("group") ?? "") ? get("group") : "none"
  ) as Group;
  const filters: CalendarFilters = {
    driver_id: get("driver") ?? undefined,
    vehicle_id: get("vehicle") ?? undefined,
    customer_id: get("customer") ?? undefined,
    include_cancelled: get("cancelled") === "1",
  };
  const [dayDialog, setDayDialog] = useState<string | null>(null);

  useEffect(() => {
    // Narrow screens start on the agenda unless a view was chosen.
    if (!viewParam && window.matchMedia("(max-width: 820px)").matches) update({ view: "agenda" });
  }, [viewParam, update]);

  const range = useMemo(() => {
    if (view === "month") {
      const first = startOfWeek(startOfMonth(anchor));
      return { from: first, to: addDays(first, 42) };
    }
    if (view === "week") {
      const first = startOfWeek(anchor);
      return { from: first, to: addDays(first, 7) };
    }
    return { from: anchor, to: addDays(anchor, 14) };
  }, [view, anchor]);

  const query = useQuery({
    queryKey: ["calendar", range.from, range.to, filters],
    queryFn: () =>
      fetchCalendarEvents(businessToInstant(range.from), businessToInstant(range.to), filters),
    placeholderData: keepPreviousData,
  });
  const events = query.data ?? [];
  const days = Array.from(
    { length: Math.round((Date.parse(range.to) - Date.parse(range.from)) / 86_400_000) },
    (_, i) => addDays(range.from, i),
  );

  const step = (direction: 1 | -1) => {
    const next =
      view === "month"
        ? addMonths(startOfMonth(anchor), direction)
        : addDays(anchor, direction * (view === "week" ? 7 : 14));
    update({ date: next });
  };
  const title =
    view === "month"
      ? formatMonth(anchor)
      : `${formatCalendarDate(range.from)} – ${formatCalendarDate(addDays(range.to, -1))}`;

  return (
    <div className="a-page">
      <PageHeader
        title="Calendar"
        meta={<span>Orders by planned window, with their driver and vehicle · Europe/Rome</span>}
      />

      <section className="a-panel" aria-label="Calendar">
        <div className="a-toolbar" style={{ justifyContent: "space-between" }}>
          <div className="a-row">
            <Button size="sm" icon aria-label="Previous" onClick={() => step(-1)}>
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button size="sm" onClick={() => update({ date: null })}>
              Today
            </Button>
            <Button size="sm" icon aria-label="Next" onClick={() => step(1)}>
              <ChevronRight aria-hidden="true" />
            </Button>
            <h2 style={{ fontSize: 15, marginLeft: 6 }} aria-live="polite">
              {title}
            </h2>
          </div>
          <div className="a-row">
            <Segmented
              label="Calendar view"
              value={view}
              onChange={(v) => update({ view: v })}
              options={[
                { value: "month", label: "Month" },
                { value: "week", label: "Week" },
                { value: "agenda", label: "Agenda" },
              ]}
            />
            {view === "week" ? (
              <Segmented
                label="Week layout"
                value={group}
                onChange={(g) => update({ group: g === "none" ? null : g })}
                options={[
                  { value: "none", label: "By hour" },
                  { value: "driver", label: "By driver" },
                  { value: "vehicle", label: "By vehicle" },
                ]}
              />
            ) : null}
          </div>
        </div>
        <div
          className="a-filter-panel"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", alignItems: "end" }}
        >
          <Field label="Driver">
            <RelationPicker
              entity="driver"
              value={filters.driver_id ?? null}
              onChange={(id) => update({ driver: id })}
              placeholder="All drivers"
            />
          </Field>
          <Field label="Vehicle">
            <RelationPicker
              entity="vehicle"
              value={filters.vehicle_id ?? null}
              onChange={(id) => update({ vehicle: id })}
              placeholder="All vehicles"
            />
          </Field>
          <Field label="Customer">
            <RelationPicker
              entity="customer"
              value={filters.customer_id ?? null}
              onChange={(id) => update({ customer: id })}
              placeholder="All customers"
            />
          </Field>
          <Checkbox
            label="Show cancelled"
            checked={Boolean(filters.include_cancelled)}
            onChange={(checked) => update({ cancelled: checked ? "1" : null })}
          />
        </div>

        {query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : query.isLoading ? (
          <LoadingState />
        ) : view === "month" ? (
          <div className="a-table-wrap" aria-busy={query.isFetching || undefined}>
            <div className="a-cal" role="group" aria-label={title} style={{ minWidth: 640 }}>
              {WEEKDAYS.map((d) => (
                <div key={d} className="a-cal-head" aria-hidden="true">
                  {d}
                </div>
              ))}
              {days.map((day) => {
                const dayEvents = events.filter((e) => onDay(e, day));
                return (
                  <div
                    key={day}
                    className="a-cal-day"
                    role="group"
                    aria-label={`${formatLongDate(day)}, ${dayEvents.length} orders`}
                    data-outside={day.slice(0, 7) !== anchor.slice(0, 7)}
                    data-today={day === today}
                  >
                    <div className="a-cal-date">
                      <span>{Number(day.slice(8))}</span>
                      {dayEvents.length > 3 ? <span>{dayEvents.length}</span> : null}
                    </div>
                    {dayEvents.slice(0, 3).map((event) => (
                      <EventChip key={event.id} event={event} day={day} />
                    ))}
                    {dayEvents.length > 3 ? (
                      <button
                        type="button"
                        className="a-cal-more"
                        onClick={() => setDayDialog(day)}
                      >
                        +{dayEvents.length - 3} more
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : view === "week" ? (
          group === "none" ? (
            <WeekGrid days={days} events={events} today={today} />
          ) : (
            <WeekLanes days={days} events={events} group={group} today={today} />
          )
        ) : (
          <Agenda days={days} events={events} />
        )}
      </section>

      <Dialog
        open={dayDialog !== null}
        title={dayDialog ? formatLongDate(dayDialog) : ""}
        onClose={() => setDayDialog(null)}
      >
        <div style={{ display: "grid", gap: 4 }}>
          {dayDialog
            ? events
                .filter((e) => onDay(e, dayDialog))
                .map((event) => <EventChip key={event.id} event={event} day={dayDialog} />)
            : null}
        </div>
      </Dialog>
    </div>
  );
}

function WeekLanes({
  days,
  events,
  group,
  today,
}: {
  days: string[];
  events: CalendarEvent[];
  group: Exclude<Group, "none">;
  today: string;
}) {
  const lanes = useMemo(() => {
    const map = new Map<string, { key: string; name: string; events: CalendarEvent[] }>();
    for (const event of events) {
      const id = group === "driver" ? event.driver_id : event.vehicle_id;
      const name = group === "driver" ? event.driver_name : event.vehicle_name;
      const key = id ?? "unassigned";
      if (!map.has(key)) map.set(key, { key, name: name ?? "Unassigned", events: [] });
      map.get(key)!.events.push(event);
    }
    return [...map.values()].sort((a, b) =>
      a.key === "unassigned" ? 1 : b.key === "unassigned" ? -1 : a.name.localeCompare(b.name),
    );
  }, [events, group]);

  if (!events.length) {
    return (
      <EmptyState
        title="No orders this week"
        message="Orders with a planned window in this week appear here."
      />
    );
  }
  return (
    <div className="a-table-wrap">
      <div className="a-lanes" role="table" aria-label="Week by resource">
        <div className="a-lane-row a-lane-row--head" role="row">
          <div role="columnheader">{group === "driver" ? "Driver" : "Vehicle"}</div>
          {days.map((day) => (
            <div
              key={day}
              role="columnheader"
              style={day === today ? { color: "var(--a-green)", fontWeight: 600 } : undefined}
            >
              {formatLongDate(day).replace(/ \d{4}$/, "")}
            </div>
          ))}
        </div>
        {lanes.map((lane) => (
          <div key={lane.key} className="a-lane-row" role="row">
            <div role="rowheader" className="a-lane-name" title={lane.name}>
              {lane.name}
            </div>
            {days.map((day) => (
              <div key={day} role="cell">
                {lane.events
                  .filter((e) => onDay(e, day))
                  .map((event) => (
                    <EventChip key={event.id} event={event} day={day} />
                  ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Agenda({ days, events }: { days: string[]; events: CalendarEvent[] }) {
  const groups = days
    .map((day) => ({ day, events: events.filter((e) => onDay(e, day)) }))
    .filter((g) => g.events.length);
  if (!groups.length) {
    return (
      <EmptyState
        title="Nothing planned"
        message="Orders with a planned window in these two weeks appear here."
      />
    );
  }
  return (
    <div className="a-agenda">
      {groups.map((group) => (
        <section key={group.day} aria-label={formatLongDate(group.day)}>
          <h3 className="a-agenda-day">{formatLongDate(group.day)}</h3>
          {group.events.map((event) => (
            <Link key={event.id} href={`/admin/orders/${event.id}`} className="a-agenda-item">
              <span className="a-small a-muted a-nowrap">
                {formatTime(event.starts_at)}–{formatTime(event.ends_at)}
              </span>
              <span style={{ minWidth: 0 }}>
                <strong className="a-mono">{event.order_number}</strong> · {event.customer_name}
                <span className="a-help" style={{ display: "block" }}>
                  {event.driver_name || event.vehicle_name
                    ? `${event.driver_name ?? "No driver"} · ${event.vehicle_name ?? "No vehicle"}`
                    : "Unassigned"}
                </span>
              </span>
              <StatusBadge status={event.status} />
            </Link>
          ))}
        </section>
      ))}
    </div>
  );
}
