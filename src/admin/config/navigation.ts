import {
  CalendarDays,
  ChartColumn,
  IdCard,
  Inbox,
  MessageSquare,
  LayoutDashboard,
  Package,
  Route,
  ScrollText,
  SlidersHorizontal,
  Truck,
  Building,
  type LucideIcon,
} from "lucide-react";

import type { EntityKey } from "../lib/fields/types";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Label comes from the entity's configured plural name. */
  entity?: EntityKey;
  /** Also active for these path prefixes. */
  match?: string[];
}

export const NAV_SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: "Operations",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/requests", label: "Requests", icon: Inbox },
      { href: "/admin/messages", label: "Messages", icon: MessageSquare },
      { href: "/admin/orders", label: "Orders", icon: Package, entity: "order" },
      { href: "/admin/dispatch", label: "Dispatch", icon: Route },
      { href: "/admin/calendar", label: "Calendar", icon: CalendarDays },
    ],
  },
  {
    label: "Resources",
    items: [
      { href: "/admin/vehicles", label: "Vehicles", icon: Truck, entity: "vehicle" },
      { href: "/admin/drivers", label: "Drivers", icon: IdCard, entity: "driver" },
      { href: "/admin/customers", label: "Customers", icon: Building, entity: "customer" },
    ],
  },
  {
    label: "Insight",
    items: [
      { href: "/admin/reports", label: "Reports", icon: ChartColumn },
      { href: "/admin/audit", label: "Audit Log", icon: ScrollText },
      {
        href: "/admin/settings/fields",
        label: "Settings",
        icon: SlidersHorizontal,
        match: ["/admin/settings"],
      },
    ],
  },
];

export function isNavActive(item: NavItem, pathname: string): boolean {
  if (item.href === "/admin") return pathname === "/admin";
  const prefixes = [item.href, ...(item.match ?? [])];
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
