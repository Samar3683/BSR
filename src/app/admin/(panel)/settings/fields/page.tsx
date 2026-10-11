import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingState } from "@/admin/components/ui/feedback";
import { FieldBuilder } from "@/admin/features/settings/field-builder";

export const metadata: Metadata = { title: "Fields · Settings" };

export default function FieldsSettingsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <FieldBuilder />
    </Suspense>
  );
}
