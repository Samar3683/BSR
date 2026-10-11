import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingState } from "@/admin/components/ui/feedback";
import { CalendarView } from "@/admin/features/calendar/calendar-view";

export const metadata: Metadata = { title: "Calendar" };

export default function Page() {
  return (
    <Suspense fallback={<LoadingState />}>
      <CalendarView />
    </Suspense>
  );
}
