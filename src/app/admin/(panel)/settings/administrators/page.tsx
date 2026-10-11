import type { Metadata } from "next";

import { AdministratorsSettings } from "@/admin/features/settings/administrators";

export const metadata: Metadata = { title: "Administrators · Settings" };

export default function AdministratorsSettingsPage() {
  return <AdministratorsSettings />;
}
