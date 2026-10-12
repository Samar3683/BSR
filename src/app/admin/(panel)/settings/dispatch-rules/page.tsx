import type { Metadata } from "next";

import { DispatchRules } from "@/admin/features/settings/dispatch-rules";

export const metadata: Metadata = { title: "Dispatch rules · Settings" };

export default function DispatchRulesSettingsPage() {
  return <DispatchRules />;
}
