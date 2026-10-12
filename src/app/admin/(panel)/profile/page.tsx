import type { Metadata } from "next";

import { ProfileView } from "@/admin/features/profile/profile-view";

export const metadata: Metadata = { title: "Profile and security" };

export default function ProfilePage() {
  return <ProfileView />;
}
