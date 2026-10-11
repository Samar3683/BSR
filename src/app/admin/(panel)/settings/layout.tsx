import { PageHeader } from "@/admin/components/ui/layout";
import { SettingsTabs } from "@/admin/features/settings/settings-tabs";

export default function SettingsLayout({ children }: LayoutProps<"/admin/settings">) {
  return (
    <div className="a-page">
      <PageHeader
        title="Settings"
        meta={
          <span>
            Configure the fields and entities of the panel. Changes apply immediately to forms,
            lists and reports.
          </span>
        }
      />
      <SettingsTabs />
      {children}
    </div>
  );
}
