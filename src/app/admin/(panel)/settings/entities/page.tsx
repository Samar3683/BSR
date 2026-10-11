import type { Metadata } from "next";

import { EntitySettings } from "@/admin/features/settings/entity-settings";

export const metadata: Metadata = { title: "Entities · Settings" };

export default function EntitiesSettingsPage() {
  return <EntitySettings />;
}
