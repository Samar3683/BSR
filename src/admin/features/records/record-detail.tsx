"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronUp,
  Copy,
  Link2,
  Ellipsis,
  Pencil,
  RefreshCcw,
  Route,
  Trash,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ContactActions, FieldValue } from "../../components/fields/field-value";
import { Button, ButtonLink } from "../../components/ui/button";
import { ConfirmDialog, Dialog } from "../../components/ui/dialog";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/feedback";
import { Switch } from "../../components/ui/form";
import { Empty, PageHeader, Panel, StatusBadge } from "../../components/ui/layout";
import { MenuButton, type MenuItem } from "../../components/ui/menu";
import { useToast } from "../../components/ui/toast";
import { useAdminConfig, useInvalidateData, useRecordNames } from "../../hooks/use-admin-config";
import { formatDateTime } from "../../lib/datetime";
import { toAdminError } from "../../lib/errors";
import type { FormatContext } from "../../lib/fields/format";
import { groupBySection } from "../../lib/fields/sections";
import type { EntityKey, EntityRecord, FieldDefinition } from "../../lib/fields/types";
import { isEmptyValue } from "../../lib/fields/validate";
import { recordValue } from "../../lib/fields/values";
import { detailFields, liveFields, retiredFields, type AdminConfig } from "../../services/config";
import {
  changeOrderStatus,
  fetchOrderAssignments,
  fetchResourceAssignments,
  fetchStatusHistory,
  STATUS_LABELS,
  type OrderAssignment,
} from "../../services/operations";
import {
  deleteRecord,
  ENTITY_PATHS,
  fetchCustomerOrders,
  getRecord,
  setRecordArchived,
  setResourceAvailable,
  type OrderRow,
  type OrderStatus,
  type ResourceRow,
} from "../../services/records";
import { ActivityPanel } from "../audit/activity-panel";
import { AssignmentEditor } from "../dispatch/assignment-editor";
import { ResourcePairingsPanel } from "../dispatch/pairings";
import { StatusDialog } from "../orders/status-dialog";
import { collectRelationIds } from "./columns";

export function RecordDetailView({ entity, id }: { entity: EntityKey; id: string }) {
  const configQuery = useAdminConfig();
  const recordQuery = useQuery({
    queryKey: ["record", entity, id],
    queryFn: () => getRecord(entity, id),
  });

  if (configQuery.isError)
    return <ErrorState error={configQuery.error} onRetry={() => configQuery.refetch()} />;
  if (recordQuery.isError) {
    return (
      <div className="a-page">
        <ErrorState
          error={recordQuery.error}
          onRetry={() => recordQuery.refetch()}
          back={{ href: ENTITY_PATHS[entity], label: `Back to ${entity}s` }}
        />
      </div>
    );
  }
  if (!configQuery.data || !recordQuery.data) return <LoadingState />;
  return <Detail entity={entity} config={configQuery.data} record={recordQuery.data} />;
}

/** Which archive / delete actions can succeed (the database decides; this avoids dead ends). */
function lifecycle(entity: EntityKey, record: EntityRecord) {
  const archived = Boolean(record.archived_at);
  if (entity !== "order") return { canArchive: !archived, canRestore: archived, canDelete: true };
  const status = (record as OrderRow).status;
  return {
    canArchive: !archived && ["draft", "delivered", "cancelled"].includes(status),
    canRestore: archived,
    canDelete: status === "draft",
  };
}

type NextStep =
  { kind: "status"; status: OrderStatus; label: string } | { kind: "assign"; label: string } | null;

/** The one action that moves an order forward from where it is. */
export function nextStep(order: Pick<OrderRow, "status">, crewed: boolean): NextStep {
  switch (order.status) {
    case "draft":
      return { kind: "status", status: "confirmed", label: "Confirm order" };
    case "confirmed":
      return crewed
        ? { kind: "status", status: "scheduled", label: "Schedule" }
        : { kind: "assign", label: "Assign driver and vehicle" };
    case "scheduled":
      return { kind: "status", status: "in_transit", label: "Start transit" };
    case "in_transit":
      return { kind: "status", status: "delivered", label: "Mark delivered" };
    default:
      return null;
  }
}

function Detail({
  entity,
  config,
  record,
}: {
  entity: EntityKey;
  config: AdminConfig;
  record: EntityRecord;
}) {
  const router = useRouter();
  const toast = useToast();
  const invalidate = useInvalidateData();
  const [confirm, setConfirm] = useState<"archive" | "restore" | "delete" | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const entityConfig = config.entities[entity];
  const singular = entityConfig?.display_name ?? entity;
  const basePath = ENTITY_PATHS[entity];
  const archived = Boolean(record.archived_at);
  const order = entity === "order" ? (record as OrderRow) : null;
  const rules = lifecycle(entity, record);

  const assignments = useQuery({
    queryKey: ["assignments", "order", record.id],
    queryFn: () => fetchOrderAssignments(record.id),
    enabled: Boolean(order),
  });
  const current = assignments.data?.find((a) => !a.released_at);

  const retired = retiredFields(config, entity).filter(
    (def) => !isEmptyValue(recordValue(def, record)),
  );
  const relationIds = collectRelationIds([...liveFields(config, entity), ...retired], [record]);
  const names = {
    ...useRecordNames("order", relationIds.order).data,
    ...useRecordNames("vehicle", relationIds.vehicle).data,
    ...useRecordNames("driver", relationIds.driver).data,
    ...useRecordNames("customer", relationIds.customer).data,
  };
  const ctx: FormatContext = { optionsByField: config.options, relationNames: names };

  const action = useMutation({
    mutationFn: async (kind: "archive" | "restore" | "delete") => {
      if (kind === "delete") await deleteRecord(entity, record.id);
      else await setRecordArchived(entity, record.id, kind === "archive");
      return kind;
    },
    onSuccess: async (kind) => {
      await invalidate();
      setConfirm(null);
      if (kind === "delete") {
        toast.success(`${singular} deleted.`);
        router.push(basePath);
      } else {
        toast.success(kind === "archive" ? `${singular} archived.` : `${singular} restored.`);
      }
    },
  });

  const step =
    order && !archived && !assignments.isLoading
      ? nextStep(order, Boolean(current?.driver_id && current?.vehicle_id))
      : null;
  const advance = useMutation({
    mutationFn: (status: OrderStatus) => changeOrderStatus(record.id, status),
    onSuccess: async (_, status) => {
      await invalidate();
      toast.success(`Status changed to ${STATUS_LABELS[status]}.`);
    },
    onError: (error) => toast.error(toAdminError(error).message),
  });

  const contactFields = liveFields(config, entity).filter(
    (f) =>
      (f.field_type === "phone" || f.field_type === "email") &&
      typeof recordValue(f, record) === "string",
  );

  const moreItems: MenuItem[] = [];
  if (order && !archived) {
    moreItems.push({
      label: "Open in Dispatch",
      icon: <Route aria-hidden="true" />,
      href: `/admin/dispatch?order=${order.id}`,
    });
  }
  if (rules.canArchive) {
    moreItems.push({
      label: "Archive",
      icon: <Archive aria-hidden="true" />,
      onSelect: () => setConfirm("archive"),
    });
  }
  if (rules.canRestore) {
    moreItems.push({
      label: "Restore",
      icon: <ArchiveRestore aria-hidden="true" />,
      onSelect: () => setConfirm("restore"),
    });
  }
  if (rules.canDelete) {
    moreItems.push({
      label: "Delete",
      icon: <Trash aria-hidden="true" />,
      tone: "danger",
      onSelect: () => setConfirm("delete"),
    });
  }
  moreItems.push({
    label: "Copy record ID",
    icon: <Copy aria-hidden="true" />,
    onSelect: () => {
      void navigator.clipboard?.writeText(record.id).then(
        () => toast.success("Record ID copied."),
        () => toast.error("The ID could not be copied."),
      );
    },
  });

  return (
    <div className="a-page">
      <PageHeader
        back={{ href: basePath, label: entityConfig?.plural_display_name ?? "Back" }}
        eyebrow={singular}
        title={<span className={order ? "a-mono" : undefined}>{record.display_name}</span>}
        meta={
          <>
            {order ? <StatusBadge status={order.status} /> : null}
            {entity === "driver" || entity === "vehicle" ? (
              (record as ResourceRow).available ? (
                <span className="a-badge a-badge--green">Available</span>
              ) : (
                <span className="a-badge">Unavailable</span>
              )
            ) : null}
            {archived ? (
              <span className="a-badge a-badge--red">
                Archived {formatDateTime(record.archived_at)}
              </span>
            ) : null}
          </>
        }
        actions={
          <>
            {step ? (
              <Button
                variant="primary"
                loading={advance.isPending}
                onClick={() =>
                  step.kind === "assign" ? setAssignOpen(true) : advance.mutate(step.status)
                }
              >
                {advance.isPending ? null : step.kind === "assign" ? (
                  <Link2 aria-hidden="true" />
                ) : (
                  <RefreshCcw aria-hidden="true" />
                )}
                {step.label}
              </Button>
            ) : null}
            {!archived ? (
              <ButtonLink
                href={`${basePath}/${record.id}/edit`}
                variant={step ? "default" : "primary"}
              >
                <Pencil aria-hidden="true" />
                Edit
              </ButtonLink>
            ) : null}
            {order && !archived ? (
              <Button onClick={() => setStatusOpen(true)}>
                <RefreshCcw aria-hidden="true" />
                Change status
              </Button>
            ) : null}
            <MenuButton label="More" icon={<Ellipsis aria-hidden="true" />} items={moreItems} />
          </>
        }
      />

      <div className="a-detail">
        <div className="a-detail-main a-stack">
          <DetailsPanel
            entity={entity}
            config={config}
            record={record}
            ctx={ctx}
            order={order}
            names={names}
          />

          {retired.length ? (
            <Panel title="Values of retired fields">
              <p className="a-help" style={{ marginBottom: 8 }}>
                These fields are archived or disabled. Their values are kept for history and are
                read-only.
              </p>
              <dl className="a-dl">
                {retired.map((def: FieldDefinition) => (
                  <div key={def.id}>
                    <dt>
                      {def.label}{" "}
                      <span className="a-badge">{def.archived_at ? "archived" : "disabled"}</span>
                    </dt>
                    <dd>
                      <FieldValue def={def} value={recordValue(def, record)} ctx={ctx} />
                    </dd>
                  </div>
                ))}
              </dl>
            </Panel>
          ) : null}

          {order ? <OrderHistoryPanels orderId={order.id} /> : null}
          {entity === "driver" || entity === "vehicle" ? (
            <>
              <ResourcePairingsPanel resource={entity} id={record.id} archived={archived} />
              <ResourceAssignmentsPanel resource={entity} id={record.id} />
            </>
          ) : null}
          {entity === "customer" ? <CustomerOrdersPanel customerId={record.id} /> : null}
        </div>

        <div className="a-detail-summary a-stack">
          {order ? (
            <CrewPanel
              order={order}
              current={current}
              loading={assignments.isLoading}
              onAssign={() => setAssignOpen(true)}
            />
          ) : null}
          {entity === "driver" || entity === "vehicle" ? (
            <AvailabilityPanel entity={entity} record={record as ResourceRow} />
          ) : null}
          {contactFields.length ? (
            <Panel title="Contact">
              <div className="a-stack" style={{ gap: 10 }}>
                {contactFields.map((def) => (
                  <div key={def.id} style={{ display: "grid", gap: 4 }}>
                    <span className="a-small a-muted">
                      {def.label}: {String(recordValue(def, record))}
                    </span>
                    <div className="a-row">
                      <ContactActions
                        type={def.field_type as "phone" | "email"}
                        value={String(recordValue(def, record))}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          ) : null}
        </div>

        <div className="a-detail-side a-stack">
          <ActivityPanel entityType={entity} entityId={record.id} />
          <Panel title="Record">
            <dl className="a-dl">
              <div>
                <dt>Created</dt>
                <dd>{formatDateTime(record.created_at)}</dd>
              </div>
              <div>
                <dt>Last updated</dt>
                <dd>{formatDateTime(record.updated_at)}</dd>
              </div>
            </dl>
          </Panel>
        </div>
      </div>

      {order ? (
        <>
          <StatusDialog
            key={order.status}
            orderId={order.id}
            status={order.status}
            open={statusOpen}
            onClose={() => setStatusOpen(false)}
          />
          <Dialog
            open={assignOpen}
            wide
            title={current ? "Change driver and vehicle" : "Assign driver and vehicle"}
            onClose={() => setAssignOpen(false)}
          >
            {assignOpen ? (
              <AssignmentEditor
                orderId={order.id}
                status={order.status}
                onDone={() => setAssignOpen(false)}
              />
            ) : null}
          </Dialog>
        </>
      ) : null}

      <ConfirmDialog
        open={confirm !== null}
        tone={confirm === "restore" ? "primary" : "danger"}
        title={
          confirm === "delete"
            ? `Delete this ${singular.toLowerCase()}?`
            : confirm === "archive"
              ? `Archive this ${singular.toLowerCase()}?`
              : `Restore this ${singular.toLowerCase()}?`
        }
        message={
          confirm === "delete"
            ? "Deleting is permanent and only allowed for records without operational history (for orders: drafts). Otherwise archive the record."
            : confirm === "archive"
              ? "Archived records leave working lists and pickers but keep all their history. You can restore them later."
              : "The record returns to working lists and pickers."
        }
        confirmLabel={
          confirm === "delete"
            ? "Delete permanently"
            : confirm === "archive"
              ? "Archive"
              : "Restore"
        }
        busy={action.isPending}
        error={action.error ? toAdminError(action.error).message : null}
        onConfirm={() => confirm && action.mutate(confirm)}
        onClose={() => {
          action.reset();
          setConfirm(null);
        }}
      />
    </div>
  );
}

/**
 * The record's fields, grouped by section. The field that names the record
 * (already the page title) and empty values are folded away by default.
 */
function DetailsPanel({
  entity,
  config,
  record,
  ctx,
  order,
  names,
}: {
  entity: EntityKey;
  config: AdminConfig;
  record: EntityRecord;
  ctx: FormatContext;
  order: OrderRow | null;
  names: Record<string, string>;
}) {
  const [showEmpty, setShowEmpty] = useState(false);
  const primary = config.entities[entity]?.primary_display_field;
  const fields = detailFields(config, entity).filter((def) => def.field_key !== primary);
  const empty = fields.filter((def) => isEmptyValue(recordValue(def, record)));
  const shown = showEmpty ? fields : fields.filter((def) => !empty.includes(def));
  const sections = groupBySection(shown);

  return (
    <Panel
      title="Details"
      actions={
        empty.length ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowEmpty((value) => !value)}
            aria-expanded={showEmpty}
          >
            {showEmpty ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
            {showEmpty
              ? "Hide empty fields"
              : `Show ${empty.length} empty ${empty.length === 1 ? "field" : "fields"}`}
          </Button>
        ) : null
      }
    >
      {fields.length === 0 ? (
        <p className="a-muted">
          No fields are shown on record pages. Configure them in Settings → Fields.
        </p>
      ) : shown.length === 0 ? (
        <p className="a-muted">No details filled in yet.</p>
      ) : (
        <div className="a-stack" style={{ gap: 14 }}>
          {sections.map((section) => (
            <section key={section.name ?? "_"} aria-label={section.name ?? undefined}>
              {section.name && sections.length > 1 ? (
                <h3 className="a-section-title">{section.name}</h3>
              ) : null}
              <dl className="a-dl">
                {section.fields.map((def) => (
                  <div key={def.id}>
                    <dt>{def.label}</dt>
                    <dd>
                      {def.binding_key === "customer_id" && order ? (
                        <CustomerLink id={order.customer_id} name={names[order.customer_id]} />
                      ) : (
                        <FieldValue def={def} value={recordValue(def, record)} ctx={ctx} />
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      )}
    </Panel>
  );
}

/** Who and what is booked for the order, with the way to change it. */
function CrewPanel({
  order,
  current,
  loading,
  onAssign,
}: {
  order: OrderRow;
  current: OrderAssignment | undefined;
  loading: boolean;
  onAssign: () => void;
}) {
  const dispatchable =
    ["confirmed", "scheduled", "in_transit"].includes(order.status) && !order.archived_at;
  return (
    <Panel
      title="Driver and vehicle"
      actions={
        dispatchable ? (
          <Button size="sm" onClick={onAssign}>
            <Link2 aria-hidden="true" />
            {current ? "Change" : "Assign"}
          </Button>
        ) : null
      }
    >
      {loading ? (
        <LoadingState />
      ) : (
        <dl className="a-dl">
          <div>
            <dt>Driver</dt>
            <dd>
              {current?.driver_id ? (
                <Link className="a-link" href={`/admin/drivers/${current.driver_id}`}>
                  {current.driver?.display_name}
                </Link>
              ) : (
                <span className="a-badge a-badge--outline">Not assigned</span>
              )}
            </dd>
          </div>
          <div>
            <dt>Vehicle</dt>
            <dd>
              {current?.vehicle_id ? (
                <Link className="a-link" href={`/admin/vehicles/${current.vehicle_id}`}>
                  {current.vehicle?.display_name}
                </Link>
              ) : (
                <span className="a-badge a-badge--outline">Not assigned</span>
              )}
            </dd>
          </div>
          <div>
            <dt>Window</dt>
            <dd>
              {order.pickup_at ? formatDateTime(order.pickup_at) : <Empty>No pickup</Empty>} →{" "}
              {order.delivery_at ? formatDateTime(order.delivery_at) : <Empty>No delivery</Empty>}
            </dd>
          </div>
          {current?.note ? (
            <div>
              <dt>Note</dt>
              <dd>{current.note}</dd>
            </div>
          ) : null}
        </dl>
      )}
      {!dispatchable && !order.archived_at ? (
        <p className="a-help" style={{ marginTop: 8 }}>
          {order.status === "draft"
            ? "Confirm the order to dispatch it."
            : "Completed and cancelled orders keep their assignment history."}
        </p>
      ) : null}
    </Panel>
  );
}

function CustomerLink({ id, name }: { id: string; name?: string }) {
  return (
    <Link className="a-link" href={`/admin/customers/${id}`}>
      {name ?? "Open customer"}
    </Link>
  );
}

function AvailabilityPanel({
  entity,
  record,
}: {
  entity: "driver" | "vehicle";
  record: ResourceRow;
}) {
  const toast = useToast();
  const invalidate = useInvalidateData();
  const mutation = useMutation({
    mutationFn: (available: boolean) => setResourceAvailable(entity, record.id, available),
    onSuccess: async (_, available) => {
      await invalidate();
      toast.success(
        available ? "Marked available for dispatch." : "Marked unavailable for dispatch.",
      );
    },
    onError: (error) => toast.error(toAdminError(error).message),
  });
  return (
    <Panel title="Dispatch availability">
      <Switch
        label="Available for dispatch"
        description="Unavailable resources are not offered when assigning orders."
        checked={record.available}
        disabled={mutation.isPending || Boolean(record.archived_at)}
        onChange={(checked) => mutation.mutate(checked)}
      />
    </Panel>
  );
}

function AssignmentTable({ rows, show }: { rows: OrderAssignment[]; show: "order" | "resources" }) {
  return (
    <div className="a-table-wrap">
      <table className="a-table">
        <thead>
          <tr>
            {show === "order" ? <th scope="col">Order</th> : null}
            {show === "resources" ? <th scope="col">Driver</th> : null}
            {show === "resources" ? <th scope="col">Vehicle</th> : null}
            <th scope="col">Window</th>
            <th scope="col">State</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => {
            const released = Boolean(a.released_at);
            const empty = released && Date.parse(a.released_at!) <= Date.parse(a.starts_at);
            return (
              <tr key={a.id}>
                {show === "order" ? (
                  <td>
                    <Link className="a-row-link a-mono" href={`/admin/orders/${a.order_id}`}>
                      {a.order?.order_number}
                    </Link>{" "}
                    {a.order ? <StatusBadge status={a.order.status} /> : null}
                  </td>
                ) : null}
                {show === "resources" ? <td>{a.driver?.display_name ?? <Empty />}</td> : null}
                {show === "resources" ? <td>{a.vehicle?.display_name ?? <Empty />}</td> : null}
                <td className="a-small">
                  {formatDateTime(a.starts_at)} →{" "}
                  {formatDateTime(released && !empty ? a.released_at : a.ends_at)}
                </td>
                <td className="a-wrap">
                  {released ? (
                    <span className="a-badge" title={a.release_reason ?? undefined}>
                      Released{a.release_reason ? ` · ${a.release_reason}` : ""}
                    </span>
                  ) : (
                    <span className="a-badge a-badge--green">Active</span>
                  )}
                  {a.note ? <div className="a-help">{a.note}</div> : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function OrderHistoryPanels({ orderId }: { orderId: string }) {
  const statuses = useQuery({
    queryKey: ["status-history", orderId],
    queryFn: () => fetchStatusHistory(orderId),
  });
  const assignments = useQuery({
    queryKey: ["assignments", "order", orderId],
    queryFn: () => fetchOrderAssignments(orderId),
  });
  return (
    <>
      <Panel title="Status history">
        {statuses.isError ? (
          <ErrorState error={statuses.error} onRetry={() => statuses.refetch()} />
        ) : statuses.isLoading ? (
          <LoadingState />
        ) : (
          <ol className="a-timeline">
            {(statuses.data ?? []).map((entry) => (
              <li key={entry.id} data-tone={entry.to_status === "cancelled" ? "red" : "green"}>
                <span className="a-row">
                  {entry.from_status ? (
                    <>
                      <StatusBadge status={entry.from_status} />
                      <span aria-hidden="true">→</span>
                    </>
                  ) : (
                    <span className="a-muted">Created as</span>
                  )}
                  <StatusBadge status={entry.to_status} />
                  <span className="a-sr-only">
                    {entry.from_status ? `from ${STATUS_LABELS[entry.from_status]} ` : ""}to{" "}
                    {STATUS_LABELS[entry.to_status]}
                  </span>
                </span>
                <span className="a-small a-muted">
                  {formatDateTime(entry.changed_at)} · {entry.changed_by_label ?? "System"}
                  {entry.note ? ` · “${entry.note}”` : ""}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Panel>
      <Panel title="Assignment history" flush>
        {assignments.isError ? (
          <ErrorState error={assignments.error} onRetry={() => assignments.refetch()} />
        ) : assignments.isLoading ? (
          <LoadingState />
        ) : !assignments.data?.length ? (
          <EmptyState
            title="Not dispatched yet"
            message="Assignments appear here, including released ones."
          />
        ) : (
          <AssignmentTable rows={assignments.data} show="resources" />
        )}
      </Panel>
    </>
  );
}

function ResourceAssignmentsPanel({
  resource,
  id,
}: {
  resource: "driver" | "vehicle";
  id: string;
}) {
  const query = useQuery({
    queryKey: ["assignments", resource, id],
    queryFn: () => fetchResourceAssignments(resource, id, 25),
  });
  return (
    <Panel title="Order assignments" flush>
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.isLoading ? (
        <LoadingState />
      ) : !query.data?.length ? (
        <EmptyState
          title="No assignments"
          message="Orders dispatched to this resource appear here."
        />
      ) : (
        <AssignmentTable rows={query.data} show="order" />
      )}
    </Panel>
  );
}

function CustomerOrdersPanel({ customerId }: { customerId: string }) {
  const { data: config } = useAdminConfig();
  const customerField = config?.fields.order.find((f) => f.binding_key === "customer_id");
  const query = useQuery({
    queryKey: ["records", "order", "customer", customerId],
    queryFn: () => fetchCustomerOrders(customerId, 10),
  });
  const allHref =
    customerField?.filterable && customerField.active
      ? `/admin/orders?scope=all&f=${encodeURIComponent(
          JSON.stringify([
            { id: "customer", field: customerField.field_key, op: "eq", value: customerId },
          ]),
        )}`
      : null;
  return (
    <Panel
      title="Recent orders"
      flush
      actions={
        allHref ? (
          <ButtonLink size="sm" href={allHref}>
            All orders
          </ButtonLink>
        ) : null
      }
    >
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.isLoading ? (
        <LoadingState />
      ) : !query.data?.length ? (
        <EmptyState title="No orders yet" message="Orders for this customer appear here." />
      ) : (
        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th scope="col">Order</th>
                <th scope="col">Status</th>
                <th scope="col">Pickup</th>
              </tr>
            </thead>
            <tbody>
              {query.data.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link className="a-row-link a-mono" href={`/admin/orders/${row.id}`}>
                      {row.order_number}
                    </Link>
                  </td>
                  <td>
                    <StatusBadge status={row.status} />
                  </td>
                  <td>{row.pickup_at ? formatDateTime(row.pickup_at) : <Empty />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
