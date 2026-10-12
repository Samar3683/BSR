import { PageSkeleton } from "@/admin/components/ui/page-skeleton";

/** Shown instantly while a panel page loads (also prefetched with its links). */
export default function PanelLoading() {
  return <PageSkeleton />;
}
