import { unwrap } from "../lib/errors";
import type { EntityKey, FieldType, ValidationRules } from "../lib/fields/types";
import { getSupabase } from "../lib/supabase/client";
import type { OrderRow, OrderStatus } from "./records";

export interface ReportFilters {
  status?: OrderStatus[];
  customer_id?: string;
  driver_id?: string;
  vehicle_id?: string;
}

export interface ReportSummary {
  range: { from: string; to: string; bucket: "day" | "week" | "month" };
  totals: {
    orders: number;
    delivered: number;
    cancelled: number;
    open: number;
    delivered_with_deadline: number;
    delivered_on_time: number;
  };
  by_status: { status: OrderStatus; count: number }[];
  by_period: { period: string; orders: number; delivered: number }[];
  by_customer: {
    customer_id: string;
    name: string;
    orders: number;
    delivered: number;
    cancelled: number;
    open: number;
  }[];
  by_driver: {
    driver_id: string;
    name: string;
    orders: number;
    delivered: number;
    hours: number;
  }[];
  by_vehicle: {
    vehicle_id: string;
    name: string;
    orders: number;
    delivered: number;
    hours: number;
    utilization: number;
  }[];
}

export interface FieldBreakdown {
  field: {
    id: string;
    field_key: string;
    label: string;
    field_type: FieldType;
    validation_rules: ValidationRules;
  };
  kind: "categorical" | "numeric" | "timeline";
  total_records: number;
  rows: { key: string | null; label: string; count: number; archived?: boolean }[];
  stats: {
    count: number;
    sum: number | null;
    avg: number | null;
    min: number | null;
    max: number | null;
  } | null;
}

export async function fetchReportSummary(
  from: string,
  to: string,
  filters: ReportFilters,
): Promise<ReportSummary> {
  return unwrap(
    await getSupabase().rpc("report_summary", { p_from: from, p_to: to, p_filters: filters }),
  ) as ReportSummary;
}

export async function fetchFieldBreakdown(
  entity: EntityKey,
  fieldKey: string,
  from: string,
  to: string,
  filters: ReportFilters,
): Promise<FieldBreakdown> {
  return unwrap(
    await getSupabase().rpc("report_field_breakdown", {
      p_entity: entity,
      p_field_key: fieldKey,
      p_from: from,
      p_to: to,
      p_filters: filters,
    }),
  ) as FieldBreakdown;
}

export type ExportOrderRow = OrderRow & {
  customer_name: string | null;
  driver_name: string | null;
  vehicle_name: string | null;
};

export async function fetchReportOrders(
  from: string,
  to: string,
  filters: ReportFilters,
): Promise<ExportOrderRow[]> {
  return unwrap(
    await getSupabase().rpc("report_orders_export", { p_from: from, p_to: to, p_filters: filters }),
  ) as ExportOrderRow[];
}
